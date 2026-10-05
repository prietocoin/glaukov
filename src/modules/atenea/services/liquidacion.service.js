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
 * Calcula el snapshot financiero respetando que el tipo ('D'/'P') y la divisa pertenecen
 * al comprobante, mientras que la polaridad y el porcentaje son del socio.
 */
function calcularSnapshotFinanciero(raw, socio1Data, socio2Data, tasaLote) {
  const montoRaw = Math.abs(parseFloat(String(raw?.monto || 0).replace(/,/g, '')) || 0);
  const divisaRaw = String(raw?.moneda || 'USDT').toUpperCase().trim();
  const tipoOp = String(raw?.tipo_manual || raw?.tipo_op || 'D').toUpperCase().trim().charAt(0); // 'D' o 'P'

  const loteCodigo = raw?.id_tasa || tasaLote?.id_tasa || 'T052';
  const mapaTasas = tasaLote?.tasas || {};
  const tasaBaseRawUSDT = parseFloat(mapaTasas[divisaRaw] || 1.0);

  const procesarLadoSocio = (socioData) => {
    if (!socioData || !socioData.nombre || socioData.nombre.toUpperCase() === 'GENERAL') {
      return { mNominal: 0, meUSDT: 0, tasaEfectiva: 1.0 };
    }

    const monedaSocio = String(socioData.moneda_base || socioData.moneda_socio || 'USDT').toUpperCase().trim();
    const monedasConfig = typeof socioData.monedas === 'object' && socioData.monedas !== null
      ? socioData.monedas 
      : {};
    
    const confDivisa = monedasConfig[divisaRaw] || { 
      activo: true, 
      polaridad: '+', 
      porcentaje: { deposito: 0, pago: 0 } 
    };

    // 🟢 1. POLARIDAD CONTABLE
    // 'polaridad' define el comportamiento ante un Depósito ('D'). 'P' invierte la polaridad del socio.
    const depositoSuma = confDivisa.polaridad === '+' || confDivisa.polaridad === undefined;
    let signoMonto;
    if (tipoOp === 'D') {
      signoMonto = depositoSuma ? 1 : -1;
    } else { // 'P'
      signoMonto = depositoSuma ? -1 : 1;
    }

    // 🟢 2. FACTOR COMERCIAL DE TASA
    const pctD = Math.abs(confDivisa.porcentaje?.deposito || 0);
    const pctP = Math.abs(confDivisa.porcentaje?.pago || 0);
    const factorAbs = tipoOp === 'D' ? (1 + (pctD / 100)) : (1 - (pctP / 100));

    // 🟢 3. CRUCE DE TASAS
    const tasaBaseSocioUSDT = parseFloat(mapaTasas[monedaSocio] || 1.0);
    const divisorBase = tasaBaseSocioUSDT > 0 ? tasaBaseSocioUSDT : 1.0;
    const tasaBaseCalculada = tasaBaseRawUSDT / divisorBase;

    const tasaEfectiva = truncarTasaSegura(tasaBaseCalculada * factorAbs);
    const divisorTasa = tasaEfectiva > 0 ? tasaEfectiva : 1.0;

    // 🟢 4. CÁLCULO DE SALDOS
    const mNominal = truncarMontoSeguro(signoMonto * (montoRaw / divisorTasa));
    const meUSDT = truncarMontoSeguro(mNominal / divisorBase);

    return { mNominal, meUSDT, tasaEfectiva };
  };

  const calc1 = procesarLadoSocio(socio1Data);
  const calc2 = procesarLadoSocio(socio2Data);

  const etiquetaOpComprobante = `${tipoOp}-${divisaRaw}`;

  return {
    hash_largo: raw.hash_largo,
    socio_1: socio1Data?.nombre || 'GENERAL',
    tipo_op1: etiquetaOpComprobante,
    monto_1: isNaN(calc1.mNominal) ? 0 : calc1.mNominal,
    tasa_1: isNaN(calc1.tasaEfectiva) ? 1.0 : calc1.tasaEfectiva,
    me1: isNaN(calc1.meUSDT) ? 0 : calc1.meUSDT,

    socio_2: socio2Data?.nombre && socio2Data.nombre.toUpperCase() !== 'GENERAL' ? socio2Data.nombre : null,
    tipo_op2: etiquetaOpComprobante, // 🟢 La etiqueta de operación es idéntica
    monto_2: isNaN(calc2.mNominal) ? 0 : calc2.mNominal,
    tasa_2: isNaN(calc2.tasaEfectiva) ? 1.0 : calc2.tasaEfectiva,
    me2: isNaN(calc2.meUSDT) ? 0 : calc2.meUSDT,

    lote_tasa: loteCodigo
  };
}

module.exports = { calcularSnapshotFinanciero };
