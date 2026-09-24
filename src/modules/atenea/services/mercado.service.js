const db = require('../../../config/db');

let borradorTasas = {};

async function obtenerUltimasTasas() {
  const lastLotRes = await db.query(`
    SELECT id_tasa FROM mercado_tasas ORDER BY timestamp DESC, id DESC LIMIT 1;
  `);

  if (lastLotRes.rows.length === 0) {
    return { id_tasa: 'T360', tasas: { USD: 1.0, USDT: 1.0, PYUSD: 1.2, ECU: 1.0, PAN: 1.0 } };
  }

  const lastIdTasa = lastLotRes.rows[0].id_tasa;
  const ratesRes = await db.query(
    `SELECT moneda, tasa_base FROM mercado_tasas WHERE id_tasa = $1;`,
    [lastIdTasa]
  );

  const tasasObj = { USD: 1.0, USDT: 1.0, PYUSD: 1.2, ECU: 1.0, PAN: 1.0 };
  ratesRes.rows.forEach(r => {
    tasasObj[r.moneda.toUpperCase()] = parseFloat(r.tasa_base);
  });

  return { id_tasa: lastIdTasa, tasas: tasasObj };
}

function guardarBorradorTasas(payload) {
  let data = payload;
  if (Array.isArray(data)) data = data[0] || {};
  if (data.json) data = data.json;
  borradorTasas = data;
  return borradorTasas;
}

function obtenerBorradorTasas() {
  if (!borradorTasas || Object.keys(borradorTasas).length === 0) {
    return null;
  }
  return borradorTasas;
}

async function publicarTasaOficial(id_tasa, tasas) {
  if (!tasas || Object.keys(tasas).length === 0) {
    throw new Error('No se enviaron tasas para publicar.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  let codigoTasa = id_tasa;

  if (!codigoTasa) {
    const lastRes = await db.query("SELECT id_tasa FROM mercado_tasas ORDER BY id DESC LIMIT 1;");
    if (lastRes.rows.length > 0) {
      const lastLot = lastRes.rows[0].id_tasa;
      const match = lastLot.match(/\d+/);
      const num = match ? parseInt(match[0], 10) + 1 : 1;
      codigoTasa = `T${String(num).padStart(3, '0')}`;
    } else {
      codigoTasa = 'T360';
    }
  }

  for (const [moneda, valor] of Object.entries(tasas)) {
    if (valor && !isNaN(valor)) {
      await db.query(
        `INSERT INTO mercado_tasas (id_tasa, moneda, tasa_base, timestamp) VALUES ($1, $2, $3, $4);`,
        [codigoTasa, moneda.toUpperCase(), parseFloat(valor), timestamp]
      );
    }
  }

  await db.query(
    `INSERT INTO notificaciones_tasas (id_tasa) VALUES ($1);`,
    [codigoTasa]
  );

  return { id_tasa: codigoTasa };
}

async function reenviarTasa(id_tasa) {
  let codigoTasa = id_tasa;

  if (!codigoTasa) {
    const lastRes = await db.query("SELECT id_tasa FROM mercado_tasas ORDER BY id DESC LIMIT 1;");
    if (lastRes.rows.length === 0) {
      throw new Error('No hay tasas registradas para reenviar.');
    }
    codigoTasa = lastRes.rows[0].id_tasa;
  }

  await db.query(`INSERT INTO notificaciones_tasas (id_tasa) VALUES ($1);`, [codigoTasa]);
  return { id_tasa: codigoTasa };
}

module.exports = {
  obtenerUltimasTasas,
  guardarBorradorTasas,
  obtenerBorradorTasas,
  publicarTasaOficial,
  reenviarTasa
};
