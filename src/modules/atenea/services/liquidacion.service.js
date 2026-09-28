const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Calcula el snapshot contable inmutable con Tasas Comerciales Directas (Vista Cartelera)
 */
function calcularSnapshotFinanciero(raw, socio1Data, socio2Data, tasaLote) {
  const montoRaw = Math.abs(parseFloat(raw.monto) || 0);
  const divisaRaw = (raw.moneda || 'USDT').toUpperCase();
  const tipoOp = (raw.tipo_manual || raw.tipo_op || 'D').toUpperCase().charAt(0); // 'D', 'P', 'A'

  const loteCodigo = tasaLote?.id_tasa || 'T041';
  const mapaTasas = tasaLote?.tasas || { USD: 1.0, USDT: 1.0, PEN: 3.75, COP: 3900.0 };

  // Tasa base de la divisa del comprobante frente a USDT (ej. COP = 3253)
  const tasaBaseRawUSDT = parseFloat(mapaTasas[divisaRaw] || 1.0);

  // --- SOCIO 1 ---
  const monedaSocio1 = (socio1Data?.moneda_socio || 'USDT').toUpperCase();
  const aj1 = typeof socio1Data?.ajustes === 'string' 
    ? JSON.parse(socio1Data.ajustes || '{}') 
    : (socio1Data?.ajustes || {});
  
  // Factor siempre positivo para mantener la tasa comercial limpia
  const factor1 = Math.abs(parseFloat(aj1[`${tipoOp}-${divisaRaw}`]) || 1.0);
  const tasaBaseSocio1USDT = parseFloat(mapaTasas[monedaSocio1] || 1.0);

  // Tasa Comercial Directa T1 (ej. COP/USDT = 3253)
  const crossBase1 = tasaBaseRawUSDT / (tasaBaseSocio1USDT > 0 ? tasaBaseSocio1USDT : 1.0);
  const tasa1Efectiva = aplicarReglaPrecisionTasa(crossBase1 * factor1);

  // Conversión Comercial: Monto Local / Tasa Comercial = USDT
  const me1USDTCalculado = tasa1Efectiva > 0 ? (montoRaw / tasa1Efectiva) : montoRaw;
  const signo1 = tipoOp === 'P' ? -1 : 1;

  const m1Nominal = aplicarPrecisionMonto(signo1 * (monedaSocio1 === 'USDT' ? me1USDTCalculado : me1USDTCalculado * tasaBaseSocio1USDT));
  const me1USDT = aplicarPrecisionMonto(signo1 * me1USDTCalculado);


  // --- SOCIO 2 (Contraparte) ---
  let tasa2Efectiva = 1.0;
  let m2Nominal = 0;
  let me2USDT = 0;

  if (socio2Data && socio2Data.nombre && socio2Data.nombre !== 'GENERAL') {
    const monedaSocio2 = (socio2Data?.moneda_socio || 'USDT').toUpperCase();
    const aj2 = typeof socio2Data?.ajustes === 'string' 
      ? JSON.parse(socio2Data.ajustes || '{}') 
      : (socio2Data?.ajustes || {});

    const factor2 = Math.abs(parseFloat(aj2[`${tipoOp}-${divisaRaw}`]) || 1.0);
    const tasaBaseSocio2USDT = parseFloat(mapaTasas[monedaSocio2] || 1.0);

    // Tasa Comercial Directa T2
    const crossBase2 = tasaBaseRawUSDT / (tasaBaseSocio2USDT > 0 ? tasaBaseSocio2USDT : 1.0);
    tasa2Efectiva = aplicarReglaPrecisionTasa(crossBase2 * factor2);

    const me2USDTCalculado = tasa2Efectiva > 0 ? (montoRaw / tasa2Efectiva) : montoRaw;
    const signo2 = -1 * signo1; // Espejo contable opuesto

    m2Nominal = aplicarPrecisionMonto(signo2 * (monedaSocio2 === 'USDT' ? me2USDTCalculado : me2USDTCalculado * tasaBaseSocio2USDT));
    me2USDT = aplicarPrecisionMonto(signo2 * me2USDTCalculado);
  }

  return {
    hash_largo: raw.hash_largo,
    socio_1: socio1Data?.nombre || 'GENERAL',
    tipo_op1: `${tipoOp}-${divisaRaw}`,
    monto_1: m1Nominal,
    tasa_1: tasa1Efectiva,
    me1: me1USDT,

    socio_2: socio2Data?.nombre && socio2Data.nombre !== 'GENERAL' ? socio2Data.nombre : null,
    tipo_op2: `${tipoOp}-${divisaRaw}`,
    monto_2: m2Nominal,
    tasa_2: tasa2Efectiva,
    me2: me2USDT,

    lote_tasa: loteCodigo
  };
}

module.exports = { calcularSnapshotFinanciero };
