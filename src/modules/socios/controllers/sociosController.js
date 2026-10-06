/**
 * @file sociosController.js
 * @description Manejador HTTP para la consulta de directorio y cambio de estado de socios.
 */

const db = require('../../../config/db');

async function obtenerDirectorioController(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM perfiles_glaukov ORDER BY nombre ASC;`);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('[sociosController ❌]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function actualizarEstadoSocioController(req, res) {
  try {
    const { nombre, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre de socio requerido' });

    const sql = `
      UPDATE perfiles_glaukov 
      SET mostrar = jsonb_set(COALESCE(mostrar, '{}'::jsonb), '{tasas}', $2::jsonb) 
      WHERE UPPER(nombre) = UPPER($1);
    `;
    await db.query(sql, [nombre, JSON.stringify(Boolean(activo))]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[sociosController ❌]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  obtenerDirectorioController,
  actualizarEstadoSocioController
};
