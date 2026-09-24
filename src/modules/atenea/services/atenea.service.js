const db = require('../../../config/db');
const { truncarTasaOficial, obtenerFechaHoraVE, extractJid } = require('../../../utils/formatters');
const { BANDERAS_MAP, MAPA_MONEDAS, FACTORES_RESPALDO } = require('./mapper.service');

/**
 * Consulta la base de datos compartida y construye las estructuras de cada socio
 */
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

    let rawCartelera = socioData.cartelerapaises || socioData.paises || [];
    if (typeof rawCartelera === 'string') {
      try { rawCartelera = JSON.parse(rawCartelera); } catch (e) { rawCartelera = []; }
    }

    const paisesActivos = (Array.isArray(rawCartelera) ? rawCartelera : Object.values(rawCartelera))
      .filter(p => p && typeof p === 'object' && p.activo !== false && p.activo !== 'false');

    paisesActivos.sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99));

    const ajustes = typeof socioData.ajustes === 'string' ? JSON.parse(socioData.ajustes || '{}') : (socioData.ajustes || {});
    const tasasMercado = typeof socioData.tasas_mercado === 'string' ? JSON.parse(socioData.tasas_mercado || '{}') : (socioData.tasas_mercado || {});

    const tarjetasPaises = [];

    for (const itemPais of paisesActivos) {
      const nombreP = itemPais.pais || itemPais.nombrePais || "";
      const codeP = itemPais.moneda || itemPais.code || MAPA_MONEDAS[nombreP];

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

module.exports = { obtenerSociosYProcesarTasas };
