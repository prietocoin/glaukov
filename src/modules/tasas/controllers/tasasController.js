/**
 * @file tasasController.js
 * @description Controlador HTTP atómico y seguro para tasas de mercado.
 */

const db = require('../../../config/db');

async function obtenerTasaActualController(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notificaciones_tasas ORDER BY created_at DESC LIMIT 10;`
    );
    return res.status(200).json({ success: true, data: rows || [] });
  } catch (err) {
    console.warn('[tasasController ⚠️ Error DB]:', err.message);
    // Fallback: Responde array vacío o estructura por defecto en lugar de tirar un 500
    return res.status(200).json({ success: true, data: [] });
  }
}

async function publicarYDespacharTasaController(req, res) {
  try {
    const { tasa } = req.body;
    await db.query(
      `INSERT INTO notificaciones_tasas (tasa) VALUES ($1);`,
      [tasa]
    );
    return res.json({ success: true, message: 'Tasa publicada' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  obtenerTasaActualController,
  publicarYDespacharTasaController
};
