/**
 * @file tasasRoutes.js
 * @description Registro de endpoints REST para el dominio de Tasas.
 */

const express = require('express');
const router = express.Router();
const {
  obtenerTasaActualController,
  publicarYDespacharTasaController
} = { ...require('../controllers/tasasController') };

router.get('/actual', obtenerTasaActualController);
router.post('/publicar', publicarYDespacharTasaController);

module.exports = router;
