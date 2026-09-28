const db = require('../src/config/db');
const { liquidacionQueue } = require('../src/workers/liquidacion.worker');

async function migrarComprobantesHistoricos() {
  console.log('🚀 Buscando comprobantes no congelados en comprobantes_raw...');

  try {
    const { rows } = await db.query(`
      SELECT c.hash_largo 
      FROM comprobantes_raw c
      LEFT JOIN comprobantes_liq l ON LOWER(TRIM(c.hash_largo)) = LOWER(TRIM(l.hash_largo))
      WHERE l.hash_largo IS NULL;
    `);

    console.log(`📦 Encontrados ${rows.length} comprobantes pendientes de congelar.`);

    for (const row of rows) {
      if (row.hash_largo) {
        await liquidacionQueue.add('liquidar-comprobante', { hash_largo: row.hash_largo }, {
          removeOnComplete: true,
          attempts: 3
        });
      }
    }

    console.log('✅ Todos los comprobantes históricos fueron enviados a la cola de liquidación.');
  } catch (err) {
    console.error('❌ Error durante la migración:', err.message);
  } finally {
    process.exit(0);
  }
}

migrarComprobantesHistoricos();
