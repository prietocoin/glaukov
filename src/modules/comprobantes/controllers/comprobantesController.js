/**
 * @file comprobantesController.js
 * @description Controlador HTTP ultracompacto para comprobantes.
 */

const queries = require('../queries/comprobantesQueries');

async function getComprobantes(req, res) {
  try {
    const datos = await queries.buscarComprobantes(req.query.socio);
    return res.json(datos);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function liquidarComprobante(req, res) {
  try {
    await queries.actualizarEstado(req.body.hashLargo, req.body.estado || 'LIQUIDADO');
    return res.json({ success: true, message: 'Liquidación registrada' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function releerIA(req, res) { return res.json({ success: true }); }
async function updateComprobante(req, res) { return res.json({ success: true }); }

async function deleteComprobante(req, res) {
  try {
    await queries.borrarPorHash(req.params.hashLargo);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getComprobantes, liquidarComprobante, releerIA, updateComprobante, deleteComprobante };
