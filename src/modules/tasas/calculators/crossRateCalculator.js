/**
 * @file crossRateCalculator.js
 * @description Lógica aritmética pura para el cálculo de tasas cruzadas basándose 100% en porcentajes (%).
 */

const { truncarTasaOficial } = require('../../../utils/formatters');
const { BANDERAS_MAP, MAPA_MONEDAS } = require('../constants/mapperConstants');

function determinarTendencia(actual, anterior) {
  const a = parseFloat(actual.toFixed(4));
  const b = parseFloat(anterior.toFixed(4));
  if (a > b) return 'up';
  if (a < b) return 'down';
  return 'stable';
}

function obtenerTasaBase(mapaTasas, codigoMoneda) {
  const c = (codigoMoneda || '').toUpperCase().trim();
  if (mapaTasas[c] !== undefined && parseFloat(mapaTasas[c]) > 0) {
    return parseFloat(mapaTasas[c]);
  }
  return 1.0;
}

/**
 * Aplica los porcentajes (%) de depósito y pago sobre la tasa cruzada base.
 */
function calcularTarjetaPais(codeP, configPais, tasasActual, tasasAnterior, monedaProcesada) {
  const nombreP = MAPA_MONEDAS[codeP] || Object.keys(MAPA_MONEDAS).find(k => MAPA_MONEDAS[k] === codeP) || codeP;
  
  // Lectura directa de porcentajes (%) desde la UI
  const pctD = parseFloat(configPais.porcentaje?.deposito) || 0;
  const pctP = parseFloat(configPais.porcentaje?.pago) || 0;

  // Conversión a multiplicadores comerciales
  const multD = 1 + (pctD / 100);
  const multP = 1 - (pctP / 100);

  const crossBaseActual = obtenerTasaBase(tasasActual, codeP) / obtenerTasaBase(tasasActual, monedaProcesada);
  const crossBaseAnt = obtenerTasaBase(tasasAnterior, codeP) / obtenerTasaBase(tasasAnterior, monedaProcesada);

  const numCompraActual = crossBaseActual * multD;
  const numVentaActual = crossBaseActual * multP;

  return {
    bandera: BANDERAS_MAP[codeP] || '🌐',
    nombre_pais: `${nombreP} (${codeP})`,
    compra: multD > 0 ? truncarTasaOficial(numCompraActual) : '-',
    venta: multP > 0 ? truncarTasaOficial(numVentaActual) : '-',
    trend_compra: multD > 0 ? determinarTendencia(numCompraActual, crossBaseAnt * multD) : 'stable',
    trend_venta: multP > 0 ? determinarTendencia(numVentaActual, crossBaseAnt * multP) : 'stable',
    orden: configPais.orden || 99
  };
}

module.exports = { calcularTarjetaPais };
