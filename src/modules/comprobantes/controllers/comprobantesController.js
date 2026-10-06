/**
 * @file comprobantesController.js
 * @description Controlador HTTP para comprobantes_raw y comprobantes_liq.
 */

const db = require('../../../config/db');

const TABLA_RAW = 'comprobantes_raw';
const TABLA_LIQ = 'comprobantes_liq';

async function getComprobantes(req, res) {
  try {
    const { socio } = req.query;
    const esSocio = socio && socio !== 'undefined' && socio !== 'null' && socio.trim() !== '';

    let sql = `SELECT * FROM ${TABLA_RAW}`;
    const params = [];

    if (esSocio) {
      sql += ` WHERE (LOWER(COALESCE(nombre_socio_1, '')) LIKE LOWER($1) OR LOWER(COALESCE(titular, '')) LIKE LOWER($1))`;
      params.push(`%${socio.trim()}%`);
    }
    sql += ' ORDER BY 1 DESC LIMIT 50;';

    const { rows } = await db.query(sql, params);
    return res.status(200).json(rows || []);
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
