const db = require('../../../config/db');
const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

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
          hash_largo,
          hash_corto,
          url_imagen,
          usuario_raw,
          grupo_raw,
          caption,
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

        -- SOCIO 1 (Del Impacto 1X)
        COALESCE(n_grupo1.nombre, n_user1.nombre, 'GENERAL') AS nombre_socio_1,
        
        -- SOCIO 2 (Del Impacto 2X)
        COALESCE(n_grupo2.nombre, n_user2.nombre) AS nombre_socio_2,

        -- AJUSTES DE TASA Y PERFILES DE SOCIOS DESDE NOMBRES_FB
        COALESCE(n1.roles, 'SOCIO') AS rol_socio_1,
        COALESCE(NULLIF(TRIM(n1.moneda_socio), ''), 'USDT') AS moneda_socio_1,
        COALESCE(n1.ajustes, '{}'::jsonb) AS ajustes_socio_1,

        COALESCE(n2.roles, 'SOCIO') AS rol_socio_2,
        COALESCE(NULLIF(TRIM(n2.moneda_socio), ''), 'USDT') AS moneda_socio_2,
        COALESCE(n2.ajustes, '{}'::jsonb) AS ajustes_socio_2

      FROM comprobantes_raw c

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
      queryFinal += ` AND (UPPER(TRIM(nombre_socio_1)) = UPPER(TRIM($${paramIndex})) OR UPPER(TRIM(nombre_socio_2)) = UPPER(TRIM($${paramIndex})))`;
      values.push(targetSocio);
      paramIndex++;
    }

    queryFinal += ` ORDER BY fecha_hora_comprobante ${orderDirection} LIMIT 100;`;

    const { rows } = await db.query(queryFinal, values);

    return rows.map(r => {
      const monto = aplicarPrecisionMonto(r.monto);
      const monOrig = r.moneda;
      
      // Cálculo de Socio 1
      const aj1 = typeof r.ajustes_socio_1 === 'string' ? JSON.parse(r.ajustes_socio_1 || '{}') : (r.ajustes_socio_1 || {});
      const factor1 = parseFloat(aj1[`D-${monOrig}`]) || 1.0;
      const tasa1 = aplicarReglaPrecisionTasa(factor1);
      const m1Socio = aplicarPrecisionMonto(tasa1 > 0 ? (monto / tasa1) : monto);

      // Cálculo de Socio 2
      const s2Name = r.nombre_socio_2 ? String(r.nombre_socio_2).trim() : null;
      const tieneSocio2 = s2Name && s2Name !== '' && s2Name !== 'null' && s2Name !== 'undefined';

      let tasa2 = 0;
      let m2Socio = 0;

      if (tieneSocio2) {
        const aj2 = typeof r.ajustes_socio_2 === 'string' ? JSON.parse(r.ajustes_socio_2 || '{}') : (r.ajustes_socio_2 || {});
        const factor2 = parseFloat(aj2[`D-${monOrig}`]) || 1.0;
        tasa2 = aplicarReglaPrecisionTasa(factor2);
        m2Socio = aplicarPrecisionMonto(tasa2 > 0 ? (monto / tasa2) : monto);
      }

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
        nombre_socio_1: r.nombre_socio_1 || 'GENERAL',
        nombre_socio_2: tieneSocio2 ? s2Name : null,
        tasa_1: tasa1,
        tasa_2: tasa2,
        m1_socio: m1Socio,
        m1_usdt: m1Socio,
        m2_socio: m2Socio,
        m2_usdt: m2Socio,
        tipo_op_socio: 'D',
        lote_tasa_asignado: 'T041',
        monto_usd_equivalente: monto
      };
    });
  } catch (err) {
    console.error('❌ Error en obtenerComprobantesAuditados:', err.message);
    return [];
  }
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

async function eliminarComprobante(hashLargo) {
  const targetHash = (hashLargo || '').trim();
  await db.query(`DELETE FROM comprobantes_raw WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1));`, [targetHash]);
  await db.query(`DELETE FROM impactos_raw WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1));`, [targetHash]);
  return { success: true };
}

module.exports = {
  obtenerComprobantesAuditados,
  actualizarComprobante,
  eliminarComprobante
};
