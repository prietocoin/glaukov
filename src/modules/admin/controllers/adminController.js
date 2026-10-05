/**
 * @file adminController.js
 * @description Controlador de administración cruda para registros de la cola de trabajo.
 */

const adminService = require('../services/admin.service');

async function getColaAdmin(req, res) {
  try {
    const adminKey = req.headers['x-admin-key'];
    const data = await adminService.obtenerColaAdmin(adminKey);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message });
  }
}

async function updateColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    await adminService.actualizarItemColaAdmin(hashLargo, req.body);
    return res.json({ success: true, message: 'Registro de cola actualizado correctamente.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    await adminService.eliminarItemColaAdmin(hashLargo, adminKey);
    return res.json({ success: true, message: 'Registro eliminado permanentemente de todas las tablas.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getColaAdmin,
  updateColaAdmin,
  deleteColaAdmin
};
