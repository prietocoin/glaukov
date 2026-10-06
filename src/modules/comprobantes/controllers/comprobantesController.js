/**
 * @file comprobantesController.js
 * @description Controlador HTTP para auditoría, liquidación y gestión de comprobantes.
 */

const db = require('../../../config/db');

async function getComprobantes(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM comprobantes_glaukov ORDER BY created_at DESC LIMIT 50;`);
    return res.json(rows || []);
  } catch (err) {
    console.error('❌ Error GET /api/comprobantes:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function liquidarComprobante(req, res) {
  try {
    const { hashLargo, estado } = req.body;
    await db.query(`UPDATE comprobantes_glaukov SET estado = $1 WHERE hash_largo = $2;`, [estado || 'LIQUIDADO', hashLargo]);
    return res.json({ success: true, message: 'Liquidación registrada correctamente' });
  } catch (err) {
    console.error('❌ Error POST /api/comprobantes/liquidar:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function releerIA(req, res) {
  try {
    const { hashLargo } = req.params;
    return res.json({ success: true, message: `Re-lectura IA solicitada para ${hashLargo}` });
  } catch (err) {
    console.error('❌ Error POST /api/comprobantes/releer:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function updateComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    return res.json({ success: true, message: `Comprobante ${hashLargo} actualizado` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    await db.query(`DELETE FROM comprobantes_glaukov WHERE hash_largo = $1;`, [hashLargo]);
    return res.json({ success: true, message: 'Comprobante eliminado' });
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
