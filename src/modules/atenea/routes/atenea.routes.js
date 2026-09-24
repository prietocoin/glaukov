const express = require('express');
const router = express.Router();
const ateneaController = require('../controllers/atenea.controller');

// ==========================================
// 1. RUTAS PREVIAS (CONECTADAS AL CONTROLADOR)
// ==========================================
// Preview JSON de socios y tasas (?socio=nelsy)
router.get('/preview-data', ateneaController.previewData);

// Preview de imagen formateada (/preview-image/nelsy o /preview-image/0)
router.get('/preview-image/:identificador?', ateneaController.previewImage);

// Disparo de notificaciones por WhatsApp (?socio=nelsy)
router.all('/disparar', ateneaController.dispararWhatsApp);

// ==========================================
// 2. AUDITORÍA DE COMPROBANTES (comprobantes_raw)
// ==========================================
router.get('/comprobantes', ateneaController.getComprobantes);
router.put('/comprobantes/:hashLargo', ateneaController.updateComprobante);
router.delete('/comprobantes/:hashLargo', ateneaController.deleteComprobante);

// ==========================================
// 3. DIRECTORIO Y REGLAS DE SOCIOS (nombres_fb)
// ==========================================
router.get('/directorio', ateneaController.getDirectorio);
router.get('/socios', ateneaController.getSocios);
router.post('/socios/config', ateneaController.postSocioConfig);
router.patch('/socios/desactivar-todos', ateneaController.patchDesactivarTodos);
router.post('/socios/guardar-vigentes', ateneaController.postGuardarVigentes);
router.post('/socios/restaurar-vigentes', ateneaController.postRestaurarVigentes);
router.patch('/socios/:nombre/estado', ateneaController.patchSocioEstado);
router.delete('/directorio/:nombre', ateneaController.deleteSocio);

module.exports = router;
