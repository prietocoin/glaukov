/**
 * @file reportesController.js
 * @description Controlador HTTP para generación y envío de estados de cuenta vía WhatsApp.
 */

const reportesService = require('../services/reportes.service');

async function getReportesFiltros(req, res) {
  try {
    const filtros = await reportesService.obtenerFiltrosReportes(req.query.rol);
    return res.json({ success: true, ...filtros });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function postEnviarReporteWhatsApp(req, res) {
  try {
    const resultado = await reportesService.enviarReporteWhatsApp(req.body);
    return res.json({ success: true, message: 'Reporte enviado con éxito.', ...resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function postEnviarMediaWhatsApp(req, res) {
  try {
    const fn = reportesService.enviarMediaWhatsApp || reportesService.enviarReporteMediaWhatsApp;
    const resultado = await fn(req.body);
    return res.json({ success: true, message: 'Reporte en imagen enviado con éxito.', ...resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getReportesFiltros,
  postEnviarReporteWhatsApp,
  postEnviarMediaWhatsApp
};
