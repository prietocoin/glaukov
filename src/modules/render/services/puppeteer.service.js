// URL de TasasHub Engine (Red interna de Easypanel o Variable de Entorno)
const TASASHUB_BASE_URL = (process.env.TASASHUB_URL || 'http://automat_tasashub:3002').replace(/\/$/, '');

/**
 * PUENTE TEMPORAL / DEFINITIVO:
 * Intercepta las llamadas a 'generarImagenTasa' y las redirige a TasasHub Engine,
 * eliminando la necesidad de encender Puppeteer o Chromium.
 */
async function generarImagenTasa(datosSocio) {
  const nombreSocio = datosSocio.nombre_socio || datosSocio.nombre || datosSocio.socio;

  if (!nombreSocio) {
    throw new Error('[Glaukov Bridge ❌] No se proporcionó el nombre del socio en datosSocio.');
  }

  const url = `${TASASHUB_BASE_URL}/api/v1/tasas/render/${encodeURIComponent(nombreSocio)}`;
  console.log(`[Glaukov Bridge ⚡] Solicitando cartelera a TasasHub para: ${nombreSocio}...`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[TasasHub HTTP ${response.status}]: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { generarImagenTasa };
