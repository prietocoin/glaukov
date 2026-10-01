const { Queue } = require('bullmq');
const db = require('../../../config/db');
const redisConfig = require('../../../config/redis');
const { aplicarPrecisionMonto } = require('../../../utils/formatters');
const { obtenerTasaPorId } = require('./mercado.service');
const { calcularSnapshotFinanciero } = require('./liquidacion.service');

// Queue de BullMQ para re-procesamiento de IA
const pipelineQueue = new Queue('cola-pipeline', { connection: redisConfig });

function truncarTasaComercial(valor) {
  const num = Math.abs(parseFloat(valor) || 0);
  if (num === 0) return 1.0;
  if (num > 99.99) return Math.trunc(num);
  return Math.trunc((num + 0.0000001) * 100) / 100;
}

/**
 * Consulta de lectura optimizada con cálculo comercial dinámico en vivo
 * Alineada con la tabla unificada 'tasas_glaukov'
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
          hash_largo, hash_corto, url_imagen, usuario_raw, grupo_raw, caption, timestamp_msg,
          ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(hash_largo)) ORDER BY id ASC) AS num_impacto
        FROM impactos_raw
        WHERE UPPER(TRIM(instancia)) = 'JAIRO'
      )
      SELECT 
        c.hash_largo,
        COALESCE(i1.hash_corto, SUBSTRING(c.hash_largo FROM 1 FOR 7)) AS hash_corto,
        COALESCE(
          c.creado_en, 
          CASE WHEN i1.timestamp_msg IS NOT NULL AND i1.timestamp_msg > 0 THEN to_timestamp(i1.timestamp_msg) ELSE NULL END, 
          NOW()
        ) AS fecha_hora_comprobante,
        i1.timestamp_msg,
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

        -- CRUCE HISTÓRICO CON TABLA TASAS_GLAUKOV
        (
          SELECT t.id_tasa 
          FROM tasas_glaukov t 
          WHERE t.created_at <= COALESCE(
            c.creado_en, 
            CASE WHEN i1.timestamp_msg IS NOT NULL AND i1.timestamp_msg > 0 THEN to_timestamp(i1.timestamp_msg) ELSE NULL END, 
            NOW()
          )
          ORDER BY t.created_at DESC, t.id DESC
          LIMIT 1
        ) AS lote_tasa_historico,

        -- JSONB DE TASAS DEL LOTE (ASIGNADO O HISTÓRICO)
        tj.tasas AS tasas_lote,

        -- MONEDAS Y FILA COMPLETA DE SOCIO 1 Y 2
        COALESCE(n1.moneda_socio, 'USDT') AS moneda_socio_1,
        COALESCE(n2.moneda_socio, 'USDT') AS moneda_socio_2,
        to_jsonb(n1) AS socio1_row,
        to_jsonb(n2) AS socio2_row,

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

      LEFT JOIN nombres_fb n1 ON UPPER(TRIM(n1.nombre)) = UPPER(TRIM(COALESCE(l.socio_1, n_grupo1.nombre, n_user1.nombre)))
      LEFT JOIN nombres_fb n2 ON UPPER(TRIM(n2.nombre)) = UPPER(TRIM(COALESCE(l.socio_2, n_grupo2.nombre, n_user2.nombre)))

      -- UNIFICACIÓN CON TASAS_GLAUKOV
      LEFT JOIN tasas_glaukov tj ON tj.id_tasa = COALESCE(l.lote_tasa, (
        SELECT t.id_tasa FROM tasas_glaukov t 
        WHERE t.created_at <= COALESCE(c.creado_en, CASE WHEN i1.timestamp_msg IS NOT NULL AND i1.timestamp_msg > 0 THEN to_timestamp(i1.timestamp_msg) ELSE NULL END, NOW())
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      ))

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
      const montoAbsoluto = Math.abs(aplicarPrecisionMonto(r.monto));
      const estaLiquidado = Boolean(r.esta_liquidado);

      const socio1Final = estaLiquidado ? (r.socio_1 || 'GENERAL') : (r.fb_socio_1 || 'GENERAL');
      const socio2Final = estaLiquidado ? r.socio_2 : (r.fb_socio_2 || null);

      const divisaRecibo = (r.moneda || 'COP').toUpperCase();
      const divisaKey = divisaRecibo.toLowerCase();
      const monedaSocio1 = (r.moneda_socio_1 || 'USDT').toUpperCase();
      const monedaSocio2 = (r.moneda_socio_2 || 'USDT').toUpperCase();

      const socio1Row = r.socio1_row || {};
      const socio2Row = r.socio2_row || {};

      let aj1 = {}, aj2 = {};
      try { aj1 = typeof socio1Row.ajustes === 'string' ? JSON.parse(socio1Row.ajustes || '{}') : (socio1Row.ajustes || {}); } catch (e) {}
      try { aj2 = typeof socio2Row.ajustes === 'string' ? JSON.parse(socio2Row.ajustes || '{}') : (socio2Row.ajustes || {}); } catch (e) {}

      // REGLA NATURALEZA
      let naturalezaSocio1;
      if (divisaRecibo === 'USDT' || divisaRecibo === monedaSocio1) {
        naturalezaSocio1 = 'A';
      } else {
        const natRaw = socio1Row[divisaKey];
        naturalezaSocio1 = (typeof natRaw === 'string' && natRaw.trim() ? natRaw.trim() : 'D').toUpperCase();
      }

      const tipoOp1Final = r.tipo_op1 || `${naturalezaSocio1}-${divisaRecibo}`;
      const tipoOp2Final = r.tipo_op2 || tipoOp1Final;

      let tasa1Calculada = 1.0, tasa2Calculada = 1.0;
      let m1Calculado = 0, m2Calculado = 0;
      let me1Calculado = 0, me2Calculado = 0;

      if (estaLiquidado) {
        tasa1Calculada = r.tasa_1 !== null ? parseFloat(r.tasa_1) : 1.0;
        tasa2Calculada = r.tasa_2 !== null ? parseFloat(r.tasa_2) : 1.0;
        m1Calculado = parseFloat(r.monto_1 || 0);
        m2Calculado = parseFloat(r.monto_2 || 0);
        me1Calculado = parseFloat(r.me1 || 0);
        me2Calculado = parseFloat(r.me2 || 0);
      } else {
        // CÁLCULO EN TIEMPO REAL CON LA TASA DEL LOTE OBTENIDO DE TASAS_GLAUKOV
        const tasasMap = typeof r.tasas_lote === 'string' ? JSON.parse(r.tasas_lote) : (r.tasas_lote || {});
        
        const tasaBaseDivisa = parseFloat(tasasMap[divisaRecibo] || 1.0);
        const tasaBaseS1 = parseFloat(tasasMap[monedaSocio1] || 1.0);
        const tasaBaseS2 = parseFloat(tasasMap[monedaSocio2] || 1.0);

        const tipoOpLetra = naturalezaSocio1;
        const factor1 = Math.abs(parseFloat(aj1[`${tipoOpLetra}-${divisaRecibo}`]) || 1.0);
        const factor2 = Math.abs(parseFloat(aj2[`${tipoOpLetra}-${divisaRecibo}`]) || 1.0);

        const cross1 = (tasaBaseDivisa / (tasaBaseS1 > 0 ? tasaBaseS1 : 1.0)) * factor1;
        tasa1Calculada = truncarTasaComercial(cross1);

        const cross2 = (tasaBaseDivisa / (tasaBaseS2 > 0 ? tasaBaseS2 : 1.0)) * factor2;
        tasa2Calculada = truncarTasaComercial(cross2);

        const signo1 = tipoOpLetra === 'P' ? -1 : 1;
        const signo2 = -1 * signo1;

        m1Calculado = tasa1Calculada > 0 ? (signo1 * montoAbsoluto / tasa1Calculada) : (signo1 * montoAbsoluto);
        me1Calculado = m1Calculado / (tasaBaseS1 > 0 ? tasaBaseS1 : 1.0);

        if (socio2Final) {
          m2Calculado = tasa2Calculada > 0 ? (signo2 * montoAbsoluto / tasa2Calculada) : 0;
          me2Calculado = m2Calculado / (tasaBaseS2 > 0 ? tasaBaseS2 : 1.0);
        } else {
          m2Calculado = 0;
          me2Calculado = 0;
        }
      }

      return {
        hash_largo: r.hash_largo,
        hash_corto: r.hash_corto,
        fecha_hora_comprobante: r.fecha_hora_comprobante,
        timestamp_msg: r.timestamp_msg,
        monto: montoAbsoluto,
        moneda: r.moneda,
        banco: r.banco,
        titular: r.titular,
        referencia: r.referencia,
        url_imagen: r.url_imagen,
        procesado_ia: r.procesado_ia,
        caption: r.caption,

        // SOCIO 1
        nombre_socio_1: socio1Final,
        moneda_socio_1: r.moneda_socio_1 || 'USDT',
        tipo_op1: tipoOp1Final,
        monto_1: m1Calculado,
        tasa_1: tasa1Calculada,
        me1: me1Calculado,

        // SOCIO 2
        nombre_socio_2: socio2Final,
        moneda_socio_2: r.moneda_socio_2 || 'USDT',
        tipo_op2: tipoOp2Final,
        monto_2: m2Calculado,
        tasa_2: tasa2Calculada,
        me2: me2Calculado,

        // PROPIEDADES FRONTEND
        m1_socio: m1Calculado,
        m2_socio: m2Calculado,
        lote_tasa_asignado: r.lote_tasa || r.lote_tasa_historico || 'T001'
      };
    });
  } catch (err) {
    console.error('❌ Error en obtenerComprobantesAuditados:', err.message);
    return [];
  }
}

/**
 * Registra o actualiza la liquidación congelada en comprobantes_liq
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
    lote_tasa || null
  ]);

  return { success: true };
}

async function releerIA(hashLargo) {
  const targetHash = (hashLargo || '').trim();

  const { rows } = await db.query(`
    SELECT c.hash_largo, c.creado_en, COALESCE(c.url_r2, i.url_imagen) as url_r2, COALESCE(c.instancia, i.instancia, 'JAIRO') as instancia, i.caption, i.timestamp_msg
    FROM comprobantes_raw c
    LEFT JOIN impactos_raw i ON LOWER(TRIM(c.hash_largo)) = LOWER(TRIM(i.hash_largo))
    WHERE LOWER(TRIM(c.hash_largo)) = LOWER(TRIM($1))
    LIMIT 1;
  `, [targetHash]);

  if (rows.length === 0) {
    throw new Error('Comprobante no encontrado en la base de datos.');
  }

  const comp = rows[0];

  await db.query(`
    UPDATE comprobantes_raw 
    SET estado_ia = 'RE-PROCESANDO', procesado_ia = false 
    WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1));
  `, [targetHash]);

  await pipelineQueue.add('releer-ia', {
    hash_largo: comp.hash_largo,
    url_r2: comp.url_r2,
    instancia: comp.instancia || 'JAIRO',
    caption: comp.caption,
    timestamp_msg: comp.timestamp_msg,
    creado_en: comp.creado_en
  }, {
    attempts: 3,
    removeOnComplete: true
  });

  return { success: true, message: 'Re-lectura encolada manteniendo fecha/tasa histórica intacta' };
}

/**
 * Actualiza los datos del comprobante y recalcula/congela el snapshot en comprobantes_liq
 */
async function actualizarComprobante(hashLargo, datos = {}) {
  const targetHash = (hashLargo || '').trim();
  const { monto, moneda, banco, referencia, titular } = datos;

  // 1. Actualizar tabla base comprobantes_raw
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

  // 2. Extraer parámetros del modal de edición
  const idLote = datos.id_tasa || datos.lote_tasa || datos.lote_tasa_asignado || 'T052';
  const socio1Nombre = datos.socio_1 || datos.nombre_socio_1 || datos.socio1 || 'GENERAL';
  const socio2Nombre = datos.socio_2 || datos.nombre_socio_2 || datos.socio2 || null;

  // 3. Obtener el lote de tasa específico (ej. T052 = 3285)
  let tasaLote = null;
  try {
    tasaLote = await obtenerTasaPorId(idLote);
  } catch (e) {
    console.warn(`⚠️ Error al consultar lote ${idLote}:`, e.message);
  }

  // 4. Obtener reglas y ajustes de los socios desde nombres_fb
  let socio1Data = { nombre: socio1Nombre };
  let socio2Data = null;

  if (socio1Nombre && socio1Nombre.toUpperCase() !== 'GENERAL') {
    const res1 = await db.query(
      `SELECT * FROM nombres_fb WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($1)) LIMIT 1`,
      [socio1Nombre]
    );
    if (res1.rows.length > 0) socio1Data = res1.rows[0];
  }

  if (socio2Nombre && socio2Nombre.toUpperCase() !== 'GENERAL') {
    const res2 = await db.query(
      `SELECT * FROM nombres_fb WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($1)) LIMIT 1`,
      [socio2Nombre]
    );
    if (res2.rows.length > 0) socio2Data = res2.rows[0];
  }

  // 5. Preparar el payload y calcular el nuevo snapshot financiero
  const rawData = {
    hash_largo: targetHash,
    monto: datos.monto !== undefined && datos.monto !== '' ? datos.monto : 0,
    moneda: datos.moneda || 'COP',
    tipo_manual: datos.tipo_manual || datos.tipo_op || datos.tipo_op1 || 'P',
    id_tasa: idLote
  };

  const snapshot = calcularSnapshotFinanciero(rawData, socio1Data, socio2Data, tasaLote);

  // 6. Sobrescribir/Congelar el snapshot en la tabla comprobantes_liq
  await liquidarComprobante(snapshot);

  return { success: true };
}

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
  releerIA,
  actualizarComprobante,
  eliminarComprobante
};
