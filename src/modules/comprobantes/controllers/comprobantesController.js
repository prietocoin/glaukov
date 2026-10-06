/**
 * @file comprobantesController.js
 * @description Controlador HTTP para auditoría y consulta de comprobantes.
 */

const db = require('../../../config/db');

async function getComprobantes(req, res) {
  try {
    // 🟢 Nombre correcto de la tabla en base de datos
    const { rows } = await db.query(`SELECT * FROM comprobantes ORDER BY created_at DESC LIMIT 50;`);
    return res.json(rows || []);
  } catch (err) {
    console.error('[comprobantesController ❌]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function liquidarComprobante(req, res) {
  try {
    const { hashLargo, estado } = req.body;
    await db.query(`UPDATE comprobantes SET estado = $1 WHERE hash_largo = $2;`, [estado || 'LIQUIDADO', hashLargo]);
    return res.json({ success: true, message: 'Liquidación registrada' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function releerIA(req, res) {
  try {
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function updateComprobante(req, res) {
  try {
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    await db.query(`DELETE FROM comprobantes WHERE hash_largo = $1;`, [hashLargo]);
    return res.json({ success: true });
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
