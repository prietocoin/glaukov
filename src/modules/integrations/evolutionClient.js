/**
 * @file evolutionClient.js
 * @description Cliente HTTP exclusivo para interactuar con Evolution API (envío de media/WhatsApp).
 */

/**
 * Envía una imagen PNG a un JID remoto mediante Evolution API.
 * @param {string} remoteJid - JID de destino en WhatsApp.
 * @param {Buffer} imageBuffer - Buffer de la imagen PNG.
 * @param {string} caption - Texto de pie de foto.
 */
async function enviarImagenWhatsApp(remoteJid, imageBuffer, caption = 'Actualización de tasa 📊') {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'Jairo';

  if (!evolutionUrl || !apiKey) {
    console.warn('[EvolutionClient ⚠️] EVOLUTION_API_URL o API Key no configuradas.');
    return;
  }

  const payload = {
    number: remoteJid,
    media: imageBuffer.toString('base64'),
    mediatype: 'image',
    mimetype: 'image/png',
    fileName: 'tasa.png',
    caption
  };

  const urlFinal = `${evolutionUrl.replace(/\/$/, '')}/message/sendMedia/${instanceName}`;
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

  console.log(`[EvolutionClient 🟢] Mensaje enviado exitosamente a ${remoteJid}`);
}

module.exports = { enviarImagenWhatsApp };
