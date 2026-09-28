const db = require('../../../config/db');
const { aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Consulta de lectura optimizada: Lee desde comprobantes_raw + comprobantes_liq con fallback seguro
 */
async function obtenerComprobantesAuditados(filtros = {}) {
  try {
    const { socio, rol, fechaInicio, fechaFin, hash, orden = 'fecha_desc' } = filtros;
    const targetSocio = (socio || '').trim();

    let whereClauses = ["UPPER(TRIM(c.instancia)) = 'JAIRO'"];
    const values = [];
    let paramIndex = 1;

    if (hash && hash.trim()) {
      whereClauses.push(`(c.hash_largo ILIKE $${paramIndex} OR c.referencia ILIKE $${paramIndex})`);
      values.push(`%${hash.trim()}%`);
      paramIndex++;
    }

    if (fechaInicio && fechaInicio.trim()) {
      whereClauses.push(`c.creado_en >= $${paramIndex}::timestamp`);
      values.push(`${fechaInicio.trim()} 00:00:00`);
      paramIndex++;
    }

    if (fechaFin && fechaFin.trim()) {
      whereClauses.push(`c.creado_en <= $${paramIndex}::timestamp`);
      values.push(`${fechaFin.trim()} 23:59:59`);
      paramIndex++;
    }

    const whereSql = whereClauses.join(' AND ');
    const orderDirection = orden === 'fecha_asc' ? 'ASC' : 'DESC';

    const sqlBase = `
      WITH impactos_ordenados AS (
        SELECT 
          hash_largo, hash_corto, url_imagen, usuario_raw, grupo_raw, caption,
          ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(hash_largo)) ORDER BY id ASC) AS num_impacto
        FROM impactos_raw
        WHERE UPPER(TRIM(instancia)) = 'JAIRO'
      )
      SELECT 
        c.hash_largo,
        COALESCE(i1.hash_corto, SUBSTRING(c.hash_largo FROM 1 FOR 7)) AS hash_corto,
        COALESCE(c.creado_en, NOW()) AS fecha_hora_comprobante,
        COALESCE(c.monto, 0) AS monto,
        COALESCE(UPPER(c.moneda), 'USDT') AS moneda,
        COALESCE(c.banco, '-') AS banco,
        COALESCE(c.titular, '-') AS titular,
        COALESCE(c.referencia, '-') AS referencia,
        COALESCE(c.procesado_ia, FALSE) AS procesado_ia,
        COALESCE(c.url_r2, i1.url_imagen, '') AS url_imagen,
        i1.caption,

        -- Banderilla de estado
        (l.hash_largo IS NOT NULL) AS esta_liquidado,

        -- DATOS CONGELADOS EN comprobantes_liq
        l.socio_1,
        l.tipo_op1,
        l.monto_1,
        l.tasa_1,
        l.me1,
        l.socio_2,
        l.tipo_op2,
        l.monto_2,
        l.tasa_2,
        l.me2,
        l.lote_tasa,

        -- FALLBACKS DE INGESTA BRUTA
        COALESCE(n_grupo1.nombre, n_user1.nombre, 'GENERAL') AS fb_socio_1,
        COALESCE(n_grupo2.nombre, n_user2.nombre) AS fb_socio_2,
        COALESCE(n1.roles, 'SOCIO') AS rol_socio_1,
        COALESCE(n2.roles, 'SOCIO') AS rol_socio_2

      FROM comprobantes_raw c

      LEFT JOIN comprobantes_liq l 
        ON LOWER(TRIM(l.hash_largo)) = LOWER(TRIM(c.hash_largo))

      LEFT JOIN impactos_ordenados i1 
        ON LOWER(TRIM(i1.hash_largo)) = LOWER(TRIM(c.hash_largo)) AND i1.num_impacto = 1

      LEFT JOIN impactos_ordenados i2 
        ON LOWER(TRIM(i2.hash_largo)) = LOWER(TRIM(c.hash_largo)) AND i2.num_impacto = 2

      LEFT JOIN nombres_fb n_grupo1 
        ON i1.grupo_raw IS NOT NULL AND TRIM(i1.grupo_raw) != '' 
        AND (LOWER(TRIM(n_grupo1.whatsapp)) = LOWER(TRIM(i1.grupo_raw)) OR LOWER(TRIM(n_grupo1.id_grupo)) = LOWER(TRIM(i1.grupo_raw)))
      LEFT JOIN nombres_fb n_user1 
        ON i1.usuario_raw IS NOT NULL AND TRIM(i1.usuario_raw) != '' 
        AND LOWER(TRIM(n_user1.whatsapp)) = LOWER(TRIM(i1.usuario_raw))

      LEFT JOIN nombres_fb n_grupo2 
        ON i2.grupo_raw IS NOT NULL AND TRIM(i2.grupo_raw) != '' 
        AND (LOWER(TRIM(n_grupo2.whatsapp)) = LOWER(TRIM(i2.grupo_raw)) OR LOWER(TRIM(n_grupo2.id_grupo)) = LOWER(TRIM(i2.grupo_raw)))
      LEFT JOIN nombres_fb n_user2 
        ON i2.usuario_raw IS NOT NULL AND TRIM(i2.usuario_raw) != '' 
        AND LOWER(TRIM(n_user2.whatsapp)) = LOWER(TRIM(i2.usuario_raw))

      LEFT JOIN nombres_fb n1 ON UPPER(TRIM(n1.nombre)) = UPPER(TRIM(COALESCE(n_grupo1.nombre, n_user1.nombre)))
      LEFT JOIN nombres_fb n2 ON UPPER(TRIM(n2.nombre)) = UPPER(TRIM(COALESCE(n_grupo2.nombre, n_user2.nombre)))

      WHERE ${whereSql}
    `;

    let queryFinal = `
      WITH datos AS (${sqlBase})
      SELECT * FROM datos WHERE 1=1
    `;

    if (rol && rol.trim() && rol.trim().toUpperCase() !== 'TODOS') {
      queryFinal += ` AND (UPPER(TRIM(rol_socio_1)) = UPPER(TRIM($${paramIndex})) OR UPPER(TRIM(rol_socio_2)) = UPPER(TRIM($${paramIndex})))`;
      values.push(rol.trim());
      paramIndex++;
    }

    if (targetSocio && targetSocio.toUpperCase() !== 'TODOS') {
      queryFinal += ` AND (
        UPPER(TRIM(CASE WHEN esta_liquidado THEN socio_1 ELSE fb_socio_1 END)) = UPPER(TRIM($${paramIndex})) OR 
        UPPER(TRIM(CASE WHEN esta_liquidado THEN socio_2 ELSE fb_socio_2 END)) = UPPER(TRIM($${paramIndex}))
      )`;
      values.push(targetSocio);
      paramIndex++;
    }

    queryFinal += ` ORDER BY fecha_hora_comprobante ${orderDirection} LIMIT 100;`;

    const { rows } = await db.query(queryFinal, values);

    return rows.map(r => {
      const monto = aplicarPrecisionMonto(r.monto);
      const estaLiquidado = Boolean(r.esta_liquidado);

      const socio1Final = estaLiquidado ? (r.socio_1 || 'GENERAL') : (r.fb_socio_1 || 'GENERAL');
      const socio2Final = estaLiquidado ? r.socio_2 : (r.fb_socio_2 || null);

      return {
        hash_largo: r.hash_largo,
        hash_corto: r.hash_corto,
        fecha_hora_comprobante: r.fecha_hora_comprobante,
        monto,
        moneda: r.moneda,
        banco: r.banco,
        titular: r.titular,
        referencia: r.referencia,
        url_imagen: r.url_imagen,
        procesado_ia: r.procesado_ia,
        caption: r.caption,

        // SOCIO 1
        nombre_socio_1: socio1Final,
        tipo_op1: r.tipo_op1 || `D-${r.moneda}`,
        monto_1: r.monto_1 !== null ? parseFloat(r.monto_1) : monto,
        tasa_1: r.tasa_1 !== null ? parseFloat(r.tasa_1) : 1.0,
        me1: r.me1 !== null ? parseFloat(r.me1) : monto,

        // SOCIO 2
        nombre_socio_2: socio2Final,
        tipo_op2: r.tipo_op2 || `D-${r.moneda}`,
        monto_2: r.monto_2 !== null ? parseFloat(r.monto_2) : 0,
        tasa_2: r.tasa_2 !== null ? parseFloat(r.tasa_2) : 1.0,
        me2: r.me2 !== null ? parseFloat(r.me2) : 0,

        // PROPIEDADES DE COMPATIBILIDAD CON FRONTEND
        m1_socio: r.monto_1 !== null ? parseFloat(r.monto_1) : monto,
        m2_socio: r.monto_2 !== null ? parseFloat(r.monto_2) : 0,
        lote_tasa_asignado: r.lote_tasa || 'T041'
      };
    });
  } catch (err) {
    console.error('❌ Error en obtenerComprobantesAuditados:', err.message);
    return [];
  }
}

/**
 * Registra o actualiza el congelamiento inmutable en comprobantes_liq
 */
async function liquidarComprobante(payload) {
  const {
    hash_largo, socio_1, tipo_op1, monto_1, tasa_1, me1,
    socio_2, tipo_op2, monto_2, tasa_2, me2, lote_tasa
  } = payload;

  if (!hash_largo) {
    throw new Error('El hash_largo es obligatorio para registrar la liquidación.');
  }

  const query = `
    INSERT INTO comprobantes_liq (
      hash_largo, socio_1, tipo_op1, monto_1, tasa_1, me1,
      socio_2, tipo_op2, monto_2, tasa_2, me2, lote_tasa, actualizado_en
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (hash_largo) DO UPDATE SET
      socio_1 = EXCLUDED.socio_1,
      tipo_op1 = EXCLUDED.tipo_op1,
      monto_1 = EXCLUDED.monto_1,
      tasa_1 = EXCLUDED.tasa_1,
      me1 = EXCLUDED.me1,
      socio_2 = EXCLUDED.socio_2,
      tipo_op2 = EXCLUDED.tipo_op2,
      monto_2 = EXCLUDED.monto_2,
      tasa_2 = EXCLUDED.tasa_2,
      me2 = EXCLUDED.me2,
      lote_tasa = EXCLUDED.lote_tasa,
      actualizado_en = NOW();
  `;

  await db.query(query, [
    hash_largo,
    socio_1 || 'GENERAL',
    tipo_op1 || 'D-USDT',
    monto_1 !== undefined ? parseFloat(monto_1) : 0,
    tasa_1 !== undefined ? parseFloat(tasa_1) : 1.0,
    me1 !== undefined ? parseFloat(me1) : 0,
    socio_2 && socio_2 !== 'GENERAL' ? socio_2 : null,
    tipo_op2 || 'D-USDT',
    monto_2 !== undefined ? parseFloat(monto_2) : 0,
    tasa_2 !== undefined ? parseFloat(tasa_2) : 1.0,
    me2 !== undefined ? parseFloat(me2) : 0,
    lote_tasa || 'T041'
  ]);

  return { success: true };
}

async function actualizarComprobante(hashLargo, datos) {
  const targetHash = (hashLargo || '').trim();
  const { monto, moneda, banco, referencia, titular } = datos;

  await db.query(`
    UPDATE comprobantes_raw SET
      monto = COALESCE($1, monto),
      moneda = COALESCE($2, moneda),
      banco = COALESCE($3, banco),
      referencia = COALESCE($4, referencia),
      titular = COALESCE($5, titular)
    WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($6));
  `, [
    monto !== undefined && monto !== '' ? parseFloat(monto) : null,
    moneda || null,
    banco ? banco.toUpperCase() : null,
    referencia || null,
    titular ? titular.toUpperCase() : null,
    targetHash
  ]);

  return { success: true };
}

/**
 * Borrado en cascada consistente en las tres tablas relacionales
 */
async function eliminarComprobante(hashLargo) {
  const targetHash = (hashLargo || '').trim();
  await db.query(`DELETE FROM comprobantes_raw WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1));`, [targetHash]);
  await db.query(`DELETE FROM impactos_raw WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1));`, [targetHash]);
  await db.query(`DELETE FROM comprobantes_liq WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1));`, [targetHash]);
  return { success: true };
}

module.exports = {
  obtenerComprobantesAuditados,
  liquidarComprobante,
  actualizarComprobante,
  eliminarComprobante
};
