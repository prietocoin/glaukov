/**
 * @file reportesRoutes.js
 * @description Endpoints REST para reportes y despachos de imágenes por WhatsApp.
 */

const express = require('express');
const router = express.Router();
const {
  getReportesFiltros,
  postEnviarReporteWhatsApp,
  postEnviarMediaWhatsApp
} = require('../controllers/reportesController');

router.get('/filtros', getReportesFiltros);
router.post('/enviar-whatsapp', postEnviarReporteWhatsApp);
router.post('/enviar-media', postEnviarMediaWhatsApp);

module.exports = router;
