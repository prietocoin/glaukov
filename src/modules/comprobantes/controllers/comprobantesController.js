/**
 * @file comprobantesController.js
 * @description Controlador HTTP blindado para consulta y auditoría de comprobantes.
 */

const db = require('../../../config/db');

async function getComprobantes(req, res) {
  try {
    const { socio } = req.query;
    let query = `SELECT * FROM comprobantes`;
    const params = [];

    // Validar que socio sea un texto real y no "undefined" o "null"
    if (socio && socio !== 'undefined' && socio !== 'null' && socio.trim() !== '') {
      query += ` WHERE UPPER(nombre_socio_1) = UPPER($1) OR UPPER(nombre_socio_2) = UPPER($1)`;
      params.push(socio.trim());
    }

    query += ` ORDER BY created_at DESC LIMIT 50;`;

    const { rows } = await db.query(query, params);
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
  try { return res.json({ success: true }); } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}

async function updateComprobante(req, res) {
  try { return res.json({ success: true }); } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
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
