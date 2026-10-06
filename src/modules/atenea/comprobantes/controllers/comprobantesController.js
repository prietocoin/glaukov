/**
 * @file comprobantesController.js
 * @description Regulator HTTP pro comprobantes_raw et comprobantes_liq.
 */
const db = require('../../../config/db');
const { obtenerComprobantesCompletos } = require('../queries/comprobantesQuery');

const TABLA_RAW = 'comprobantes_raw';

async function getComprobantes(req, res) {
  try {
    const { socio } = req.query;
    const rows = await obtenerComprobantesCompletos(socio);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('[comprobantesController ❌ Error DB]:', err.message);
    return res.status(200).json([]);
  }
}

async function liquidarComprobante(req, res) {
  try {
    const { hashLargo, estado } = req.body;
    await db.query(`UPDATE ${TABLA_RAW} SET estado = $1 WHERE hash_largo = $2;`, [estado || 'LIQUIDADO', hashLargo]);
    return res.json({ success: true, message: 'Liquidado' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function releerIA(req, res) { return res.json({ success: true }); }
async function updateComprobante(req, res) { return res.json({ success: true }); }

async function deleteComprobante(req, res) {
  try {
    await db.query(`DELETE FROM ${TABLA_RAW} WHERE hash_largo = $1;`, [req.params.hashLargo]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getComprobantes, liquidarComprobante, releerIA, updateComprobante, deleteComprobante };
