/**
 * @file jidResolver.js
 * @description Resolver inmutable para destinos de WhatsApp.
 * Garantiza que si 'modoPrueba' está activo, la salida sea obligatoriamente 'TEST_JID_OVERRIDE'.
 */

/**
 * Resuelve el JID final de destino para el despacho.
 * @param {string} jidReal - ID de grupo real del socio (ej: 120363...@g.us).
 * @param {boolean} modoPrueba - Flag de modo de pruebas.
 * @param {string} [overrideExplicit] - JID explícito pasado por parámetro.
 * @returns {string|null} JID de destino resuelto.
 */
function resolverDestinoJid(jidReal, modoPrueba = false, overrideExplicit = null) {
  const testJid = process.env.TEST_JID_OVERRIDE;

  if (overrideExplicit && String(overrideExplicit).trim().length > 0) {
    return String(overrideExplicit).trim();
  }

  if (modoPrueba && testJid && String(testJid).trim().length > 0) {
    return String(testJid).trim();
  }

  return jidReal ? String(jidReal).trim() : null;
}

module.exports = { resolverDestinoJid };
