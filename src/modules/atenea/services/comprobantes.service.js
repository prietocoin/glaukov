const db = require('../../../config/db');
const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Consulta y audita comprobantes leyendo directamente de la tabla [comprobantes_raw]
 * @param {Object} filtros - Criterios de búsqueda (socio, rol, fechas, hash, etc.)
 */
async function obtenerComprobantesAuditados(filtros = {}) {
  const {
    socio,
    rol,
    fechaInicio,
    fechaFin,
    desdeHash,
    hastaHash,
    hash,
    soloDuplicados,
    orden = 'fecha_desc'
  } = filtros;

  const targetSocio = (socio || '').trim();

  // Consulta SQL base cruzando comprobantes_raw con el lote de tasas y las reglas de nombres_fb
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
      c.hash_corto,
      c.timestamp AS timestamp,
      to_timestamp(c.timestamp) AS fecha_hora_comprobante,
      COALESCE(c.monto, 0) AS monto,
      COALESCE(UPPER(c.moneda), 'USDT') AS moneda,
      c.banco,
      c.titular,
      c.referencia,
      COALESCE(c.procesado_ia, FALSE) AS procesado_ia,
      c.nombre_socio_1,
      c.nombre_socio_2,
      c.url_imagen,
      COALESCE(c.conteo, 1) AS conteo,
      COALESCE(c.lote_tasa_manual, lr.id_tasa, (SELECT id_tasa FROM primer_lote), 'T360') AS lote_tasa_asignado,
      
      COALESCE(
        mt.tasa_base, 
        mt_primer.tasa_base,
        CASE WHEN UPPER(COALESCE(c.moneda, 'USDT')) IN ('USD', 'USDT', 'PYUSD') THEN 1.0 ELSE NULL END
      ) AS tasa_mercado_aplicada,

      CASE 
        WHEN UPPER(TRIM(COALESCE(n1.moneda_socio, 'USDT'))) = 'USD' THEN 'USDT'
        ELSE UPPER(TRIM(COALESCE(n1.moneda_socio, 'USDT')))
      END AS moneda_socio_1,
      n1.roles AS rol_socio_1,
      n1.ajustes AS ajustes_socio_1,
      COALESCE(mt_s1.tasa_base, 1.0) AS tasa_base_socio_1,

      CASE 
        WHEN UPPER(TRIM(COALESCE(n2.moneda_socio, 'USDT'))) = 'USD' THEN 'USDT'
        ELSE UPPER(TRIM(COALESCE(n2.moneda_socio, 'USDT')))
      END AS moneda_socio_2,
      n2.roles AS rol_socio_2,
      n2.ajustes AS ajustes_socio_2,
      COALESCE(mt_s2.tasa_base, 1.0) AS tasa_base_socio_2,

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
    LEFT JOIN lotes_rangos lr ON c.timestamp >= lr.t_inicio AND (lr.t_fin IS NULL OR c.timestamp < lr.t_fin)
    LEFT JOIN nombres_fb n1 ON UPPER(TRIM(n1.nombre)) = UPPER(TRIM(c.nombre_socio_1))
    LEFT JOIN nombres_fb n2 ON UPPER(TRIM(n2.nombre)) = UPPER(TRIM(c.nombre_socio_2))
    LEFT JOIN mercado_tasas mt ON mt.id_tasa = COALESCE(c.lote_tasa_manual, lr.id_tasa) AND mt.moneda = UPPER(c.moneda)
    LEFT JOIN mercado_tasas mt_primer ON mt_primer.id_tasa = (SELECT id_tasa FROM primer_lote) AND mt_primer.moneda = UPPER(c.moneda)
    LEFT JOIN mercado_tasas mt_s1 ON mt_s1.id_tasa = COALESCE(c.lote_tasa_manual, lr.id_tasa) AND mt_s1.moneda = CASE WHEN UPPER(COALESCE(n1.moneda_socio, 'USDT')) = 'USD' THEN 'USDT' ELSE UPPER(COALESCE(n1.moneda_socio, 'USDT')) END
    LEFT JOIN mercado_tasas mt_s2 ON mt_s2.id_tasa = COALESCE(c.lote_tasa_manual, lr.id_tasa) AND mt_s2.moneda = CASE WHEN UPPER(COALESCE(n2.moneda_socio, 'USDT')) = 'USD' THEN 'USDT' ELSE UPPER(COALESCE(n2.moneda_socio, 'USDT')) END
    WHERE COALESCE(c.estado, 'PROCESADO') != 'DESCARTADO'
  `;

  const values = [];
  let paramIndex = 1;

  if (soloDuplicados === 'true') {
    sql += ` AND c.conteo > 1`;
  }

  if (rol && rol.trim() && rol.trim().toUpperCase() !== 'TODOS') {
    sql += ` AND (UPPER(TRIM(n1.roles)) = UPPER(TRIM($${paramIndex})) OR UPPER(TRIM(n2.roles)) = UPPER(TRIM($${paramIndex})))`;
    values.push(rol.trim());
    paramIndex++;
  }

  if (targetSocio && targetSocio.toUpperCase() !== 'TODOS') {
    sql += ` AND (UPPER(TRIM(c.nombre_socio_1)) = UPPER(TRIM($${paramIndex})) OR UPPER(TRIM(c.nombre_socio_2)) = UPPER(TRIM($${paramIndex})))`;
    values.push(targetSocio);
    paramIndex++;
  }

  if (hash && hash.trim()) {
    sql += ` AND (c.hash_corto ILIKE $${paramIndex} OR c.hash_largo ILIKE $${paramIndex})`;
    values.push(`%${hash.trim()}%`);
    paramIndex++;
  }

  if (fechaInicio && fechaInicio.trim()) {
    const startTimestamp = Math.floor(new Date(`${fechaInicio.trim()}T00:00:00-04:00`).getTime() / 1000);
    if (!isNaN(startTimestamp)) {
      sql += ` AND c.timestamp >= $${paramIndex}`;
      values.push(startTimestamp);
      paramIndex++;
    }
  }

  if (fechaFin && fechaFin.trim()) {
    const endTimestamp = Math.floor(new Date(`${fechaFin.trim()}T23:59:59-04:00`).getTime() / 1000);
    if (!isNaN(endTimestamp)) {
      sql += ` AND c.timestamp <= $${paramIndex}`;
      values.push(endTimestamp);
      paramIndex++;
    }
  }

  // Ordenamiento
  if (orden === 'fecha_asc') {
    sql += ` ORDER BY c.timestamp ASC;`;
  } else {
    sql += ` ORDER BY c.timestamp DESC;`;
  }

  const { rows } = await db.query(sql, values);

  // Procesamiento matemático contable en memoria
  return rows.map(r => {
    const monto = aplicarPrecisionMonto(r.monto);
    const tasaBaseOrigen = parseFloat(r.tasa_mercado_aplicada) || 1.0;
    const monOrig = (r.moneda || 'USDT').trim().toUpperCase();

    let tipoOp1 = (r.tipo_op_s1 || 'D').trim().toUpperCase();
    if (!['D', 'P', 'A', 'C'].includes(tipoOp1)) tipoOp1 = 'D';
    let tipoOp2 = tipoOp1;

    const aj1 = typeof r.ajustes_socio_1 === 'string' ? JSON.parse(r.ajustes_socio_1 || '{}') : (r.ajustes_socio_1 || {});
    const aj2 = typeof r.ajustes_socio_2 === 'string' ? JSON.parse(r.ajustes_socio_2 || '{}') : (r.ajustes_socio_2 || {});

    const f1Val = parseFloat(aj1[`${tipoOp1}-${monOrig}`]);
    const factor1 = !isNaN(f1Val) ? f1Val : 1.0;

    const f2Val = parseFloat(aj2[`${tipoOp2}-${monOrig}`]);
    const factor2 = !isNaN(f2Val) ? f2Val : 1.0;

    // SOCIO 1
    const tasaBaseSocio1 = parseFloat(r.tasa_base_socio_1) || 1.0;
    const tasaCross1 = tasaBaseSocio1 > 0 ? (tasaBaseOrigen / tasaBaseSocio1) : tasaBaseOrigen;
    const tasa1 = aplicarReglaPrecisionTasa(tasaCross1 * factor1);

    let m1Raw = Math.abs(tasa1) > 0 ? (monto / Math.abs(tasa1)) : 0;
    if (factor1 < 0 || tasa1 < 0) m1Raw = -m1Raw;
    const m1Socio = aplicarPrecisionMonto(m1Raw);
    const m1Usdt = tasaBaseSocio1 > 0 ? aplicarPrecisionMonto(m1Socio / tasaBaseSocio1) : m1Socio;

    // SOCIO 2
    const tasaBaseSocio2 = parseFloat(r.tasa_base_socio_2) || 1.0;
    const tasaCross2 = tasaBaseSocio2 > 0 ? (tasaBaseOrigen / tasaBaseSocio2) : tasaBaseOrigen;
    const tasa2 = aplicarReglaPrecisionTasa(tasaCross2 * factor2);

    let m2Raw = Math.abs(tasa2) > 0 ? (monto / Math.abs(tasa2)) : 0;
    if (factor2 < 0 || tasa2 < 0) m2Raw = -m2Raw;
    const m2Socio = aplicarPrecisionMonto(m2Raw);
    const m2Usdt = tasaBaseSocio2 > 0 ? aplicarPrecisionMonto(m2Socio / tasaBaseSocio2) : m2Socio;

    // Asignación de valores para el socio filtrado
    let montoSocioFinal = m1Socio;
    let tasaSocioFinal = tasa1;
    let monedaSocioFinal = r.moneda_socio_1 || 'USDT';
    let tipoOpSocioFinal = tipoOp1;

    if (targetSocio && r.nombre_socio_2 && r.nombre_socio_2.trim().toUpperCase() === targetSocio.toUpperCase()) {
      montoSocioFinal = m2Socio;
      tasaSocioFinal = tasa2;
      monedaSocioFinal = r.moneda_socio_2 || 'USDT';
      tipoOpSocioFinal = tipoOp2;
    }

    return {
      ...r,
      monto,
      tasa_1: tasa1,
      m1_socio: m1Socio,
      m1_usdt: m1Usdt,
      tasa_2: tasa2,
      m2_socio: m2Socio,
      m2_usdt: m2Usdt,
      monto_socio_final: montoSocioFinal,
      tasa_socio_final: tasaSocioFinal,
      moneda_socio_final: monedaSocioFinal,
      tipo_op_socio: tipoOpSocioFinal,
      etiqueta_hash: `[${tipoOpSocioFinal}-${r.hash_corto || 'OP'}]`
    };
  });
}

/**
 * Permite la edición manual de un comprobante en comprobantes_raw
 */
async function actualizarComprobante(hashLargo, datos) {
  const {
    monto, moneda, banco, referencia, titular,
    nombre_socio_1, nombre_socio_2, lote_tasa_asignado, timestamp
  } = datos;

  const sql = `
    UPDATE comprobantes_raw
    SET monto = COALESCE($1, monto),
        moneda = COALESCE($2, moneda),
        banco = COALESCE($3, banco),
        referencia = COALESCE($4, referencia),
        titular = COALESCE($5, titular),
        nombre_socio_1 = COALESCE($6, nombre_socio_1),
        nombre_socio_2 = COALESCE($7, nombre_socio_2),
        lote_tasa_manual = COALESCE($8, lote_tasa_manual),
        timestamp = COALESCE($9, timestamp)
    WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($10))
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    monto !== undefined && monto !== '' ? parseFloat(monto) : null,
    moneda ? moneda.toUpperCase() : null,
    banco ? banco.toUpperCase() : null,
    referencia || null,
    titular ? titular.toUpperCase() : null,
    nombre_socio_1 || null,
    nombre_socio_2 || null,
    lote_tasa_asignado || null,
    timestamp ? parseInt(timestamp) : null,
    hashLargo.trim()
  ]);

  return rows[0];
}

/**
 * Descarta o elimina un comprobante
 */
async function eliminarComprobante(hashLargo) {
  const sql = `
    UPDATE comprobantes_raw
    SET estado = 'DESCARTADO'
    WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($1))
    RETURNING *;
  `;
  const { rows } = await db.query(sql, [hashLargo.trim()]);
  return rows[0];
}

module.exports = {
  obtenerComprobantesAuditados,
  actualizarComprobante,
  eliminarComprobante
};
