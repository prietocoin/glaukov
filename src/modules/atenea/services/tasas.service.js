const db = require('../../../config/db');
const { truncarTasaOficial, obtenerFechaHoraVE, extractJid } = require('../../../utils/formatters');
const { BANDERAS_MAP, MAPA_MONEDAS, FACTORES_RESPALDO } = require('./mapper.service');
const { Queue } = require('bullmq');
const redisConnection = require('../../../config/redis');

const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

tasasQueue.on('error', (err) => {
  console.error('❌ [BullMQ tasasQueue] Error en la cola de Redis:', err.message);
});

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
 * Garantiza que divisas dolarizadas retornen 1.0 si no están en el mapa.
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

  // 🟢 Normalización de parámetros: acepta tanto string como objeto de opciones
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

  // 🟢 2. Obtener lista de socios desde PERFILES_GLAUKOV (solo los que tengan mostrar.tasas = true)
  const sqlSocios = `
    SELECT * 
    FROM perfiles_glaukov 
    WHERE (mostrar->>'tasas')::boolean = TRUE;
  `;
  const { rows } = await db.query(sqlSocios);
  const timeVE = obtenerFechaHoraVE();
  let listaSociosProcesados = [];

  for (const socioData of rows) {
    const nombre = socioData.nombre || "SOCIO";
    if (!nombre || nombre.toUpperCase() === 'NOMBRE' || nombre.toUpperCase() === 'GENERAL') continue;

    const whatsappJid = extractJid(socioData.id_grupo);
    const valorTasa = correlativoTasa;
    const valorFecha = timeVE.fechaStr;
    const valorHora = timeVE.horaStr;

    // 🟢 MONEDA NATIVA EXACTA DEL SOCIO
    const monedaExtraida = String(socioData.moneda_base || "USDT").toUpperCase().trim();
    const monedaProcesada = (monedaExtraida === "USD") ? "USDT" : monedaExtraida;

    // 🟢 OBJETO MONEDAS EN FORMATO JSONB LIMPIO
    const monedasConfig = typeof socioData.monedas === 'object' && socioData.monedas !== null
      ? socioData.monedas 
      : {};

    const tarjetasPaises = [];

    const getTrend = (actualNum, antNum) => {
      const a = parseFloat(actualNum.toFixed(4));
      const b = parseFloat(antNum.toFixed(4));
      if (a > b) return "up";
      if (a < b) return "down";
      return "stable";
    };

    // Iteramos directamente sobre las llaves de las monedas configuradas para el socio
    for (const [codeP, configPais] of Object.entries(monedasConfig)) {
      if (!configPais.activo) continue; // Si la moneda está desactivada, la saltamos

      const nombreP = MAPA_MONEDAS[codeP] || Object.keys(MAPA_MONEDAS).find(k => MAPA_MONEDAS[k] === codeP) || codeP;

      // 🟢 1. LECTURA DE PORCENTAJES (%) DESDE EL NUEVO OBJETO
      const pctD = configPais.porcentaje?.deposito || 0;
      const pctP = configPais.porcentaje?.pago || 0;

      // 🟢 2. CONVERSIÓN A FACTOR MULTIPLICADOR COMERCIAL
      // En precio de cartelera: El depósito suma al precio base (1 + pct)
      // En precio de cartelera: El pago resta al precio base (1 - pct)
      const factorD = pctD !== null && !isNaN(pctD) ? 1 + (pctD / 100) : (FACTORES_RESPALDO[codeP]?.D ?? 1.0);
      const factorP = pctP !== null && !isNaN(pctP) ? 1 - (pctP / 100) : (FACTORES_RESPALDO[codeP]?.P ?? 0.95);

      // 🟢 3. CÁLCULO DE TASA CRUZADA
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
        trend_venta:  (factorP > 0) ? getTrend(numVentaActual, numVentaAnt)   : 'stable',
        orden: configPais.orden || 99 // Por si eventualmente le añades un campo de orden al JSONB
      });
    }
    
    // Opcional: ordenar la cartelera según el código si no hay un orden numérico
    tarjetasPaises.sort((a, b) => a.orden - b.orden || a.nombre_pais.localeCompare(b.nombre_pais));

    listaSociosProcesados.push({
      nombre_socio: nombre,
      moneda_socio: monedaProcesada,
      remoteJid: whatsappJid,
      lote_tasa: correlativoTasa,
      hora_actualizacion: valorHora,
      tasa_base_ref: `${valorTasa} ${valorFecha}`,
      tarjetas_paises: tarjetasPaises,
      cartelera_paises: tarjetasPaises // Mantenemos esta llave por compatibilidad con el renderizador EJS de la imagen
    });
  }

  if (filtroNombre && typeof filtroNombre === 'string') {
    const busqueda = filtroNombre.trim().toLowerCase();
    listaSociosProcesados = listaSociosProcesados.filter(s => s.nombre_socio.toLowerCase().includes(busqueda));
  }

  return listaSociosProcesados;
}

// 🟢 ENCOLADO A BULLMQ
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
