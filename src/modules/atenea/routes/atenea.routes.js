const express = require('express');
const router = express.Router();
const ateneaController = require('../controllers/atenea.controller');

// ==========================================
// 1. PREVISUALIZACIÓN Y DISPARO DE CARTELERAS
// ==========================================
router.get('/preview-data', ateneaController.previewData);
router.get('/preview-image/:identificador?', ateneaController.previewImage);
router.all('/disparar', ateneaController.dispararWhatsApp);

// ==========================================
// 2. AUDITORÍA DE COMPROBANTES
// ==========================================
router.get('/comprobantes', ateneaController.getComprobantes);
router.get('/cola', ateneaController.getComprobantes);
router.put('/comprobantes/:hashLargo', ateneaController.updateComprobante);
router.delete('/comprobantes/:hashLargo', ateneaController.deleteComprobante);

// ==========================================
// 3. TASAS Y MERCADO (HOO / N8N)
// ==========================================
router.get('/tasas/ultimas', ateneaController.getUltimasTasas);
router.post('/tasas/n8n-webhook', ateneaController.postN8nWebhook);
router.get('/tasas/fetch-hoo', ateneaController.getFetchHoo);
router.post('/tasas/publicar', ateneaController.postPublicarTasa);
router.post('/tasas/reenviar', ateneaController.postReenviarTasa);

// ==========================================
// 4. DIRECTORIO Y SOCIOS (nombres_fb)
// ==========================================
router.get('/directorio', ateneaController.getDirectorio);
router.get('/socios', ateneaController.getSocios);
router.post('/socios/config', ateneaController.postSocioConfig);
router.patch('/socios/desactivar-todos', ateneaController.patchDesactivarTodos);
router.post('/socios/guardar-vigentes', ateneaController.postGuardarVigentes);
router.post('/socios/restaurar-vigentes', ateneaController.postRestaurarVigentes);
router.patch('/socios/:nombre/estado', ateneaController.patchSocioEstado);
router.delete('/directorio/:nombre', ateneaController.deleteSocio);

// ==========================================
// 5. REPORTES Y ESTADOS DE CUENTA
// ==========================================
router.get('/reportes', ateneaController.getComprobantes);
router.get('/reportes/operaciones', ateneaController.getComprobantes);
router.get('/reportes/filtros', ateneaController.getReportesFiltros);
router.post('/reportes/enviar-whatsapp', ateneaController.postEnviarReporteWhatsApp);

// ==========================================
// 6. CONSOLA DE ADMINISTRACIÓN COLA (RAW)
// ==========================================
router.get('/admin/cola', ateneaController.getColaAdmin);
router.put('/admin/cola/:hashLargo', ateneaController.updateColaAdmin);
router.delete('/admin/cola/:hashLargo', ateneaController.deleteColaAdmin);

module.exports = router;
