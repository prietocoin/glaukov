const { Worker, Queue } = require('bullmq');
const axios = require('axios');
const redisConnection = require('../config/redis');
// ✅ Ruta corregida (apunta directamente a src/render):
const { generarImagenTasa } = require('../render/services/puppeteer.service');

const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

/**
 * Envía la imagen renderizada por WhatsApp a través de Evolution API
 */
async function enviarImagenWhatsApp(remoteJid, imageBuffer, caption) {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'Jairo';

  if (!evolutionUrl || !apiKey) {
    console.warn('[Glaukov Worker ⚠️] EVOLUTION_API_URL o API Key no configuradas.');
    return;
  }

  // Base64 puro sin encabezado Data URI
  const rawBase64 = imageBuffer.toString('base64');

  const payload = {
    number: remoteJid,
    media: rawBase64,
    mediatype: 'image',
    mimetype: 'image/jpeg',
    fileName: 'tasa.jpg',
    caption: caption || 'Actualización de tasa 📊'
  };

  const urlFinal = `${evolutionUrl.replace(/\/$/, '')}/message/sendMedia/${instanceName}`;

  try {
    const response = await axios.post(urlFinal, payload, {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    console.log(`[Glaukov Worker 🟢] Mensaje enviado exitosamente a ${remoteJid} (Status ${response.status})`);
  } catch (error) {
    console.error(`[Glaukov Worker ❌] Error enviando a Evolution API (${remoteJid}):`, error.response?.data || error.message);
  }
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
        `Hola 👋 *${datosSocio.nombre_socio}*. Adjunto la actualización de tasas 📊.`
      );
    } else {
      console.log(`[Glaukov Worker ℹ️] ${datosSocio.nombre_socio} no posee remoteJid asignado.`);
    }

    return { status: 'completado', socio: datosSocio.nombre_socio };
  },
  {
    connection: redisConnection,
    concurrency: 2
  }
);

tasasWorker.on('completed', (job) => {
  console.log(`[Glaukov Worker ✅] Trabajo ${job.id} finalizado exitosamente`);
});

tasasWorker.on('failed', (job, err) => {
  console.error(`[Glaukov Worker ❌] Trabajo ${job?.id} falló:`, err.message);
});

module.exports = { tasasWorker, tasasQueue };
