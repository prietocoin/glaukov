/**
 * @file tasashubClient.js
 * @description Cliente HTTP puro para obtener la imagen renderizada de cartelera desde TasasHub.
 */

const TASASHUB_BASE_URL = (process.env.TASASHUB_URL || 'http://automat_tasashub:3002').replace(/\/$/, '');

/**
 * Obtiene el Buffer de la imagen PNG de cartelera para un socio.
 * @param {string} nombreSocio - Nombre del socio.
 * @returns {Promise<Buffer>}
 */
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

module.exports = { obtenerImagenTasasHub };
