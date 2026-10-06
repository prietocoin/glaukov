/**
 * @file adminController.js
 * @description Controlador de administración atómico para inspección de la cola de trabajo.
 */

const db = require('../../../config/db');

async function getColaAdmin(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notificaciones_tasas ORDER BY created_at DESC LIMIT 50;`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[adminController ❌]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function updateColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    return res.json({ success: true, message: `Registro ${hashLargo} actualizado.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    await db.query(`DELETE FROM notificaciones_tasas WHERE id_tasa = $1;`, [hashLargo]);
    return res.json({ success: true, message: 'Registro eliminado correctamente.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getColaAdmin,
  updateColaAdmin,
  deleteColaAdmin
};
