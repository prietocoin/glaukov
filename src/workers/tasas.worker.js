const { Worker, Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

const TASASHUB_BASE_URL = (process.env.TASASHUB_URL || 'http://automat_tasashub:3002').replace(/\/$/, '');

// ⏱️ Función utilitaria para crear pausas (Delay)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function obtenerImagenTasasHub(nombreSocio) {
  const url = `${TASASHUB_BASE_URL}/api/v1/tasas/render/${encodeURIComponent(nombreSocio)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[TasasHub HTTP ${response.status}]: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function enviarImagenWhatsApp(remoteJid, imageBuffer, caption) {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'Jairo';

  if (!evolutionUrl || !apiKey) {
    console.warn('[Glaukov Worker ⚠️] EVOLUTION_API_URL o API Key no configuradas.');
    return;
  }

  const rawBase64 = imageBuffer.toString('base64');

  const payload = {
    number: remoteJid,
    media: rawBase64,
    mediatype: 'image',
    mimetype: 'image/png', 
    fileName: 'tasa.png',
    caption: caption || 'Actualización de tasa 📊'
  };

  const urlFinal = `${evolutionUrl.replace(/\/$/, '')}/message/sendMedia/${instanceName}`;

  try {
    const response = await fetch(urlFinal, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log(`[Glaukov Worker 🟢] Mensaje enviado exitosamente a ${remoteJid} (Status ${response.status})`);
  } catch (error) {
    console.error(`[Glaukov Worker ❌] Error enviando a Evolution API (${remoteJid}):`, error.message);
    throw error;
  }
}

// Inicialización del Worker de BullMQ
const tasasWorker = new Worker(
  'cola-tasas',
  async (job) => {
    const datosSocio = job.data;
    console.log(`[Glaukov Worker ⚙️] Procesando imagen para: ${datosSocio.nombre_socio}`);

    const destinoFinal = datosSocio.jidOverride || datosSocio.destinationJid || datosSocio.remoteJid;

    // 1. Obtener imagen desde TasasHub
    const imageBuffer = await obtenerImagenTasasHub(datosSocio.nombre_socio);

    // 2. Despachar a WhatsApp
    if (destinoFinal) {
      console.log(`[Glaukov Worker 📤] Enviando tasa a WhatsApp JID: ${destinoFinal}`);
      await enviarImagenWhatsApp(
        destinoFinal,
        imageBuffer,
        `Hola 👋 *${datosSocio.nombre_socio}*. Adjunto la actualización de tasas 📊.`
      );
      
      // 🛡️ 3. PAUSA ANTI-SPAM (Respira 5 segundos antes de terminar el trabajo)
      console.log(`[Glaukov Worker 🛡️] Esperando 5 segundos por seguridad (Anti-ban)...`);
      await delay(5000); // 5000 milisegundos = 5 segundos de espera

    } else {
      console.log(`[Glaukov Worker ℹ️] ${datosSocio.nombre_socio} no posee remoteJid asignado.`);
    }

    return { status: 'completado', socio: datosSocio.nombre_socio, destino: destinoFinal };
  },
  {
    connection: redisConnection,
    // 🛡️ Concurrencia en 1 para que NUNCA intente mandar dos mensajes al mismo tiempo
    concurrency: 1 
  }
);

tasasWorker.on('completed', (job) => {
  console.log(`[Glaukov Worker ✅] Trabajo ${job.id} finalizado exitosamente`);
});

tasasWorker.on('failed', (job, err) => {
  console.error(`[Glaukov Worker ❌] Trabajo ${job?.id} falló:`, err.message);
});

module.exports = { tasasWorker, tasasQueue };
