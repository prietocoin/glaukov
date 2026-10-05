/**
 * @file waGuard.js
 * @description Guardián de seguridad para despachos de WhatsApp.
 * Evalúa las banderas de visibilidad del socio para impedir despachos no autorizados.
 */

/**
 * Evalúa si un socio tiene activo el envío de tasas por WhatsApp.
 * @param {Object} socioData - Registro crudo o parseado del socio.
 * @returns {boolean} `true` si tiene permitido recibir mensajes de tasas.
 */
function esSocioWAActivo(socioData) {
  if (!socioData) return false;

  let mostrar = socioData.mostrar;
  if (typeof mostrar === 'string') {
    try { mostrar = JSON.parse(mostrar); } catch (e) { mostrar = {}; }
  }

  mostrar = (typeof mostrar === 'object' && mostrar !== null) ? mostrar : {};

  return Boolean(mostrar.tasas ?? socioData.activo ?? true);
}

module.exports = { esSocioWAActivo };
