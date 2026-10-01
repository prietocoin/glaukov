const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Trunca la tasa asegurando que SIEMPRE sea una magnitud absoluta POSITIVA.
 */
function truncarTasaSegura(valor) {
  const num = Math.abs(parseFloat(valor) || 0);
  if (num === 0) return 1.0;

  let res;
  if (typeof aplicarReglaPrecisionTasa === 'function') {
    try {
      const valFormateado = aplicarReglaPrecisionTasa(num);
      res = parseFloat(String(valFormateado).replace(/,/g, ''));
    } catch (e) {
      res = null;
    }
  }

  if (isNaN(res) || res === null) {
    if (num > 99.99) {
      res = Math.trunc(num);
    } else {
      res = Math.trunc((num + 0.0000001) * 100) / 100;
    }
  }

  return res || 1.0;
}

/**
 * Aplica precisión al monto conservando su signo algebraico numérico.
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
  const montoRaw = Math.abs(parseFloat(String(raw?.monto || 0).replace(/,/g, '')) || 0);
  const divisaRaw = String(raw?.moneda || 'USDT').toUpperCase().trim();
  const tipoOp = String(raw?.tipo_manual || raw?.tipo_op || 'D').toUpperCase().trim().charAt(0);

  const loteCodigo = raw?.id_tasa || tasaLote?.id_tasa || 'T052';
  const mapaTasas = tasaLote?.tasas || {};

  const tasaBaseRawUSDT = parseFloat(mapaTasas[divisaRaw] || 1.0);

  // --- SOCIO 1 ---
  const monedaSocio1 = String(socio1Data?.moneda_socio || 'USDT').toUpperCase().trim();
  const aj1 = typeof socio1Data?.ajustes === 'string' 
    ? JSON.parse(socio1Data.ajustes || '{}') 
    : (socio1Data?.ajustes || {});
  
  const rawFactor1 = aj1[`${tipoOp}-${divisaRaw}`] ?? aj1[divisaRaw] ?? 1.0;
  const factor1Abs = Math.abs(parseFloat(rawFactor1)) || 1.0;
  const tasaBaseSocio1USDT = parseFloat(mapaTasas[monedaSocio1] || 1.0);

  // Tasa comercial T1 (Divisa Comprobante -> Moneda Socio 1) - SIEMPRE POSITIVA
  const tasaBaseCalculada1 = tasaBaseRawUSDT / (tasaBaseSocio1USDT > 0 ? tasaBaseSocio1USDT : 1.0);
  const crossBase1 = tasaBaseCalculada1 * factor1Abs;
  const tasa1Efectiva = truncarTasaSegura(crossBase1);

  // Signo contable para Socio 1 (En Pago "P", Socio 1 recibe = +1)
  const signo1 = tipoOp === 'P' ? 1 : -1;

  const divisorTasa1 = tasa1Efectiva > 0 ? tasa1Efectiva : 1.0;

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
    const factor2Abs = Math.abs(parseFloat(rawFactor2)) || 1.0;
    const tasaBaseSocio2USDT = parseFloat(mapaTasas[monedaSocio2] || 1.0);

    // Tasa comercial T2 - SIEMPRE POSITIVA
    const tasaBaseCalculada2 = tasaBaseRawUSDT / (tasaBaseSocio2USDT > 0 ? tasaBaseSocio2USDT : 1.0);
    const crossBase2 = tasaBaseCalculada2 * factor2Abs;
    tasa2Efectiva = truncarTasaSegura(crossBase2);

    // Espejo contable opuesto (En Pago "P", Socio 2 paga = -1)
    const signo2 = -1 * signo1;

    const divisorTasa2 = tasa2Efectiva > 0 ? tasa2Efectiva : 1.0;

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
