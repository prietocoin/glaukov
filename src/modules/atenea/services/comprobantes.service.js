const db = require('../../../config/db');

function aplicarReglaPrecisionTasa(val) {
  if (val === null || val === undefined || isNaN(val) || val === 0) return 0;
  const num = parseFloat(val);
  if (num === 0) return 0;

  const signo = num < 0 ? -1 : 1;
  const v = Math.abs(num);
  const vRound = Math.round(v * 1e8) / 1e8;

  let res = 0;
  if (vRound > 99.99) {
    res = Math.trunc(vRound);
  } else if (vRound >= 10.0) {
    res = Math.trunc((vRound + 0.0000001) * 100) / 100;
  } else {
    const magnitud = Math.floor(Math.log10(vRound));
    const factor = Math.pow(10, 2 - magnitud);
    res = Math.trunc((vRound + 0.0000001) * factor) / factor;
  }

  return signo * res;
}

function aplicarPrecisionMonto(val) {
  if (val === null || val === undefined || isNaN(val) || val === 0) return 0;
  const num = parseFloat(val);
  if (num === 0) return 0;

  const signo = num < 0 ? -1 : 1;
  const v = Math.abs(num);
  const vRound = Math.round(v * 1e8) / 1e8;

  return signo * (Math.trunc((vRound + 0.0000001) * 100) / 100);
}

async function obtenerComprobantesAuditados(filtros = {}) {
  const { socio, nombre, fechaInicio, fechaFin, desdeHash, hastaHash, hash, rol, soloDuplicados } = filtros;
  const targetSocio = (socio || nombre || '').trim();

  let query = `
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
      c.timestamp AS timestamp_comprobante,
      to_timestamp(c.timestamp) AS fecha_hora_comprobante,
      COALESCE(r.monto, 0) AS monto,
      COALESCE(UPPER(r.moneda), 'USDT') AS moneda,
      r.banco,
      r.titular,
      r.referencia,
      COALESCE(r.procesado_ia, FALSE) AS procesado_ia,
      c.nombre_socio_1,
      NULLIF(TRIM(c.nombre_socio_2), '') AS nombre_socio_2,
      c.url_imagen,
      COALESCE(c.conteo, 1) AS conteo,
      COALESCE(c.lote_tasa_manual, lr.id_tasa, (SELECT id_tasa FROM primer_lote), 'T041') AS lote_tasa_asignado,

      COALESCE(n1.roles, 'SOCIO') AS rol_socio_1,
      COALESCE(NULLIF(TRIM(n1.moneda_socio), ''), 'USDT') AS moneda_socio_1,
      n1.ajustes AS ajustes_socio_1,

      COALESCE(n2.roles, 'SOCIO') AS rol_socio_2,
      COALESCE(NULLIF(TRIM(n2.moneda_socio), ''), 'USDT') AS moneda_socio_2,
      n2.ajustes AS ajustes_socio_2

    FROM cola_fb c
    LEFT JOIN comprobantes_raw r ON TRIM(LOWER(c.hash_largo)) = TRIM(LOWER(r.hash_largo))
    LEFT JOIN lotes_rangos lr ON c.timestamp >= lr.t_inicio AND (lr.t_fin IS NULL OR c.timestamp < lr.t_fin)
    LEFT JOIN nombres_fb n1 ON UPPER(TRIM(n1.nombre)) = UPPER(TRIM(c.nombre_socio_1))
    LEFT JOIN nombres_fb n2 ON UPPER(TRIM(n2.nombre)) = UPPER(TRIM(c.nombre_socio_2))
    WHERE c.estado != 'DESCARTADO'
  `;

  const values = [];
  let paramIndex = 1;

  if (soloDuplicados === 'true') {
    query += ` AND c.conteo > 1`;
  }

  if (rol && rol.trim() && rol.trim().toUpperCase() !== 'TODOS') {
    query += ` AND (UPPER(TRIM(n1.roles)) = UPPER(TRIM($${paramIndex})) OR UPPER(TRIM(n2.roles)) = UPPER(TRIM($${paramIndex})))`;
    values.push(rol.trim());
    paramIndex++;
  }

  if (targetSocio && targetSocio.toUpperCase() !== 'TODOS') {
    query += ` AND (UPPER(TRIM(c.nombre_socio_1)) = UPPER(TRIM($${paramIndex})) OR UPPER(TRIM(c.nombre_socio_2)) = UPPER(TRIM($${paramIndex})))`;
    values.push(targetSocio);
    paramIndex++;
  }

  if (hash && hash.trim()) {
    query += ` AND (c.hash_corto ILIKE $${paramIndex} OR c.hash_largo ILIKE $${paramIndex})`;
    values.push(`%${hash.trim()}%`);
    paramIndex++;
  }

  if (fechaInicio && fechaInicio.trim()) {
    const startTimestamp = Math.floor(new Date(fechaInicio.trim() + 'T00:00:00-04:00').getTime() / 1000);
    if (!isNaN(startTimestamp)) {
      query += ` AND c.timestamp >= $${paramIndex}`;
      values.push(startTimestamp);
      paramIndex++;
    }
  }

  if (fechaFin && fechaFin.trim()) {
    const endTimestamp = Math.floor(new Date(fechaFin.trim() + 'T23:59:59-04:00').getTime() / 1000);
    if (!isNaN(endTimestamp)) {
      query += ` AND c.timestamp <= $${paramIndex}`;
      values.push(endTimestamp);
      paramIndex++;
    }
  }

  query += ` ORDER BY c.timestamp DESC;`;

  const { rows } = await db.query(query, values);

  const ratesRes = await db.query(`SELECT id_tasa, moneda, tasa_base FROM mercado_tasas;`);
  const ratesMap = {};
  for (const rate of ratesRes.rows) {
    ratesMap[`${rate.id_tasa}_${(rate.moneda || '').toUpperCase()}`] = parseFloat(rate.tasa_base) || 1.0;
  }

  function getTasaBase(lote, mon) {
    const m = (mon || 'USDT').toUpperCase();
    if (m === 'USD' || m === 'USDT' || m === 'PYUSD') return 1.0;
    return ratesMap[`${lote}_${m}`] || 1.0;
  }

  return rows.map(r => {
    const monto = aplicarPrecisionMonto(r.monto);
    const monOrig = (r.moneda || 'USDT').trim().toUpperCase();
    const lote = r.lote_tasa_asignado;

    const tasaBaseOrigen = getTasaBase(lote, monOrig);
    const montoUsdEq = monOrig === 'USD' || monOrig === 'USDT' ? monto : (tasaBaseOrigen > 0 ? aplicarPrecisionMonto(monto / tasaBaseOrigen) : 0);

    // Cálculos Socio 1
    const monS1 = (r.moneda_socio_1 || 'USDT').trim().toUpperCase();
    const tasaBaseS1 = getTasaBase(lote, monS1);
    const aj1 = typeof r.ajustes_socio_1 === 'string' ? JSON.parse(r.ajustes_socio_1) : (r.ajustes_socio_1 || {});
    const factor1 = parseFloat(aj1[`D-${monOrig}`]) || 1.0;
    const tasaCross1 = tasaBaseS1 > 0 ? (tasaBaseOrigen / tasaBaseS1) : tasaBaseOrigen;
    const tasa1Signed = tasaCross1 * factor1;
    const tasa1 = aplicarReglaPrecisionTasa(tasa1Signed);
    let m1Raw = Math.abs(tasa1) > 0 ? (monto / Math.abs(tasa1)) : 0;
    if (factor1 < 0 || tasa1 < 0) m1Raw = -m1Raw;
    const m1Socio = aplicarPrecisionMonto(m1Raw);
    const m1Usdt = tasaBaseS1 > 0 ? aplicarPrecisionMonto(m1Socio / tasaBaseS1) : m1Socio;

    // Cálculos Socio 2 (si existe en cola_fb)
    let m2Socio = 0;
    let m2Usdt = 0;
    let tasa2 = 1;
    let monS2 = 'USDT';

    if (r.nombre_socio_2 && r.nombre_socio_2.trim() !== '') {
      monS2 = (r.moneda_socio_2 || 'USDT').trim().toUpperCase();
      const tasaBaseS2 = getTasaBase(lote, monS2);
      const aj2 = typeof r.ajustes_socio_2 === 'string' ? JSON.parse(r.ajustes_socio_2) : (r.ajustes_socio_2 || {});
      const factor2 = parseFloat(aj2[`D-${monOrig}`]) || 1.0;
      const tasaCross2 = tasaBaseS2 > 0 ? (tasaBaseOrigen / tasaBaseS2) : tasaBaseOrigen;
      const tasa2Signed = tasaCross2 * factor2;
      tasa2 = aplicarReglaPrecisionTasa(tasa2Signed);
      let m2Raw = Math.abs(tasa2) > 0 ? (monto / Math.abs(tasa2)) : 0;
      if (factor2 < 0 || tasa2 < 0) m2Raw = -m2Raw;
      m2Socio = aplicarPrecisionMonto(m2Raw);
      m2Usdt = tasaBaseS2 > 0 ? aplicarPrecisionMonto(m2Socio / tasaBaseS2) : m2Socio;
    }

    return {
      hash_largo: r.hash_largo,
      hash_corto: r.hash_corto,
      timestamp: r.timestamp_comprobante,
      fecha_hora_comprobante: r.fecha_hora_comprobante,
      monto,
      moneda: monOrig,
      banco: r.banco,
      titular: r.titular,
      referencia: r.referencia,
      procesado_ia: r.procesado_ia,
      nombre_socio_1: r.nombre_socio_1,
      nombre_socio_2: r.nombre_socio_2,
      url_imagen: r.url_imagen,
      conteo: r.conteo,
      lote_tasa_asignado: lote,
      tasa_base: tasaBaseOrigen,
      monto_usd_equivalente: montoUsdEq,
      tipo_op: 'D',
      moneda_socio_1: monS1,
      rol_socio_1: r.rol_socio_1,
      tasa_1: tasa1,
      m1_socio: m1Socio,
      m1_usdt: m1Usdt,
      moneda_socio_2: monS2,
      rol_socio_2: r.rol_socio_2,
      tasa_2: tasa2,
      m2_socio: m2Socio,
      m2_usdt: m2Usdt
    };
  });
}

async function actualizarComprobante(hashLargo, datos) {
  const targetHash = (hashLargo || '').trim();
  const { monto, moneda, banco, referencia, titular, nombre_socio_1, nombre_socio_2, lote_tasa_asignado, timestamp } = datos;

  await db.query(`
    INSERT INTO comprobantes_raw (hash_largo, monto, moneda, banco, referencia, titular, procesado_ia)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    ON CONFLICT (hash_largo) DO UPDATE SET
      monto = EXCLUDED.monto,
      moneda = EXCLUDED.moneda,
      banco = EXCLUDED.banco,
      referencia = EXCLUDED.referencia,
      titular = EXCLUDED.titular,
      procesado_ia = TRUE;
  `, [
    targetHash,
    monto !== undefined && monto !== '' ? parseFloat(monto) : null,
    moneda || null,
    banco ? banco.toUpperCase() : null,
    referencia || null,
    titular ? titular.toUpperCase() : null
  ]);

  await db.query(`
    UPDATE cola_fb 
    SET nombre_socio_1 = $1, 
        nombre_socio_2 = $2,
        lote_tasa_manual = COALESCE($3, lote_tasa_manual),
        timestamp = COALESCE($4, timestamp)
    WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($5));
  `, [
    nombre_socio_1 || null, 
    nombre_socio_2 || null, 
    lote_tasa_asignado || null,
    timestamp ? parseInt(timestamp) : null,
    targetHash
  ]);

  return { success: true };
}

async function eliminarComprobante(hashLargo) {
  const targetHash = (hashLargo || '').trim();

  await db.query(`DELETE FROM comprobantes_raw WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($1));`, [targetHash]);
  await db.query(`UPDATE cola_fb SET estado = 'DESCARTADO' WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($1));`, [targetHash]);

  return { success: true };
}

module.exports = {
  obtenerComprobantesAuditados,
  actualizarComprobante,
  eliminarComprobante
};
