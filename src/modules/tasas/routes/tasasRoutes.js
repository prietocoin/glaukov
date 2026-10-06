/**
 * @file tasasRoutes.js
 * @description Registro de endpoints de Tasas con aliases de compatibilidad.
 */

const express = require('express');
const router = express.Router();
const {
  obtenerTasaActualController,
  publicarYDespacharTasaController
} = require('../controllers/tasasController');

// Rutas directas y aliases
router.get('/', obtenerTasaActualController);
router.get('/actual', obtenerTasaActualController);
router.get('/mercado', obtenerTasaActualController);
router.get('/ultimas', obtenerTasaActualController);
router.post('/publicar', publicarYDespacharTasaController);

module.exports = router;
