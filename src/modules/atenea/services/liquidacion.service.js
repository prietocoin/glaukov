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
 * Calcula el snapshot financiero resolviendo las reglas de Abono Imperativo,
 * Herencia de FUNDDA y Polaridad Estricta de perfiles_glaukov.
 * 
 * @param {Object} funddaData - El perfil de FUNDDA (requerido para la herencia)
 */
function calcularSnapshotFinanciero(raw, socio1Data, socio2Data, tasaLote, funddaData = null) {
  const montoRaw = Math.abs(parseFloat(String(raw?.monto || 0).replace(/,/g, '')) || 0);
  const divisaRaw = String(raw?.moneda || 'USDT').toUpperCase().trim();
  let tipoOpBase = String(raw?.tipo_manual || raw?.tipo_op || 'D').toUpperCase().trim().charAt(0);

  const monedaSocio1 = String(socio1Data?.moneda_base || socio1Data?.moneda_socio || 'USDT').toUpperCase().trim();

  // 🟢 REGLA 1: ABONO IMPERATIVO [A]
  // Si la moneda del comprobante es igual a la moneda base del Socio 1 (Impacto), se fuerza Abono.
  if (monedaSocio1 === divisaRaw && socio1Data?.nombre && socio1Data.nombre.toUpperCase() !== 'GENERAL') {
    tipoOpBase = 'A';
  }

  const loteCodigo = raw?.id_tasa || tasaLote?.id_tasa || 'T052';
  const mapaTasas = tasaLote?.tasas || {};
  const tasaBaseRawUSDT = parseFloat(mapaTasas[divisaRaw] || 1.0);

  // --- FASE 1: RESOLVER HERENCIA DE CONTRATOS ---
  const getSocioConfig = (socioData) => {
    if (!socioData || !socioData.nombre || socioData.nombre.toUpperCase() === 'GENERAL') {
      return { activo: false, confDivisa: null, hereda: false, monedaSocio: 'USDT' };
    }
    
    const hereda = Boolean(socioData.herencia);
    let monedasConfig = {};

    // 🟢 REGLA 2: HERENCIA DE FUNDDA
    if (hereda && funddaData) {
      monedasConfig = typeof funddaData.monedas === 'object' && funddaData.monedas !== null ? funddaData.monedas : {};
    } else {
      monedasConfig = typeof socioData.monedas === 'object' && socioData.monedas !== null ? socioData.monedas : {};
    }

    const confDivisa = monedasConfig[divisaRaw] || { activo: true, polaridad: '+', porcentaje: { deposito: 0, pago: 0 } };
    const monedaSocio = String(socioData.moneda_base || socioData.moneda_socio || 'USDT').toUpperCase().trim();

    return { activo: true, confDivisa, hereda, monedaSocio };
  };

  const cfg1 = getSocioConfig(socio1Data);
  const cfg2 = getSocioConfig(socio2Data);

  // --- FASE 2: ASIGNACIÓN DE POLARIDAD ESTRICTA ---
  let signo1 = 1;
  let signo2 = 1;

  if (tipoOpBase === 'A') {
    // Abono: Socio 1 es SIEMPRE (+), Socio 2 es SIEMPRE (-)
    signo1 = 1;
    signo2 = -1;
  } else {
    // Depósitos ('D') y Pagos ('P'):
    // Siguen ESTRICTAMENTE la polaridad del perfil ('+' => +1, '-' => -1)
    signo1 = (cfg1.confDivisa?.polaridad === '-') ? -1 : 1;
    signo2 = (cfg2.confDivisa?.polaridad === '-') ? -1 : 1;
  }

  // --- FASE 3: APLICAR MATEMÁTICAS ---
  const calcularLado = (cfg, signoFinal) => {
    if (!cfg.activo) return { mNominal: 0, meUSDT: 0, tasaEfectiva: 1.0 };

    const pctD = Math.abs(cfg.confDivisa.porcentaje?.deposito || 0);
    const pctP = Math.abs(cfg.confDivisa.porcentaje?.pago || 0);

    // Para el spread, 'D' y 'A' aplican depósito, 'P' aplica pago
    const factorAbs = (tipoOpBase === 'D' || tipoOpBase === 'A') ? (1 + (pctD / 100)) : (1 - (pctP / 100));

    const tasaBaseSocioUSDT = parseFloat(mapaTasas[cfg.monedaSocio] || 1.0);
    const divisorBase = tasaBaseSocioUSDT > 0 ? tasaBaseSocioUSDT : 1.0;
    const tasaBaseCalculada = tasaBaseRawUSDT / divisorBase;

    const tasaEfectiva = truncarTasaSegura(tasaBaseCalculada * factorAbs);
    const divisorTasa = tasaEfectiva > 0 ? tasaEfectiva : 1.0;

    const mNominal = truncarMontoSeguro(signoFinal * (montoRaw / divisorTasa));
    const meUSDT = truncarMontoSeguro(mNominal / divisorBase);

    return { mNominal, meUSDT, tasaEfectiva };
  };

  const calc1 = calcularLado(cfg1, signo1);
  const calc2 = calcularLado(cfg2, signo2);

  const etiquetaOpComprobante = `${tipoOpBase}-${divisaRaw}`; // Ej: A-USDT, D-COP

  return {
    hash_largo: raw.hash_largo,
    socio_1: socio1Data?.nombre || 'GENERAL',
    tipo_op1: etiquetaOpComprobante,
    monto_1: isNaN(calc1.mNominal) ? 0 : calc1.mNominal,
    tasa_1: isNaN(calc1.tasaEfectiva) ? 1.0 : calc1.tasaEfectiva,
    me1: isNaN(calc1.meUSDT) ? 0 : calc1.meUSDT,

    socio_2: socio2Data?.nombre && socio2Data.nombre.toUpperCase() !== 'GENERAL' ? socio2Data.nombre : null,
    tipo_op2: etiquetaOpComprobante,
    monto_2: isNaN(calc2.mNominal) ? 0 : calc2.mNominal,
    tasa_2: isNaN(calc2.tasaEfectiva) ? 1.0 : calc2.tasaEfectiva,
    me2: isNaN(calc2.meUSDT) ? 0 : calc2.meUSDT,

    lote_tasa: loteCodigo
  };
}

module.exports = { calcularSnapshotFinanciero };
