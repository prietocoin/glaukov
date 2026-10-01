const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Calcula el snapshot contable respetando la divisa nativa de cada socio
 */
function calcularSnapshotFinanciero(raw, socio1Data, socio2Data, tasaLote) {
  const montoRaw = Math.abs(parseFloat(raw.monto) || 0);
  const divisaRaw = (raw.moneda || 'USDT').toUpperCase();
  const tipoOp = (raw.tipo_manual || raw.tipo_op || 'D').toUpperCase().charAt(0);

  // Fallback seguro del lote asignado en el comprobante
  const loteCodigo = raw.id_tasa || tasaLote?.id_tasa || 'T052';
  const mapaTasas = tasaLote?.tasas || {};

  const tasaBaseRawUSDT = parseFloat(mapaTasas[divisaRaw] || 1.0);

  // --- SOCIO 1 ---
  const monedaSocio1 = (socio1Data?.moneda_socio || 'USDT').toUpperCase();
  const aj1 = typeof socio1Data?.ajustes === 'string' 
    ? JSON.parse(socio1Data.ajustes || '{}') 
    : (socio1Data?.ajustes || {});
  
  // Buscar el factor respetando la regla asignada (P-COP, D-COP o la divisa directa)
  const rawFactor1 = aj1[`${tipoOp}-${divisaRaw}`] ?? aj1[divisaRaw] ?? 1.0;
  const factor1 = Math.abs(parseFloat(rawFactor1) || 1.0);
  const tasaBaseSocio1USDT = parseFloat(mapaTasas[monedaSocio1] || 1.0);

  // Tasa comercial T1 (Divisa Comprobante -> Moneda Socio 1)
  const crossBase1 = (tasaBaseRawUSDT / (tasaBaseSocio1USDT > 0 ? tasaBaseSocio1USDT : 1.0)) * factor1;
  const tasa1Efectiva = aplicarReglaPrecisionTasa(crossBase1);

  // Respetar el signo según la lógica de la operación (Pago = -1, Depósito = 1)
  const signo1 = tipoOp === 'P' ? -1 : 1;

  // M1: Monto nominal en divisa nativa del Socio 1 (ej. USDT)
  const m1Nominal = aplicarPrecisionMonto(signo1 * (montoRaw / (tasa1Efectiva > 0 ? tasa1Efectiva : 1.0)));

  // ME1: Equivalente SIEMPRE en USDT (M1 / tasaBaseSocio1USDT)
  const me1USDT = aplicarPrecisionMonto(m1Nominal / (tasaBaseSocio1USDT > 0 ? tasaBaseSocio1USDT : 1.0));


  // --- SOCIO 2 (Contraparte) ---
  let tasa2Efectiva = 1.0;
  let m2Nominal = 0;
  let me2USDT = 0;

  if (socio2Data && socio2Data.nombre && socio2Data.nombre !== 'GENERAL') {
    const monedaSocio2 = (socio2Data?.moneda_socio || 'USDT').toUpperCase();
    const aj2 = typeof socio2Data?.ajustes === 'string' 
      ? JSON.parse(socio2Data.ajustes || '{}') 
      : (socio2Data?.ajustes || {});

    const rawFactor2 = aj2[`${tipoOp}-${divisaRaw}`] ?? aj2[divisaRaw] ?? 1.0;
    const factor2 = Math.abs(parseFloat(rawFactor2) || 1.0);
    const tasaBaseSocio2USDT = parseFloat(mapaTasas[monedaSocio2] || 1.0);

    // Tasa comercial T2 (Divisa Comprobante -> Moneda Socio 2)
    const crossBase2 = (tasaBaseRawUSDT / (tasaBaseSocio2USDT > 0 ? tasaBaseSocio2USDT : 1.0)) * factor2;
    tasa2Efectiva = aplicarReglaPrecisionTasa(crossBase2);

    const signo2 = -1 * signo1; // Espejo contable opuesto

    // M2: Monto nominal en divisa nativa del Socio 2
    m2Nominal = aplicarPrecisionMonto(signo2 * (montoRaw / (tasa2Efectiva > 0 ? tasa2Efectiva : 1.0)));

    // ME2: Equivalente SIEMPRE en USDT
    me2USDT = aplicarPrecisionMonto(m2Nominal / (tasaBaseSocio2USDT > 0 ? tasaBaseSocio2USDT : 1.0));
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
