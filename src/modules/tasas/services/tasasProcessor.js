/**
 * @file tasasProcessor.js
 * @description Orquestador principal del dominio de tasas.
 * Lee de BD, procesa tarjetas de divisas por socio y prepara la estructura final.
 */

const db = require('../../../config/db');
const { extractJid, obtenerFechaHoraVE } = require('../../../utils/formatters');
const { obtenerLotesTasas } = require('../queries/tasasQuery');
const { calcularTarjetaPais } = require('../calculators/crossRateCalculator');

function normalizarMapTasas(rawObj) {
  const map = typeof rawObj === 'string' ? JSON.parse(rawObj || '{}') : (rawObj || {});
  const res = {};
  for (const [k, v] of Object.entries(map)) {
    if (k) res[k.toUpperCase().trim()] = parseFloat(v) || 1.0;
  }
  return res;
}

async function obtenerSociosYProcesarTasas(options = null) {
  const filtroNombre = typeof options === 'string' ? options : options?.filtroNombre || options?.socio;
  const idTasaReq = typeof options === 'object' ? options?.id_tasa || options?.lote_tasa : null;

  const { loteActual, loteAnterior } = await obtenerLotesTasas(idTasaReq);
  const tasasActual = normalizarMapTasas(loteActual.tasas);
  const tasasAnterior = normalizarMapTasas(loteAnterior.tasas);

  const { rows } = await db.query(`SELECT * FROM perfiles_glaukov WHERE (mostrar->>'tasas')::boolean = TRUE;`);
  const timeVE = obtenerFechaHoraVE();
  let resultado = [];

  for (const socio of rows) {
    const nombre = socio.nombre || 'SOCIO';
    if (!nombre || ['NOMBRE', 'GENERAL'].includes(nombre.toUpperCase())) continue;

    const monedaBase = String(socio.moneda_base || 'USDT').toUpperCase().trim();
    const monedaProcesada = monedaBase === 'USD' ? 'USDT' : monedaBase;
    const configMonedas = typeof socio.monedas === 'object' && socio.monedas !== null ? socio.monedas : {};

    const tarjetasPaises = [];
    for (const [codeP, cfg] of Object.entries(configMonedas)) {
      if (!cfg.activo) continue;
      tarjetasPaises.push(calcularTarjetaPais(codeP, cfg, tasasActual, tasasAnterior, monedaProcesada));
    }
    tarjetasPaises.sort((a, b) => a.orden - b.orden || a.nombre_pais.localeCompare(b.nombre_pais));

    resultado.push({
      nombre_socio: nombre,
      moneda_socio: monedaProcesada,
      remoteJid: extractJid(socio.id_grupo),
      lote_tasa: loteActual.id_tasa || 'T001',
      hora_actualizacion: timeVE.horaStr,
      tasa_base_ref: `${loteActual.id_tasa} ${timeVE.fechaStr}`,
      tarjetas_paises: tarjetasPaises,
      cartelera_paises: tarjetasPaises
    });
  }

  if (filtroNombre) {
    const busq = filtroNombre.trim().toLowerCase();
    resultado = resultado.filter(s => s.nombre_socio.toLowerCase().includes(busq));
  }

  return resultado;
}

module.exports = { obtenerSociosYProcesarTasas };
