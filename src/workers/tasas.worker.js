const { Worker, Queue } = require('bullmq');
const axios = require('axios');
const redisConnection = require('../config/redis');
const { generarImagenTasa } = require('../modules/render/services/puppeteer.service');

// Declaración de la cola para añadir tareas desde triggers
const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

/**
 * Función auxiliar para enviar imágenes en Base64 mediante Evolution API
 */
async function enviarImagenWhatsApp(remoteJid, imageBuffer, caption) {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'Jairo';

  if (!evolutionUrl || !apiKey) {
    console.warn('[Glaukov Worker ⚠️] EVOLUTION_API_URL o EVOLUTION_API_KEY no configuradas.');
    return;
  }

  const base64Image = imageBuffer.toString('base64');

  const payload = {
    number: remoteJid,
    media: base64Image,
    mediatype: 'image',
    caption: caption || 'Actualización de tasa 📊'
  };

  await axios.post(
    `${evolutionUrl}/message/sendMedia/${instanceName}`,
    payload,
    {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    }
  );
}

// Inicialización del Worker de BullMQ
const tasasWorker = new Worker(
  'cola-tasas',
  async (job) => {
    const datosSocio = job.data;
    console.log(`[Glaukov Worker ⚙️] Procesando imagen para: ${datosSocio.nombre_socio}`);

    // 1. Renderizar imagen 1080x1350 via Puppeteer
    const imageBuffer = await generarImagenTasa(datosSocio);

    // 2. Despachar a WhatsApp si existe un remoteJid válido
    if (datosSocio.remoteJid) {
      console.log(`[Glaukov Worker 📤] Enviando tasa a WhatsApp JID: ${datosSocio.remoteJid}`);
      await enviarImagenWhatsApp(
        datosSocio.remoteJid,
        imageBuffer,
        `Hola 👋 ${datosSocio.nombre_socio}. Actualización de la tasa 📊.`
      );
    } else {
      console.log(`[Glaukov Worker ℹ️] ${datosSocio.nombre_socio} no posee remoteJid asignado.`);
    }

    return { status: 'completado', socio: datosSocio.nombre_socio };
  },
  {
    connection: redisConnection,
    concurrency: 2 // Renderiza hasta 2 imágenes en paralelo para cuidar memoria RAM
  }
);

tasasWorker.on('completed', (job) => {
  console.log(`[Glaukov Worker ✅] Trabajo ${job.id} finalizado exitosamente`);
});

tasasWorker.on('failed', (job, err) => {
  console.error(`[Glaukov Worker ❌] Trabajo ${job?.id} falló:`, err.message);
});

module.exports = { tasasWorker, tasasQueue };
