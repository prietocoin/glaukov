/**
 * @file crossRateCalculator.js
 * @description Lógica aritmética pura para el cálculo de tasas cruzadas y tendencias.
 * Sin llamadas a base de datos ni peticiones HTTP.
 */

const { truncarTasaOficial } = require('../../../utils/formatters');
const { BANDERAS_MAP, MAPA_MONEDAS, FACTORES_RESPALDO } = require('../services/mapper.service');

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
 * Calcula la tarjeta de tasa comercial para una moneda de un socio.
 */
function calcularTarjetaPais(codeP, configPais, tasasActual, tasasAnterior, monedaProcesada) {
  const nombreP = MAPA_MONEDAS[codeP] || Object.keys(MAPA_MONEDAS).find(k => MAPA_MONEDAS[k] === codeP) || codeP;
  const pctD = configPais.porcentaje?.deposito ?? null;
  const pctP = configPais.porcentaje?.pago ?? null;

  const factorD = pctD !== null && !isNaN(pctD) ? 1 + (pctD / 100) : (FACTORES_RESPALDO[codeP]?.D ?? 1.0);
  const factorP = pctP !== null && !isNaN(pctP) ? 1 - (pctP / 100) : (FACTORES_RESPALDO[codeP]?.P ?? 0.95);

  const crossBaseActual = obtenerTasaBase(tasasActual, codeP) / obtenerTasaBase(tasasActual, monedaProcesada);
  const crossBaseAnt = obtenerTasaBase(tasasAnterior, codeP) / obtenerTasaBase(tasasAnterior, monedaProcesada);

  const numCompraActual = crossBaseActual * factorD;
  const numVentaActual = crossBaseActual * factorP;

  return {
    bandera: BANDERAS_MAP[codeP] || '🌐',
    nombre_pais: `${nombreP} (${codeP})`,
    compra: factorD > 0 ? truncarTasaOficial(numCompraActual) : '-',
    venta: factorP > 0 ? truncarTasaOficial(numVentaActual) : '-',
    trend_compra: factorD > 0 ? determinarTendencia(numCompraActual, crossBaseAnt * factorD) : 'stable',
    trend_venta: factorP > 0 ? determinarTendencia(numVentaActual, crossBaseAnt * factorP) : 'stable',
    orden: configPais.orden || 99
  };
}

module.exports = { calcularTarjetaPais };
