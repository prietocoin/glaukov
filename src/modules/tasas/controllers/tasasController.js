/**
 * @file tasasController.js
 * @description Manejador HTTP para el dominio de Tasas.
 */

const { obtenerSociosYProcesarTasas } = require('../services/tasasProcessor');
const { encolarNotificacionesTasas } = require('../../dispatch/publishers/tasasPublisher');

async function obtenerTasaActualController(req, res) {
  try {
    const data = await obtenerSociosYProcesarTasas(req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[tasasController ❌]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function publicarYDespacharTasaController(req, res) {
  try {
    const payload = req.body || {};
    const resultado = await encolarNotificacionesTasas(payload);
    return res.status(200).json({ success: true, resultado });
  } catch (err) {
    console.error('[tasasController ❌]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  obtenerTasaActualController,
  publicarYDespacharTasaController
};
