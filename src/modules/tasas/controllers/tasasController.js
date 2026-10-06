/**
 * @file tasasController.js
 * @description Controlador atómico para activación del flujo de tasas.
 */

const db = require('../../../config/db');

async function obtenerTasaActualController(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM notificaciones_tasas LIMIT 1;`);
    return res.status(200).json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(200).json({ success: true, data: [] });
  }
}

async function publicarYDespacharTasaController(req, res) {
  try {
    const { tasa } = req.body;
    await db.query(`INSERT INTO notificaciones_tasas (tasa) VALUES ($1);`, [tasa]);
    return res.json({ success: true, message: 'Flujo activado correctamente' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  obtenerTasaActualController,
  publicarYDespacharTasaController
};
