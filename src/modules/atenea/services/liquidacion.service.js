const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Calcula el snapshot contable completo para un comprobante
 * @param {Object} raw Datos brutos de comprobantes_raw
 * @param {Object} socio1Data Registro de nombres_fb para Socio 1
 * @param {Object} socio2Data Registro de nombres_fb para Socio 2
 * @param {Object} tasaLote Objeto del lote activo (id_tasa, mapa de tasas base)
 */
function calcularSnapshotFinanciero(raw, socio1Data, socio2Data, tasaLote) {
  const montoRaw = Math.abs(parseFloat(raw.monto) || 0);
  const divisaRaw = (raw.moneda || 'USDT').toUpperCase();
  const tipoOp = (raw.tipo_manual || raw.tipo_op || 'D').toUpperCase().charAt(0); // 'D', 'P', 'A'

  const loteCodigo = tasaLote?.id_tasa || 'T041';
  const mapaTasas = tasaLote?.tasas || { USD: 1.0, USDT: 1.0, PEN: 3.75, COP: 3900.0 };

  // 1. Tasa base de la divisa del comprobante frente a USDT
  const tasaBaseRawUSDT = parseFloat(mapaTasas[divisaRaw] || 1.0);

  // --- SOCIO 1 ---
  const monedaSocio1 = (socio1Data?.moneda_socio || 'USDT').toUpperCase();
  const aj1 = typeof socio1Data?.ajustes === 'string' 
    ? JSON.parse(socio1Data.ajustes || '{}') 
    : (socio1Data?.ajustes || {});
  
  const factor1 = parseFloat(aj1[`${tipoOp}-${divisaRaw}`]) || 1.0;
  const tasaBaseSocio1USDT = parseFloat(mapaTasas[monedaSocio1] || 1.0);

  // Tasa cruzada efectiva T1: (Divisa Comprobante -> Divisa Nativa Socio 1) * Factor
  const crossBase1 = tasaBaseRawUSDT / (tasaBaseSocio1USDT > 0 ? tasaBaseSocio1USDT : 1.0);
  const tasa1Efectiva = aplicarReglaPrecisionTasa(crossBase1 * factor1);

  // M1: Monto nominal en divisa nativa del Socio 1
  const m1Nominal = aplicarPrecisionMonto(montoRaw * (tasa1Efectiva > 0 ? tasa1Efectiva : 1.0));

  // ME1: Equivalente SIEMPRE a USDT
  const me1USDT = aplicarPrecisionMonto((montoRaw / (tasaBaseRawUSDT > 0 ? tasaBaseRawUSDT : 1.0)) * factor1);


  // --- SOCIO 2 (Contraparte) ---
  const monedaSocio2 = (socio2Data?.moneda_socio || 'USDT').toUpperCase();
  const aj2 = typeof socio2Data?.ajustes === 'string' 
    ? JSON.parse(socio2Data.ajustes || '{}') 
    : (socio2Data?.ajustes || {});

  const factor2 = parseFloat(aj2[`${tipoOp}-${divisaRaw}`]) || 1.0;
  const tasaBaseSocio2USDT = parseFloat(mapaTasas[monedaSocio2] || 1.0);

  // Tasa cruzada efectiva T2: (Divisa Comprobante -> Divisa Nativa Socio 2) * Factor
  const crossBase2 = tasaBaseRawUSDT / (tasaBaseSocio2USDT > 0 ? tasaBaseSocio2USDT : 1.0);
  const tasa2Efectiva = aplicarReglaPrecisionTasa(crossBase2 * factor2);

  // M2: Monto nominal en divisa nativa del Socio 2 (reflejo contable)
  const m2Nominal = aplicarPrecisionMonto(-1 * montoRaw * (tasa2Efectiva > 0 ? tasa2Efectiva : 1.0));

  // ME2: Equivalente SIEMPRE a USDT
  const me2USDT = aplicarPrecisionMonto(-1 * (montoRaw / (tasaBaseRawUSDT > 0 ? tasaBaseRawUSDT : 1.0)) * factor2);

  return {
    hash_largo: raw.hash_largo,
    socio_1: socio1Data?.nombre || 'GENERAL',
    tipo_op1: `${tipoOp}-${divisaRaw}`,
    monto_1: m1Nominal,
    tasa_1: tasa1Efectiva,
    me1: me1USDT,

    socio_2: socio2Data?.nombre || 'GENERAL',
    tipo_op2: `${tipoOp}-${divisaRaw}`,
    monto_2: m2Nominal,
    tasa_2: tasa2Efectiva,
    me2: me2USDT,

    lote_tasa: loteCodigo
  };
}

module.exports = { calcularSnapshotFinanciero };
