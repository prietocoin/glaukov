const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Aplica precisión a la tasa conservando el signo algebraico
 * y evitando generar NaN o strings con formato inválido para PostgreSQL.
 */
function truncarTasaSegura(valor) {
  const num = parseFloat(valor);
  if (isNaN(num) || num === 0) return 1.0;

  const signo = num < 0 ? -1 : 1;
  const mag = Math.abs(num);

  let res;
  if (typeof aplicarReglaPrecisionTasa === 'function') {
    try {
      const valFormateado = aplicarReglaPrecisionTasa(mag);
      res = parseFloat(String(valFormateado).replace(/,/g, ''));
    } catch (e) {
      res = null;
    }
  }

  if (isNaN(res) || res === null) {
    if (mag > 99.99) {
      res = Math.trunc(mag);
    } else {
      res = Math.trunc((mag + 0.0000001) * 100) / 100;
    }
  }

  return signo * (res || 1.0);
}

/**
 * Aplica precisión a los montos asegurando retornar un Number puro sin comas.
 */
function truncarMontoSeguro(valor) {
  const num = parseFloat(valor);
  if (isNaN(num)) return 0;
  
  if (typeof aplicarPrecisionMonto === 'function') {
    try {
      const valFormateado = aplicarPrecisionMonto(num);
      const numClean = parseFloat(String(valFormateado).replace(/,/g, ''));
      if (!isNaN(numClean)) return numClean;
    } catch (e) {}
  }

  return Math.round(num * 100) / 100;
}

/**
 * Calcula el snapshot contable respetando la divisa nativa de cada socio
 */
function calcularSnapshotFinanciero(raw, socio1Data, socio2Data, tasaLote) {
  // Elimina posibles comas de formato miles si vienen en raw.monto
  const montoRaw = Math.abs(parseFloat(String(raw?.monto || 0).replace(/,/g, '')) || 0);
  const divisaRaw = String(raw?.moneda || 'USDT').toUpperCase().trim();
  const tipoOp = String(raw?.tipo_manual || raw?.tipo_op || 'D').toUpperCase().trim().charAt(0);

  // Fallback seguro del lote asignado en el comprobante
  const loteCodigo = raw?.id_tasa || tasaLote?.id_tasa || 'T052';
  const mapaTasas = tasaLote?.tasas || {};

  const tasaBaseRawUSDT = parseFloat(mapaTasas[divisaRaw] || 1.0);

  // --- SOCIO 1 ---
  const monedaSocio1 = String(socio1Data?.moneda_socio || 'USDT').toUpperCase().trim();
  const aj1 = typeof socio1Data?.ajustes === 'string' 
    ? JSON.parse(socio1Data.ajustes || '{}') 
    : (socio1Data?.ajustes || {});
  
  // Obtener el factor conservando su signo
  const rawFactor1 = aj1[`${tipoOp}-${divisaRaw}`] ?? aj1[divisaRaw] ?? 1.0;
  const factor1 = parseFloat(rawFactor1) || 1.0;
  const tasaBaseSocio1USDT = parseFloat(mapaTasas[monedaSocio1] || 1.0);

  // Tasa comercial T1 (Divisa Comprobante -> Moneda Socio 1)
  const tasaBaseCalculada1 = tasaBaseRawUSDT / (tasaBaseSocio1USDT > 0 ? tasaBaseSocio1USDT : 1.0);
  const crossBase1 = tasaBaseCalculada1 * factor1;
  const tasa1Efectiva = truncarTasaSegura(crossBase1);

  // Respetar el signo según la lógica de la operación (Pago = -1, Depósito = 1)
  const signo1 = tipoOp === 'P' ? -1 : 1;

  // Se evalúa el valor absoluto para evitar activar el fallback a 1.0 si la tasa es negativa
  const divisorTasa1 = Math.abs(tasa1Efectiva) > 0 ? Math.abs(tasa1Efectiva) : 1.0;

  // M1: Monto nominal en divisa nativa del Socio 1
  const m1Nominal = truncarMontoSeguro(signo1 * (montoRaw / divisorTasa1));

  // ME1: Equivalente SIEMPRE en USDT
  const divisorSocio1 = Math.abs(tasaBaseSocio1USDT) > 0 ? tasaBaseSocio1USDT : 1.0;
  const me1USDT = truncarMontoSeguro(m1Nominal / divisorSocio1);


  // --- SOCIO 2 (Contraparte) ---
  let tasa2Efectiva = 1.0;
  let m2Nominal = 0;
  let me2USDT = 0;

  if (socio2Data && socio2Data.nombre && socio2Data.nombre.toUpperCase() !== 'GENERAL') {
    const monedaSocio2 = String(socio2Data?.moneda_socio || 'USDT').toUpperCase().trim();
    const aj2 = typeof socio2Data?.ajustes === 'string' 
      ? JSON.parse(socio2Data.ajustes || '{}') 
      : (socio2Data?.ajustes || {});

    const rawFactor2 = aj2[`${tipoOp}-${divisaRaw}`] ?? aj2[divisaRaw] ?? 1.0;
    const factor2 = parseFloat(rawFactor2) || 1.0;
    const tasaBaseSocio2USDT = parseFloat(mapaTasas[monedaSocio2] || 1.0);

    // Tasa comercial T2
    const tasaBaseCalculada2 = tasaBaseRawUSDT / (tasaBaseSocio2USDT > 0 ? tasaBaseSocio2USDT : 1.0);
    const crossBase2 = tasaBaseCalculada2 * factor2;
    tasa2Efectiva = truncarTasaSegura(crossBase2);

    const signo2 = -1 * signo1; // Espejo contable opuesto

    const divisorTasa2 = Math.abs(tasa2Efectiva) > 0 ? Math.abs(tasa2Efectiva) : 1.0;

    // M2: Monto nominal en divisa nativa del Socio 2
    m2Nominal = truncarMontoSeguro(signo2 * (montoRaw / divisorTasa2));

    // ME2: Equivalente SIEMPRE en USDT
    const divisorSocio2 = Math.abs(tasaBaseSocio2USDT) > 0 ? tasaBaseSocio2USDT : 1.0;
    me2USDT = truncarMontoSeguro(m2Nominal / divisorSocio2);
  }

  return {
    hash_largo: raw.hash_largo,
    socio_1: socio1Data?.nombre || 'GENERAL',
    tipo_op1: `${tipoOp}-${divisaRaw}`,
    monto_1: isNaN(m1Nominal) ? 0 : m1Nominal,
    tasa_1: isNaN(tasa1Efectiva) ? 1.0 : tasa1Efectiva,
    me1: isNaN(me1USDT) ? 0 : me1USDT,

    socio_2: socio2Data?.nombre && socio2Data.nombre.toUpperCase() !== 'GENERAL' ? socio2Data.nombre : null,
    tipo_op2: `${tipoOp}-${divisaRaw}`,
    monto_2: isNaN(m2Nominal) ? 0 : m2Nominal,
    tasa_2: isNaN(tasa2Efectiva) ? 1.0 : tasa2Efectiva,
    me2: isNaN(me2USDT) ? 0 : me2USDT,

    lote_tasa: loteCodigo
  };
}

module.exports = { calcularSnapshotFinanciero };
