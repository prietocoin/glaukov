const db = require('../../../config/db');
const { truncarTasaOficial, obtenerFechaHoraVE, extractJid } = require('../../../utils/formatters');
const { BANDERAS_MAP, MAPA_MONEDAS, FACTORES_RESPALDO } = require('./mapper.service');
const { Queue } = require('bullmq');
const redisConnection = require('../../../config/redis');

const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

tasasQueue.on('error', (err) => {
  console.error('❌ [BullMQ tasasQueue] Error en la cola de Redis:', err.message);
});

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

/**
 * Normaliza las llaves de un objeto de tasas a MAYÚSCULAS para evitar undefined
 */
function normalizarMapTasas(tasasObj) {
  const rawMap = typeof tasasObj === 'string' ? JSON.parse(tasasObj || '{}') : (tasasObj || {});
  const mapNormalizado = {};
  for (const [k, v] of Object.entries(rawMap)) {
    if (k) mapNormalizado[k.toUpperCase().trim()] = parseFloat(v) || 1.0;
  }
  return mapNormalizado;
}

/**
 * Obtiene la tasa base global de una divisa.
 * Garantiza que divisas dolarizadas (USD, USDT, PYUSD, ECU, PAN) retornen 1.0 si no están en el mapa.
 */
function getTasaBaseMercado(mapa, code) {
  const c = (code || '').toUpperCase().trim();
  if (mapa[c] !== undefined && parseFloat(mapa[c]) > 0) {
    return parseFloat(mapa[c]);
  }
  if (['USD', 'USDT', 'PYUSD', 'ECU', 'PAN'].includes(c)) {
    return 1.0;
  }
  return 1.0;
}

async function obtenerSociosYProcesarTasas(options = null) {
  let filtroNombre = null;
  let idTasaRequerida = null;

  // 🟢 Normalización de parámetros: acepta tanto string (filtroNombre) como objeto de opciones
  if (typeof options === 'string') {
    filtroNombre = options;
  } else if (typeof options === 'object' && options !== null) {
    filtroNombre = options.filtroNombre || options.socio || null;
    idTasaRequerida = options.id_tasa || options.lote_tasa || options.idTasa || null;
  }

  // 🟢 1. Obtener la tasa correspondiente (específica por id_tasa o fallback a la más reciente)
  let loteActual, loteAnterior;

  if (idTasaRequerida) {
    const sqlTasaEspecífica = `
      SELECT id_tasa, tasas, created_at 
      FROM tasas_glaukov 
      WHERE id_tasa = $1 
      LIMIT 1;
    `;
    const resEspecífica = await db.query(sqlTasaEspecífica, [idTasaRequerida]);
    if (resEspecífica.rows.length > 0) {
      loteActual = resEspecífica.rows[0];
      loteAnterior = loteActual;
    }
  }

  // Fallback si no se especificó id_tasa o si no existía esa tasa en la base de datos
  if (!loteActual) {
    const sqlTasas = `
      SELECT id_tasa, tasas, created_at 
      FROM tasas_glaukov 
      ORDER BY created_at DESC, id DESC 
      LIMIT 2;
    `;
    const resTasas = await db.query(sqlTasas);
    loteActual = resTasas.rows[0] || { id_tasa: 'T001', tasas: {} };
    loteAnterior = resTasas.rows[1] || loteActual;
  }

  const tasasMercado = normalizarMapTasas(loteActual.tasas);
  const tasasMercadoAnterior = normalizarMapTasas(loteAnterior.tasas);
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

    // 🟢 MONEDA NATIVA EXACTA DEL SOCIO (PEN, CLP, COP, BRL, USDT, etc.)
    const monedaRaw = socioData.moneda_socio || socioData.monedasocio || socioData.moneda || "USDT";
    const monedaExtraida = String(monedaRaw).toUpperCase().trim();
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

    const getTrend = (actualNum, antNum) => {
      const a = parseFloat(actualNum.toFixed(4));
      const b = parseFloat(antNum.toFixed(4));
      if (a > b) return "up";
      if (a < b) return "down";
      return "stable";
    };

    for (const itemPais of paisesActivos) {
      const codeP = (itemPais.moneda || itemPais.code || MAPA_MONEDAS[itemPais.pais || itemPais.nombrePais] || "").toUpperCase().trim();
      const nombreP = itemPais.pais || itemPais.nombrePais || Object.keys(MAPA_MONEDAS).find(k => MAPA_MONEDAS[k] === codeP) || codeP;

      if (!codeP) continue;

      // 🟢 1. LECTURA DE PORCENTAJES (%) Y POLARIDADES (SUMA / RESTA)
      const pctD = ajustes[`pct_D_${codeP}`] !== undefined ? parseFloat(ajustes[`pct_D_${codeP}`]) : null;
      const restaD = ajustes[`resta_D_${codeP}`] !== undefined ? Boolean(ajustes[`resta_D_${codeP}`]) : false;

      const pctP = ajustes[`pct_P_${codeP}`] !== undefined ? parseFloat(ajustes[`pct_P_${codeP}`]) : null;
      const restaP = ajustes[`resta_P_${codeP}`] !== undefined ? Boolean(ajustes[`resta_P_${codeP}`]) : true;

      // 🟢 2. CONVERSIÓN A FACTOR MULTIPLICADOR (CON FALLBACK RETROCOMPATIBLE)
      let factorD, factorP;

      if (pctD !== null && !isNaN(pctD)) {
        factorD = restaD ? (1 - (pctD / 100)) : (1 + (pctD / 100));
      } else {
        let rawFactorD = ajustes[`D-${codeP}`] ?? ajustes[`D${codeP}`] ?? ajustes[`factor_D_${codeP}`];
        if (rawFactorD === undefined || rawFactorD === null) rawFactorD = FACTORES_RESPALDO[codeP]?.D ?? 1.0;
        factorD = Math.abs(parseFloat(rawFactorD) || 1.0);
      }

      if (pctP !== null && !isNaN(pctP)) {
        factorP = restaP ? (1 - (pctP / 100)) : (1 + (pctP / 100));
      } else {
        let rawFactorP = ajustes[`P-${codeP}`] ?? ajustes[`P${codeP}`] ?? ajustes[`factor_P_${codeP}`];
        if (rawFactorP === undefined || rawFactorP === null) rawFactorP = FACTORES_RESPALDO[codeP]?.P ?? 0.95;
        factorP = Math.abs(parseFloat(rawFactorP) || 0.95);
      }

      // 🟢 3. CÁLCULO DE TASA CRUZADA BASADO EN LA MONEDA NATIVA DEL SOCIO
      const tasaBaseDestino = getTasaBaseMercado(tasasMercado, codeP);
      const tasaBaseSocio   = getTasaBaseMercado(tasasMercado, monedaProcesada);

      const crossBaseActual = tasaBaseDestino / tasaBaseSocio;

      const numCompraActual = crossBaseActual * factorD;
      const numVentaActual  = crossBaseActual * factorP;

      // 🟢 4. CÁLCULO HISTÓRICO PARA TENDENCIA
      const tasaBaseDestinoAnt = getTasaBaseMercado(tasasMercadoAnterior, codeP);
      const tasaBaseSocioAnt   = getTasaBaseMercado(tasasMercadoAnterior, monedaProcesada);

      const crossBaseAnt = tasaBaseDestinoAnt / tasaBaseSocioAnt;

      const numCompraAnt = crossBaseAnt * factorD;
      const numVentaAnt  = crossBaseAnt * factorP;

      const valCompraStr = (factorD > 0) ? truncarTasaOficial(numCompraActual) : "-";
      const valVentaStr  = (factorP > 0) ? truncarTasaOficial(numVentaActual)  : "-";

      tarjetasPaises.push({
        bandera: BANDERAS_MAP[codeP] || '🌐',
        nombre_pais: `${nombreP} (${codeP})`,
        compra: valCompraStr,
        venta: valVentaStr,
        trend_compra: (factorD > 0) ? getTrend(numCompraActual, numCompraAnt) : 'stable',
        trend_venta:  (factorP > 0) ? getTrend(numVentaActual, numVentaAnt)   : 'stable'
      });
    }

    listaSociosProcesados.push({
      nombre_socio: labelSocio,
      moneda_socio: monedaProcesada,
      remoteJid: whatsappJid,
      lote_tasa: correlativoTasa,
      hora_actualizacion: valorHora,
      tasa_base_ref: `${valorTasa} ${valorFecha}`,
      tarjetas_paises: tarjetasPaises,
      cartelera_paises: tarjetasPaises
    });
  }

  if (filtroNombre && typeof filtroNombre === 'string') {
    const busqueda = filtroNombre.trim().toLowerCase();
    listaSociosProcesados = listaSociosProcesados.filter(s => s.nombre_socio.toLowerCase().includes(busqueda));
  }

  return listaSociosProcesados;
}

// 🟢 ENCOLADO A BULLMQ CON SOPORTE COMPLETO DE OPCIONES Y LOTE
async function encolarNotificacionesTasas(options = null) {
  let optionsObj = options;
  if (typeof options === 'string') {
    optionsObj = { filtroNombre: options };
  }

  const jidOverride = optionsObj?.jidOverride || optionsObj?.destinationJid || null;

  const socios = await obtenerSociosYProcesarTasas(optionsObj);
  console.log(`[Glaukov Atenea 🚀] Encolando ${socios.length} socio(s) para renderizado...`);
  
  let encoladosConExito = 0;

  for (const socio of socios) {
    const targetJid = (jidOverride && String(jidOverride).trim().length > 0) 
      ? String(jidOverride).trim() 
      : socio.remoteJid;

    const payloadJob = {
      ...socio,
      remoteJid: targetJid,
      jidOverride: targetJid,
      destinationJid: targetJid
    };

    try {
      await tasasQueue.add('render-tasa-socio', payloadJob, { removeOnComplete: true, attempts: 3 });
      encoladosConExito++;
    } catch (qErr) {
      console.error(`❌ Error al encolar tasa en Redis para socio ${socio.nombre_socio}:`, qErr.message);
    }
  }

  return { totalEncolados: encoladosConExito, socios: socios.map(s => s.nombre_socio) };
}

module.exports = { 
  obtenerSociosYProcesarTasas,
  obtenerCarteleraConsolidada: obtenerSociosYProcesarTasas,
  encolarNotificacionesTasas,
  dispararPublicacionCartelera: encolarNotificacionesTasas
};
