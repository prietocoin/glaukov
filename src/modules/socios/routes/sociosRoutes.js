/**
 * @file sociosRoutes.js
 * @description Endpoints REST para el dominio de Socios y Directorio.
 */

const express = require('express');
const router = express.Router();
const {
  obtenerDirectorioController,
  actualizarEstadoSocioController
} = require('../controllers/sociosController');

router.get('/directorio', obtenerDirectorioController);
router.patch('/estado', actualizarEstadoSocioController);

module.exports = router;
