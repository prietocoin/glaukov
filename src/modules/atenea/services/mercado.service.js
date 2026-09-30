const db = require('../../../config/db');

let borradorTasas = {};

// 🟢 1. Obtener las últimas tasas desde la tabla JSONB 'tasas_glaukov'
async function obtenerUltimasTasas() {
  const lastLotRes = await db.query(`
    SELECT id_tasa, tasas, created_at 
    FROM tasas_glaukov 
    ORDER BY id DESC 
    LIMIT 1;
  `);

  if (lastLotRes.rows.length === 0) {
    return { 
      id_tasa: 'T360', 
      tasas: { USD: 1.0, USDT: 1.0, PYUSD: 1.2, ECU: 1.0, PAN: 1.0 } 
    };
  }

  const row = lastLotRes.rows[0];
  const tasasObj = typeof row.tasas === 'string' ? JSON.parse(row.tasas) : row.tasas;

  // Garantizar monedas base predeterminadas
  const tasasFinales = { 
    USD: 1.0, 
    USDT: 1.0, 
    PYUSD: 1.2, 
    ECU: 1.0, 
    PAN: 1.0, 
    ...tasasObj 
  };

  return { 
    id_tasa: row.id_tasa, 
    tasas: tasasFinales,
    created_at: row.created_at
  };
}

function guardarBorradorTasas(payload) {
  let data = payload;
  if (Array.isArray(data)) data = data[0] || {};
  if (data.json) data = data.json;
  if (data.rates) data = data.rates;
  borradorTasas = data;
  return borradorTasas;
}

function obtenerBorradorTasas() {
  if (!borradorTasas || Object.keys(borradorTasas).length === 0) {
    return null;
  }
  return borradorTasas;
}

// 🟢 CONSULTA ACTIVA A HOO / RENDER
async function consultarApiHoo() {
  const urlHoo = process.env.HOO_API_URL;

  if (urlHoo) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(urlHoo, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        let ratesObj = json.rates || json.tasas || json.data || json;
        if (Array.isArray(ratesObj)) ratesObj = ratesObj[0]?.rates || ratesObj[0] || {};

        if (ratesObj && typeof ratesObj === 'object' && Object.keys(ratesObj).length > 0) {
          borradorTasas = ratesObj;
          return borradorTasas;
        }
      }
    } catch (err) {
      console.warn('⚠️ No se pudo obtener respuesta directa de HOO_API_URL en Render:', err.message);
    }
  }

  // Fallback 1: Retornar borrador previo si existía en memoria
  const borrador = obtenerBorradorTasas();
  if (borrador) return borrador;

  // Fallback 2: Retornar las últimas tasas registradas en la base de datos
  const ultimas = await obtenerUltimasTasas();
  return ultimas.tasas || {};
}

// 🟢 2. Publicar lote oficial en 1 sola fila dentro de 'tasas_glaukov'
async function publicarTasaOficial(id_tasa, tasas) {
  if (!tasas || Object.keys(tasas).length === 0) {
    throw new Error('No se enviaron tasas para publicar.');
  }

  let codigoTasa = id_tasa;

  if (!codigoTasa) {
    const lastRes = await db.query("SELECT id_tasa FROM tasas_glaukov ORDER BY id DESC LIMIT 1;");
    if (lastRes.rows.length > 0) {
      const lastLot = lastRes.rows[0].id_tasa;
      const match = lastLot.match(/\d+/);
      const num = match ? parseInt(match[0], 10) + 1 : 1;
      codigoTasa = `T${String(num).padStart(3, '0')}`;
    } else {
      codigoTasa = 'T001';
    }
  }

  const tasasJson = typeof tasas === 'string' ? tasas : JSON.stringify(tasas);

  // Guardado unificado de 1 sola fila
  await db.query(
    `INSERT INTO tasas_glaukov (id_tasa, tasas) 
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id_tasa) DO UPDATE 
     SET tasas = EXCLUDED.tasas, created_at = CURRENT_TIMESTAMP;`,
    [codigoTasa, tasasJson]
  );

  // Registrar notificación en cola
  try {
    await db.query(
      `INSERT INTO notificaciones_tasas (id_tasa) VALUES ($1);`,
      [codigoTasa]
    );
  } catch (e) {
    console.warn('⚠️ No se pudo insertar en notificaciones_tasas:', e.message);
  }

  return { id_tasa: codigoTasa };
}

// 🟢 3. Reenviar lote desde 'tasas_glaukov'
async function reenviarTasa(id_tasa) {
  let codigoTasa = id_tasa;

  if (!codigoTasa) {
    const lastRes = await db.query("SELECT id_tasa FROM tasas_glaukov ORDER BY id DESC LIMIT 1;");
    if (lastRes.rows.length === 0) {
      throw new Error('No hay tasas registradas para reenviar.');
    }
    codigoTasa = lastRes.rows[0].id_tasa;
  }

  try {
    await db.query(`INSERT INTO notificaciones_tasas (id_tasa) VALUES ($1);`, [codigoTasa]);
  } catch (e) {
    console.warn('⚠️ No se pudo registrar reenvío en notificaciones_tasas:', e.message);
  }

  return { id_tasa: codigoTasa };
}

module.exports = {
  obtenerUltimasTasas,
  guardarBorradorTasas,
  obtenerBorradorTasas,
  consultarApiHoo,
  publicarTasaOficial,
  reenviarTasa
};
