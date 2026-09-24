const db = require('../../../config/db');
const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Consulta y audita comprobantes desde [comprobantes_raw] (Remithub) 
 * filtrados por la instancia 'Jairo' y cruzados con el motor contable de Atenea.
 */
async function obtenerComprobantesAuditados(filtros = {}) {
  const {
    socio,
    rol,
    fechaInicio,
    fechaFin,
    hash,
    orden = 'fecha_desc'
  } = filtros;

  const targetSocio = (socio || '').trim();

  // 1. Consulta SQL usando únicamente columnas reales de comprobantes_raw
  let sql = `
    WITH primer_lote AS (
      SELECT id_tasa, timestamp
      FROM mercado_tasas
      ORDER BY timestamp ASC
      LIMIT 1
    ),
    lotes_rangos AS (
      SELECT 
        id_tasa,
        timestamp AS t_inicio,
        LEAD(timestamp) OVER (ORDER BY timestamp ASC) AS t_fin
      FROM (
        SELECT DISTINCT id_tasa, timestamp 
        FROM mercado_tasas
      ) lotes
    )
    SELECT 
      c.hash_largo,
      COALESCE(SUBSTRING(c.hash_largo FROM 1 FOR 7), 'N/A') AS hash_corto,
      EXTRACT(EPOCH FROM c.creado_en)::bigint AS timestamp,
      c.creado_en AS fecha_hora_comprobante,
      COALESCE(c.monto, 0) AS monto,
      COALESCE(UPPER(c.moneda), 'USDT') AS moneda,
      COALESCE(c.banco, '-') AS banco,
      COALESCE(c.titular, '-') AS titular,
      COALESCE(c.referencia, '-') AS referencia,
      COALESCE(c.procesado_ia, FALSE) AS procesado_ia,
      COALESCE(c.url_r2, '') AS url_imagen,
      c.instancia,
      c.estado_ia,

      -- Asignación de lote de tasa por timestamp de creado_en
      COALESCE(lr.id_tasa, (SELECT id_tasa FROM primer_lote), 'T360') AS lote_tasa_asignado,

      -- Tasa del país de origen
      COALESCE(
        mt.tasa_base, 
        mt_primer.tasa_base,
        CASE WHEN UPPER(COALESCE(c.moneda, 'USDT')) IN ('USD', 'USDT', 'PYUSD') THEN 1.0 ELSE NULL END
      ) AS tasa_mercado_aplicada,

      -- Búsqueda de coincidencias en nombres_fb por titular
      n1.nombre AS nombre_socio_1,
      CASE 
        WHEN UPPER(TRIM(COALESCE(n1.moneda_socio, 'USDT'))) = 'USD' THEN 'USDT'
        ELSE UPPER(TRIM(COALESCE(n1.moneda_socio, 'USDT')))
      END AS moneda_socio_1,
      n1.roles AS rol_socio_1,
      n1.ajustes AS ajustes_socio_1,
      COALESCE(mt_s1.tasa_base, 1.0) AS tasa_base_socio_1,

      COALESCE(
        CASE UPPER(TRIM(c.moneda))
          WHEN 'PEN' THEN n1.pen WHEN 'COP' THEN n1.cop WHEN 'CLP' THEN n1.clp
          WHEN 'ARS' THEN n1.ars WHEN 'MXN' THEN n1.mxn WHEN 'BRL' THEN n1.brl
          WHEN 'VES' THEN n1.ves WHEN 'PYG' THEN n1.pyg WHEN 'DOP' THEN n1.dop
          WHEN 'CRC' THEN n1.crc WHEN 'EUR' THEN n1.eur WHEN 'CAD' THEN n1.cad
          WHEN 'USD' THEN n1.usd WHEN 'ECU' THEN n1.ecu WHEN 'PAN' THEN n1.pan
          WHEN 'USDT' THEN n1.usdt ELSE 'D'
        END,
        'D'
      ) AS tipo_op_s1

    FROM comprobantes_raw c
    LEFT JOIN lotes_rangos lr 
      ON EXTRACT(EPOCH FROM c.creado_en)::bigint >= lr.t_inicio 
     AND (lr.t_fin IS NULL OR EXTRACT(EPOCH FROM c.creado_en)::bigint < lr.t_fin)
    LEFT JOIN nombres_fb n1 
      ON UPPER(TRIM(c.titular)) ILIKE '%' || UPPER(TRIM(n1.nombre)) || '%'
    LEFT JOIN mercado_tasas mt 
      ON mt.id_tasa = COALESCE(lr.id_tasa, (SELECT id_tasa FROM primer_lote)) 
     AND mt.moneda = UPPER(c.moneda)
    LEFT JOIN mercado_tasas mt_primer 
      ON mt_primer.id_tasa = (SELECT id_tasa FROM primer_lote) 
     AND mt_primer.moneda = UPPER(c.moneda)
    LEFT JOIN mercado_tasas mt_s1 
      ON mt_s1.id_tasa = COALESCE(lr.id_tasa, (SELECT id_tasa FROM primer_lote)) 
     AND mt_s1.moneda = CASE WHEN UPPER(COALESCE(n1.moneda_socio, 'USDT')) = 'USD' THEN 'USDT' ELSE UPPER(COALESCE(n1.moneda_socio, 'USDT')) END
    
    WHERE UPPER(TRIM(c.instancia)) = 'JAIRO'
  `;

  const values = [];
  let paramIndex = 1;

  if (rol && rol.trim() && rol.trim().toUpperCase() !== 'TODOS') {
    sql += ` AND UPPER(TRIM(n1.roles)) = UPPER(TRIM($${paramIndex}))`;
    values.push(rol.trim());
    paramIndex++;
  }

  if (targetSocio && targetSocio.toUpperCase() !== 'TODOS') {
    sql += ` AND UPPER(TRIM(n1.nombre)) = UPPER(TRIM($${paramIndex}))`;
    values.push(targetSocio);
    paramIndex++;
  }

  if (hash && hash.trim()) {
    sql += ` AND (c.hash_largo ILIKE $${paramIndex} OR c.referencia ILIKE $${paramIndex})`;
    values.push(`%${hash.trim()}%`);
    paramIndex++;
  }

  if (fechaInicio && fechaInicio.trim()) {
    sql += ` AND c.creado_en >= $${paramIndex}::timestamp`;
    values.push(`${fechaInicio.trim()} 00:00:00`);
    paramIndex++;
  }

  if (fechaFin && fechaFin.trim()) {
    sql += ` AND c.creado_en <= $${paramIndex}::timestamp`;
    values.push(`${fechaFin.trim()} 23:59:59`);
    paramIndex++;
  }

  if (orden === 'fecha_asc') {
    sql += ` ORDER BY c.creado_en ASC LIMIT 100;`;
  } else {
    sql += ` ORDER BY c.creado_en DESC LIMIT 100;`;
  }

  const { rows } = await db.query(sql, values);

  // 2. Procesa la matemática de Atenea para cada registro de Remithub
  return rows.map(r => {
    const monto = aplicarPrecisionMonto(r.monto);
    const tasaBaseOrigen = parseFloat(r.tasa_mercado_aplicada) || 1.0;
    const monOrig = (r.moneda || 'USDT').trim().toUpperCase();

    let tipoOp1 = (r.tipo_op_s1 || 'D').trim().toUpperCase();
    if (!['D', 'P', 'A', 'C'].includes(tipoOp1)) tipoOp1 = 'D';

    const aj1 = typeof r.ajustes_socio_1 === 'string' ? JSON.parse(r.ajustes_socio_1 || '{}') : (r.ajustes_socio_1 || {});
    const f1Val = parseFloat(aj1[`${tipoOp1}-${monOrig}`]);
    const factor1 = !isNaN(f1Val) ? f1Val : 1.0;

    const tasaBaseSocio1 = parseFloat(r.tasa_base_socio_1) || 1.0;
    const tasaCross1 = tasaBaseSocio1 > 0 ? (tasaBaseOrigen / tasaBaseSocio1) : tasaBaseOrigen;
    const tasa1 = aplicarReglaPrecisionTasa(tasaCross1 * factor1);

    let m1Raw = Math.abs(tasa1) > 0 ? (monto / Math.abs(tasa1)) : 0;
    if (factor1 < 0 || tasa1 < 0) m1Raw = -m1Raw;
    const m1Socio = aplicarPrecisionMonto(m1Raw);
    const m1Usdt = tasaBaseSocio1 > 0 ? aplicarPrecisionMonto(m1Socio / tasaBaseSocio1) : m1Socio;

    const socio1Nombre = r.nombre_socio_1 || 'GENERAL';

    return {
      ...r,
      monto,
      nombre_socio_1: socio1Nombre,
      nombre_socio_2: null,
      tasa_1: tasa1,
      m1_socio: m1Socio,
      m1_usdt: m1Usdt,
      tasa_2: 0,
      m2_socio: 0,
      m2_usdt: 0,
      monto_socio_final: m1Socio,
      tasa_socio_final: tasa1,
      moneda_socio_final: r.moneda_socio_1 || 'USDT',
      tipo_op_socio: tipoOp1,
      etiqueta_hash: `[${tipoOp1}-${r.hash_corto}]`
    };
  });
}

async function actualizarComprobante(hashLargo, datos) {
  return { success: true };
}

async function eliminarComprobante(hashLargo) {
  return { success: true };
}

module.exports = {
  obtenerComprobantesAuditados,
  actualizarComprobante,
  eliminarComprobante
};
