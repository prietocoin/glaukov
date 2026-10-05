/**
 * @file comprobantesIaService.js
 * @description Servicio exclusivo para disparar la re-lectura inteligente mediante Gemini IA.
 * Encola el comprobante seleccionado para re-procesar texto, banco y referencias.
 */

/**
 * Solicita al backend la re-evaluación IA de un comprobante.
 * @param {string} hashLargo - Identificador único del comprobante.
 * @returns {Promise<boolean>} 'true' si fue encolado con éxito.
 */
export async function solicitarRelecturaIA(hashLargo) {
  if (!hashLargo) return false;
  if (!confirm('¿Deseas enviar este comprobante a re-lectura con Gemini?')) return false;

  try {
    await window.AteneaAPI.releerIA(hashLargo);
    alert('⚡ Comprobante encolado para re-lectura IA.');
    return true;
  } catch (err) {
    console.error('[comprobantesIaService ❌ Error en re-lectura IA]', err);
    alert('Error: ' + err.message);
    return false;
  }
}
