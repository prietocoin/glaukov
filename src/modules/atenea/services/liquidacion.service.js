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
 * Calcula el snapshot financiero desacoplando la tasa lineal del signo de polaridad del saldo
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

  // 1. POLARIDAD CONTABLE DEL SALDO (+1 o -1): Leída de resta_D_DIVISA o resta_P_DIVISA
  const esResta1 = aj1[`resta_${tipoOp}_${divisaRaw}`] ?? (tipoOp === 'D');
  const signo1 = esResta1 ? -1 : 1;

  // 2. FACTOR DE TASA LINEAL FIJO (Depósito SUMA %, Pago RESTA %)
  const pct1 = Math.abs(parseFloat(aj1[`pct_${tipoOp}_${divisaRaw}`]) || 0);
  let factor1Abs;
  if (aj1[`pct_${tipoOp}_${divisaRaw}`] !== undefined) {
    factor1Abs = tipoOp === 'D' ? (1 + (pct1 / 100)) : (1 - (pct1 / 100));
  } else {
    factor1Abs = Math.abs(parseFloat(aj1[`${tipoOp}-${divisaRaw}`] ?? aj1[`factor_${tipoOp}_${divisaRaw}`] ?? 1.0)) || 1.0;
  }

  const tasaBaseSocio1USDT = parseFloat(mapaTasas[monedaSocio1] || 1.0);

  // Tasa comercial T1 (Divisa Comprobante -> Moneda Socio 1) - SIEMPRE POSITIVA
  const tasaBaseCalculada1 = tasaBaseRawUSDT / (tasaBaseSocio1USDT > 0 ? tasaBaseSocio1USDT : 1.0);
  const crossBase1 = tasaBaseCalculada1 * factor1Abs;
  const tasa1Efectiva = truncarTasaSegura(crossBase1);

  const divisorTasa1 = tasa1Efectiva > 0 ? tasa1Efectiva : 1.0;

  // M1: Monto nominal en divisa nativa del Socio 1 con el signo contable de la polaridad
  const m1Nominal = truncarMontoSeguro(signo1 * (montoRaw / divisorTasa1));

  // ME1: Equivalente en USDT
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

    const tipoOp2 = tipoOp;
    // 1. POLARIDAD CONTABLE DEL SALDO SOCIO 2
    const esResta2 = aj2[`resta_${tipoOp2}_${divisaRaw}`] ?? (tipoOp2 === 'D');
    const signo2 = esResta2 ? -1 : 1;

    // 2. FACTOR DE TASA LINEAL SOCIO 2
    const pct2 = Math.abs(parseFloat(aj2[`pct_${tipoOp2}_${divisaRaw}`]) || 0);
    let factor2Abs;
    if (aj2[`pct_${tipoOp2}_${divisaRaw}`] !== undefined) {
      factor2Abs = tipoOp2 === 'D' ? (1 + (pct2 / 100)) : (1 - (pct2 / 100));
    } else {
      factor2Abs = Math.abs(parseFloat(aj2[`${tipoOp2}-${divisaRaw}`] ?? aj2[`factor_${tipoOp2}_${divisaRaw}`] ?? 1.0)) || 1.0;
    }

    const tasaBaseSocio2USDT = parseFloat(mapaTasas[monedaSocio2] || 1.0);

    const tasaBaseCalculada2 = tasaBaseRawUSDT / (tasaBaseSocio2USDT > 0 ? tasaBaseSocio2USDT : 1.0);
    const crossBase2 = tasaBaseCalculada2 * factor2Abs;
    tasa2Efectiva = truncarTasaSegura(crossBase2);

    const divisorTasa2 = tasa2Efectiva > 0 ? tasa2Efectiva : 1.0;

    m2Nominal = truncarMontoSeguro(signo2 * (montoRaw / divisorTasa2));

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
    tipo_op2: `${tipoOp === 'D' ? 'P' : 'D'}-${divisaRaw}`,
    monto_2: isNaN(m2Nominal) ? 0 : m2Nominal,
    tasa_2: isNaN(tasa2Efectiva) ? 1.0 : tasa2Efectiva,
    me2: isNaN(me2USDT) ? 0 : me2USDT,

    lote_tasa: loteCodigo
  };
}

module.exports = { calcularSnapshotFinanciero };
