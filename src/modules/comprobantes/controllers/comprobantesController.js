/**
 * @file comprobantesController.js
 * @description Controlador HTTP para auditoría, liquidación y re-lectura IA de comprobantes.
 */

const comprobantesService = require('../services/comprobantes.service');

async function getComprobantes(req, res) {
  try {
    const datos = await comprobantesService.obtenerComprobantesAuditados(req.query);
    return res.json(datos || []);
  } catch (err) {
    console.error('❌ Error GET /api/comprobantes:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function liquidarComprobante(req, res) {
  try {
    const fn = comprobantesService.liquidarComprobante || comprobantesService.guardarLiquidacion;
    const resultado = await fn(req.body);
    return res.json({ success: true, message: 'Liquidación registrada correctamente', data: resultado });
  } catch (err) {
    console.error('❌ Error POST /api/comprobantes/liquidar:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function releerIA(req, res) {
  try {
    const { hashLargo } = req.params;
    const resultado = await comprobantesService.releerIA(hashLargo);
    return res.json(resultado);
  } catch (err) {
    console.error('❌ Error POST /api/comprobantes/:hashLargo/releer:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function updateComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    const actualizado = await comprobantesService.actualizarComprobante(hashLargo, req.body);
    return res.json({ success: true, data: actualizado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    const resultado = await comprobantesService.eliminarComprobante(hashLargo);
    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getComprobantes,
  liquidarComprobante,
  releerIA,
  updateComprobante,
  deleteComprobante
};
