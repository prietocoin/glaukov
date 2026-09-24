const db = require('../../../config/db');
const { truncarTasaOficial, obtenerFechaHoraVE, extractJid } = require('../../../utils/formatters');
const { BANDERAS_MAP, MAPA_MONEDAS, FACTORES_RESPALDO } = require('./mapper.service');
const { Queue } = require('bullmq');
const redisConnection = require('../../../config/redis');

const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

/**
 * Parsea cualquier formato de cartelera de países desde la DB
 * (Soporta JSON string, Postgres Array "{COP,PEN}", Array JS o comas)
 */
function parseCartelera(rawInput) {
  if (!rawInput) return [];
  if (Array.isArray(rawInput)) return rawInput;
  if (typeof rawInput === 'object') return rawInput;

  if (typeof rawInput === 'string') {
    const str = rawInput.trim();
    if (!str) return [];

    // 1. Sintaxis JSON nativa
    if (str.startsWith('[') || (str.startsWith('{') && str.includes('"'))) {
      try { return JSON.parse(str); } catch (e) {}
    }

    // 2. Sintaxis de arreglo de PostgreSQL "{COP,PEN,ARS}"
    if (str.startsWith('{') && str.endsWith('}')) {
      const limpio = str.slice(1, -1).trim();
      if (!limpio) return [];
      return limpio.split(',').map(s => s.replace(/^"|"$/g, '').trim());
    }

    // 3. Cadena separada por comas "COP, PEN, ARS"
    if (str.includes(',')) {
      return str.split(',').map(s => s.trim());
    }

    return [str];
  }

  return [];
}

async function obtenerSociosYProcesarTasas() {
  const sql = `
    SELECT 
        f.*,
        (
            SELECT json_object_agg(moneda, tasa_base) 
            FROM (
                SELECT DISTINCT ON (moneda) moneda, tasa_base 
                FROM mercado_tasas 
                ORDER BY moneda, id DESC
            ) t
        ) AS tasas_mercado,
        COALESCE(
            (SELECT id_tasa FROM mercado_tasas ORDER BY id DESC LIMIT 1), 
            'T360'
        ) || ' ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI:SS') AS "TASA"
    FROM nombres_fb f
    WHERE COALESCE(f.activo, TRUE) = TRUE;
  `;

  const { rows } = await db.query(sql);
  const timeVE = obtenerFechaHoraVE();
  const listaSociosProcesados = [];

  for (const socioData of rows) {
    const nombre = socioData.nombre || "SOCIO";
    if (!nombre || nombre === 'NOMBRE' || nombre.toUpperCase() === 'GENERAL') continue;

    const labelSocio = socioData.socio || nombre;
    const whatsappJid = extractJid(socioData.whatsapp || socioData.id_grupo || socioData.id_grupo1);

    const stringTasa = String(socioData.tasa || "");
    const partesTasa = stringTasa.split(" ");
    const valorTasa = partesTasa[0] || "T360";
    const valorFecha = partesTasa[1] || timeVE.fechaStr;
    const valorHora = partesTasa[2] || timeVE.horaStr;

    const monedaExtraida = String(socioData.monedasocio || "USDT").toUpperCase();
    const monedaProcesada = (monedaExtraida === "USD") ? "USDT" : monedaExtraida;

    // Buscar en todas las columnas posibles de cartelera
    const rawCartelera = socioData.cartelerapaises || 
                         socioData.cartelera_paises || 
                         socioData.paises || 
                         socioData.cartelera || 
                         socioData.monedas;

    const carteleraParseada = parseCartelera(rawCartelera);

    // Normalizar a objetos
    let paisesNormalizados = [];
    if (Array.isArray(carteleraParseada)) {
      paisesNormalizados = carteleraParseada.map(p => (typeof p === 'string' ? { moneda: p, activo: true } : p));
    } else if (typeof carteleraParseada === 'object' && carteleraParseada !== null) {
      paisesNormalizados = Object.entries(carteleraParseada).map(([key, val]) => {
        if (typeof val === 'object' && val !== null) return { moneda: key, ...val };
        return { moneda: key, activo: Boolean(val) };
      });
    }

    // Filtrar activos
    const paisesActivos = paisesNormalizados.filter(p => {
      if (!p) return false;
      if (p.activo === false || p.activo === 'false' || p.activo === 0 || p.activo === '0') return false;
      return true;
    });

    paisesActivos.sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99));

    const ajustes = typeof socioData.ajustes === 'string' ? JSON.parse(socioData.ajustes || '{}') : (socioData.ajustes || {});
    const tasasMercado = typeof socioData.tasas_mercado === 'string' ? JSON.parse(socioData.tasas_mercado || '{}') : (socioData.tasas_mercado || {});

    const tarjetasPaises = [];

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

      const tasaBaseDestino = parseFloat(tasasMercado[codeP] || 1.0);
      let tasaBaseSocio = 1.0;

      if (!['USD', 'USDT', 'PYUSD'].includes(monedaProcesada)) {
        tasaBaseSocio = parseFloat(tasasMercado[monedaProcesada] || 1.0);
      }
      if (tasaBaseSocio <= 0) tasaBaseSocio = 1.0;

      const crossBase = tasaBaseDestino / tasaBaseSocio;

      const valCompra = (factorD > 0) ? truncarTasaOficial(crossBase * factorD) : "-";
      const valVenta = (factorP > 0) ? truncarTasaOficial(crossBase * factorP) : "-";

      tarjetasPaises.push({
        bandera: BANDERAS_MAP[codeP] || '🌐',
        nombre_pais: `${nombreP} (${codeP})`,
        compra: valCompra,
        venta: valVenta
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

  return listaSociosProcesados;
}

async function encolarNotificacionesTasas() {
  const socios = await obtenerSociosYProcesarTasas();
  console.log(`[Glaukov Atenea 🚀] Encolando ${socios.length} socios para renderizado...`);

  for (const socio of socios) {
    await tasasQueue.add('render-tasa-socio', socio, {
      removeOnComplete: true,
      attempts: 3
    });
  }

  return { totalEncolados: socios.length };
}

module.exports = {
  obtenerSociosYProcesarTasas,
  encolarNotificacionesTasas
};
