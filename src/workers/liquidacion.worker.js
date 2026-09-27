const { Worker, Queue } = require('bullmq');
const db = require('../config/db');
const redisConnection = require('../config/redis');
const { calcularSnapshotFinanciero } = require('../modules/atenea/services/liquidacion.service');
const mercadoService = require('../modules/atenea/services/mercado.service');

const liquidacionQueue = new Queue('cola-liquidaciones', { connection: redisConnection });

const liquidacionWorker = new Worker(
  'cola-liquidaciones',
  async (job) => {
    const { hash_largo } = job.data;
    console.log(`[Glaukov Worker ⚙️] Procesando snapshot para: ${hash_largo.substring(0, 8)}`);

    // 1. Obtener comprobante raw
    const rawRes = await db.query(
      'SELECT * FROM comprobantes_raw WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1));',
      [hash_largo]
    );
    if (rawRes.rows.length === 0) return;
    const raw = rawRes.rows[0];

    // 2. Obtener nombres de socios desde impactos_raw o general
    const impRes = await db.query(`
      SELECT usuario_raw, grupo_raw FROM impactos_raw 
      WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM($1)) ORDER BY id ASC LIMIT 2;
    `, [hash_largo]);

    const s1Identifier = impRes.rows[0]?.grupo_raw || impRes.rows[0]?.usuario_raw || '';
    const s2Identifier = impRes.rows[1]?.grupo_raw || impRes.rows[1]?.usuario_raw || '';

    // 3. Traer datos de directorio (nombres_fb)
    const soc1Res = await db.query(`
      SELECT * FROM nombres_fb WHERE LOWER(TRIM(whatsapp)) = LOWER(TRIM($1)) OR LOWER(TRIM(id_grupo)) = LOWER(TRIM($1)) LIMIT 1;
    `, [s1Identifier]);

    const soc2Res = await db.query(`
      SELECT * FROM nombres_fb WHERE LOWER(TRIM(whatsapp)) = LOWER(TRIM($1)) OR LOWER(TRIM(id_grupo)) = LOWER(TRIM($1)) LIMIT 1;
    `, [s2Identifier]);

    const socio1Data = soc1Res.rows[0] || { nombre: 'GENERAL', moneda_socio: 'USDT' };
    const socio2Data = soc2Res.rows[0] || { nombre: 'GENERAL', moneda_socio: 'USDT' };

    // 4. Obtener lote de mercado activo
    const loteTasa = await mercadoService.obtenerUltimasTasas();

    // 5. Ejecutar cálculo puro
    const snapshot = calcularSnapshotFinanciero(raw, socio1Data, socio2Data, loteTasa);

    // 6. UPSERT en comprobantes_liq
    const queryUpsert = `
      INSERT INTO comprobantes_liq (
        hash_largo, socio_1, tipo_op1, monto_1, tasa_1, me1,
        socio_2, tipo_op2, monto_2, tasa_2, me2, lote_tasa, actualizado_en
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (hash_largo) DO UPDATE SET
        socio_1 = EXCLUDED.socio_1,
        tipo_op1 = EXCLUDED.tipo_op1,
        monto_1 = EXCLUDED.monto_1,
        tasa_1 = EXCLUDED.tasa_1,
        me1 = EXCLUDED.me1,
        socio_2 = EXCLUDED.socio_2,
        tipo_op2 = EXCLUDED.tipo_op2,
        monto_2 = EXCLUDED.monto_2,
        tasa_2 = EXCLUDED.tasa_2,
        me2 = EXCLUDED.me2,
        lote_tasa = EXCLUDED.lote_tasa,
        actualizado_en = NOW();
    `;

    await db.query(queryUpsert, [
      snapshot.hash_largo, snapshot.socio_1, snapshot.tipo_op1, snapshot.monto_1, snapshot.tasa_1, snapshot.me1,
      snapshot.socio_2, snapshot.tipo_op2, snapshot.monto_2, snapshot.tasa_2, snapshot.me2, snapshot.lote_tasa
    ]);

    console.log(`[Glaukov Worker 🟢] Comprobante ${hash_largo.substring(0, 8)} congelado correctamente.`);
    return { status: 'completado', hash_largo };
  },
  { connection: redisConnection, concurrency: 3 }
);

module.exports = { liquidacionWorker, liquidacionQueue };
