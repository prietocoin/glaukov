const db = require('../../../config/db');
const { truncarTasaOficial, obtenerFechaHoraVE, extractJid } = require('../../../utils/formatters');
const { BANDERAS_MAP, MAPA_MONEDAS, FACTORES_RESPALDO } = require('./mapper.service');
const { Queue } = require('bullmq');
const redisConnection = require('../../../config/redis');

const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

function parseCartelera(rawInput) {
  if (!rawInput) return [];
  if (Array.isArray(rawInput)) return rawInput;
  if (typeof rawInput === 'object') return rawInput;
  if (typeof rawInput === 'string') {
    const str = rawInput.trim();
    if (!str) return [];
    if (str.startsWith('[') || (str.startsWith('{') && str.includes('"'))) {
      try { return JSON.parse(str); } catch (e) {}
    }
    if (str.startsWith('{') && str.endsWith('}')) {
      const limpio = str.slice(1, -1).trim();
      if (!limpio) return [];
      return limpio.split(',').map(s => s.replace(/^"|"$/g, '').trim());
    }
    if (str.includes(',')) {
      return str.split(',').map(s => s.trim());
    }
    return [str];
  }
  return [];
}

async function obtenerSociosYProcesarTasas(filtroNombre = null) {
  // 🟢 1. Obtener la última tasa y la penúltima desde la nueva tabla 'tasas_glaukov'
  const sqlTasas = `
    SELECT id_tasa, tasas, created_at 
    FROM tasas_glaukov 
    ORDER BY created_at DESC, id DESC 
    LIMIT 2;
  `;
  const resTasas = await db.query(sqlTasas);

  const loteActual = resTasas.rows[0] || { id_tasa: 'T001', tasas: {} };
  const loteAnterior = resTasas.rows[1] || loteActual;

  const tasasMercado = typeof loteActual.tasas === 'string' ? JSON.parse(loteActual.tasas || '{}') : (loteActual.tasas || {});
  const tasasMercadoAnterior = typeof loteAnterior.tasas === 'string' ? JSON.parse(loteAnterior.tasas || '{}') : (loteAnterior.tasas || {});
  const correlativoTasa = loteActual.id_tasa || 'T001';

  // 🟢 2. Obtener lista de socios desde nombres_fb
  const sqlSocios = `SELECT * FROM nombres_fb WHERE COALESCE(activo, TRUE) = TRUE;`;
  const { rows } = await db.query(sqlSocios);
  const timeVE = obtenerFechaHoraVE();
  let listaSociosProcesados = [];

  for (const socioData of rows) {
    const nombre = socioData.nombre || "SOCIO";
    if (!nombre || nombre === 'NOMBRE' || nombre.toUpperCase() === 'GENERAL') continue;

    const labelSocio = socioData.socio || nombre;
    const whatsappJid = extractJid(socioData.whatsapp || socioData.id_grupo || socioData.id_grupo1);

    const valorTasa = correlativoTasa;
    const valorFecha = timeVE.fechaStr;
    const valorHora = timeVE.horaStr;

    const monedaExtraida = String(socioData.monedasocio || "USDT").toUpperCase();
    const monedaProcesada = (monedaExtraida === "USD") ? "USDT" : monedaExtraida;

    const rawCartelera = socioData.cartelerapaises || socioData.cartelera_paises || socioData.paises || socioData.cartelera || socioData.monedas;
    const carteleraParseada = parseCartelera(rawCartelera);

    let paisesNormalizados = [];
    if (Array.isArray(carteleraParseada)) {
      paisesNormalizados = carteleraParseada.map(p => (typeof p === 'string' ? { moneda: p, activo: true } : p));
    } else if (typeof carteleraParseada === 'object' && carteleraParseada !== null) {
      paisesNormalizados = Object.entries(carteleraParseada).map(([key, val]) => {
        if (typeof val === 'object' && val !== null) return { moneda: key, ...val };
        return { moneda: key, activo: Boolean(val) };
      });
    }

    const paisesActivos = paisesNormalizados.filter(p => {
      if (!p) return false;
      if (p.activo === false || p.activo === 'false' || p.activo === 0 || p.activo === '0') return false;
      return true;
    });

    paisesActivos.sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99));

    const ajustes = typeof socioData.ajustes === 'string' ? JSON.parse(socioData.ajustes || '{}') : (socioData.ajustes || {});
    const tarjetasPaises = [];

    // Función para comparar tendencias basada en 4 decimales
    const getTrend = (actualNum, antNum) => {
      const a = parseFloat(actualNum.toFixed(4));
      const b = parseFloat(antNum.toFixed(4));
      if (a > b) return "up";
      if (a < b) return "down";
      return "stable";
    };

    for (const itemPais of paisesActivos) {
      const codeP = (itemPais.moneda || itemPais.code || MAPA_MONEDAS[itemPais.pais || itemPais.nombrePais] || "").toUpperCase();
      const nombreP = itemPais.pais || itemPais.nombrePais || Object.keys(MAPA_MONEDAS).find(k => MAPA_MONEDAS[k] === codeP) || codeP;

      if (!codeP) continue;

      let rawFactorD = ajustes[`D-${codeP}`] || ajustes[`D${codeP}`];
      let rawFactorP = ajustes[`P-${codeP}`] || ajustes[`P${codeP}`];

      if (rawFactorD === undefined || rawFactorD === null) rawFactorD = FACTORES_RESPALDO[codeP]?.D ?? 1.0;
      if (rawFactorP === undefined || rawFactorP === null) rawFactorP = FACTORES_RESPALDO[codeP]?.P ?? 0.95;

      const factorD = Math.abs(parseFloat(rawFactorD) || 0);
      const factorP = Math.abs(parseFloat(rawFactorP) || 0);

      // CÁLCULO ACTUAL
      const tasaBaseDestino = parseFloat(tasasMercado[codeP] || 1.0);
      let tasaBaseSocio = 1.0;
      if (!['USD', 'USDT', 'PYUSD'].includes(monedaProcesada)) tasaBaseSocio = parseFloat(tasasMercado[monedaProcesada] || 1.0);
      if (tasaBaseSocio <= 0) tasaBaseSocio = 1.0;
      const crossBaseActual = tasaBaseDestino / tasaBaseSocio;

      const numCompraActual = crossBaseActual * factorD;
      const numVentaActual = crossBaseActual * factorP;

      // CÁLCULO ANTERIOR (Para comparar)
      const tasaBaseDestinoAnt = parseFloat(tasasMercadoAnterior[codeP] || tasaBaseDestino);
      let tasaBaseSocioAnt = 1.0;
      if (!['USD', 'USDT', 'PYUSD'].includes(monedaProcesada)) tasaBaseSocioAnt = parseFloat(tasasMercadoAnterior[monedaProcesada] || tasaBaseSocio);
      if (tasaBaseSocioAnt <= 0) tasaBaseSocioAnt = 1.0;
      const crossBaseAnt = tasaBaseDestinoAnt / tasaBaseSocioAnt;

      const numCompraAnt = crossBaseAnt * factorD;
      const numVentaAnt = crossBaseAnt * factorP;

      // FORMATEO FINAL Y ASIGNACIÓN DE TENDENCIAS
      const valCompraStr = (factorD > 0) ? truncarTasaOficial(numCompraActual) : "-";
      const valVentaStr = (factorP > 0) ? truncarTasaOficial(numVentaActual) : "-";

      tarjetasPaises.push({
        bandera: BANDERAS_MAP[codeP] || '🌐',
        nombre_pais: `${nombreP} (${codeP})`,
        compra: valCompraStr,
        venta: valVentaStr,
        trend_compra: (factorD > 0) ? getTrend(numCompraActual, numCompraAnt) : 'stable',
        trend_venta: (factorP > 0) ? getTrend(numVentaActual, numVentaAnt) : 'stable'
      });
    }

    listaSociosProcesados.push({
      nombre_socio: labelSocio,
      remoteJid: whatsappJid,
      hora_actualizacion: valorHora,
      tasa_base_ref: `${valorTasa} ${valorFecha}`,
      tarjetas_paises: tarjetasPaises
    });
  }

  // 🛡️ CORRECCIÓN DE TIPO: Garantizar que filtroNombre sea una cadena antes de hacer .trim()
  if (filtroNombre && typeof filtroNombre === 'string') {
    const busqueda = filtroNombre.trim().toLowerCase();
    listaSociosProcesados = listaSociosProcesados.filter(s => s.nombre_socio.toLowerCase().includes(busqueda));
  }

  return listaSociosProcesados;
}

// 🟢 FUNCIÓN CORREGIDA PARA ACEPTAR TANTO CADENAS COMO OBJETOS DE OPCIONES
async function encolarNotificacionesTasas(options = null) {
  let filtroNombre = null;
  let jidOverride = null;

  if (typeof options === 'string') {
    filtroNombre = options;
  } else if (typeof options === 'object' && options !== null) {
    filtroNombre = options.filtroNombre || options.socio || null;
    jidOverride = options.jidOverride || options.destinationJid || null;
  }

  const socios = await obtenerSociosYProcesarTasas(filtroNombre);
  console.log(`[Glaukov Atenea 🚀] Encolando ${socios.length} socio(s) para renderizado...`);
  
  for (const socio of socios) {
    const payloadJob = {
      ...socio,
      remoteJid: jidOverride || socio.remoteJid
    };
    await tasasQueue.add('render-tasa-socio', payloadJob, { removeOnComplete: true, attempts: 3 });
  }
  return { totalEncolados: socios.length, socios: socios.map(s => s.nombre_socio) };
}

module.exports = { 
  obtenerSociosYProcesarTasas,
  obtenerCarteleraConsolidada: obtenerSociosYProcesarTasas,
  encolarNotificacionesTasas,
  dispararPublicacionCartelera: encolarNotificacionesTasas
};
