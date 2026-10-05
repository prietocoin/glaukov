/**
 * @file tasasPublisher.js
 * @description Publicador atómico de trabajos a la cola BullMQ 'cola-tasas'.
 * Inyecta el JID resuelto e inmutable de modo que el worker consuma a ciegas.
 */

const { Queue } = require('bullmq');
const redisConnection = require('../../../config/redis');
const { resolverDestinoJid } = require('../resolvers/jidResolver');

const tasasQueue = new Queue('cola-tasas', { connection: redisConnection });

/**
 * Encola la lista de socios procesados en la cola Redis de BullMQ.
 * @param {Array<Object>} sociosProcesados - Lista de objetos de socio con su cartelera.
 * @param {Object} options - Opciones de despacho (modoPrueba, jidOverride).
 * @returns {Promise<{totalEncolados: number, socios: Array<string>}>}
 */
async function encolarNotificacionesTasas(sociosProcesados = [], options = {}) {
  const esModoPrueba = Boolean(options.modoPrueba || options.esPrueba);
  const overrideInput = options.jidOverride || options.destinationJid;
  let encoladosConExito = 0;

  for (const socio of sociosProcesados) {
    const jidFinal = resolverDestinoJid(socio.remoteJid, esModoPrueba, overrideInput);

    const payloadJob = {
      ...socio,
      remoteJid: jidFinal,
      jidOverride: jidFinal,
      modoPrueba: esModoPrueba
    };

    try {
      await tasasQueue.add('render-tasa-socio', payloadJob, { removeOnComplete: true, attempts: 3 });
      encoladosConExito++;
    } catch (qErr) {
      console.error(`[TasasPublisher ❌] Error encolando socio ${socio.nombre_socio}:`, qErr.message);
    }
  }

  return {
    totalEncolados: encoladosConExito,
    socios: sociosProcesados.map(s => s.nombre_socio)
  };
}

module.exports = { tasasQueue, encolarNotificacionesTasas };
