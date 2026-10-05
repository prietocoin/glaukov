/**
 * @file tasasWorker.js
 * @description Worker consumidor ciego de BullMQ para despacho de carteleras.
 * Lee los datos pre-congelados del job en Redis sin re-consultar PostgreSQL.
 */

const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const { obtenerImagenTasasHub } = require('../modules/integrations/tasashubClient');
const { enviarImagenWhatsApp } = require('../modules/integrations/evolutionClient');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const tasasWorker = new Worker(
  'cola-tasas',
  async (job) => {
    const datosSocio = job.data;
    const destinoFinal = datosSocio.remoteJid || datosSocio.jidOverride;

    console.log(`[TasasWorker ⚙️] Procesando imagen para: ${datosSocio.nombre_socio}`);

    if (!destinoFinal) {
      console.log(`[TasasWorker ℹ️] ${datosSocio.nombre_socio} no posee JID asignado. Omitiendo.`);
      return { status: 'omitido', socio: datosSocio.nombre_socio };
    }

    // 1. Obtener imagen desde TasasHub
    const imageBuffer = await obtenerImagenTasasHub(datosSocio.nombre_socio);

    // 2. Despachar a WhatsApp usando el JID congelado del job
    console.log(`[TasasWorker 📤] Enviando tasa a WhatsApp JID: ${destinoFinal}`);
    await enviarImagenWhatsApp(
      destinoFinal,
      imageBuffer,
      `Hola 👋 *${datosSocio.nombre_socio}*. Adjunto la actualización de tasas 📊.`
    );

    // 3. Pausa Anti-Spam
    console.log(`[TasasWorker 🛡️] Esperando 5 segundos por seguridad (Anti-ban)...`);
    await delay(5000);

    return { status: 'completado', socio: datosSocio.nombre_socio, destino: destinoFinal };
  },
  {
    connection: redisConnection,
    concurrency: 1
  }
);

tasasWorker.on('completed', (job) => {
  console.log(`[TasasWorker ✅] Trabajo ${job.id} finalizado exitosamente`);
});

tasasWorker.on('failed', (job, err) => {
  console.error(`[TasasWorker ❌] Trabajo ${job?.id} falló:`, err.message);
});

module.exports = { tasasWorker };
