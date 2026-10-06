/**
 * @file sociosRoutes.js
 * @description Endpoints REST para socios y directorio.
 */

const express = require('express');
const router = express.Router();
const {
  obtenerDirectorioController,
  actualizarEstadoSocioController
} = require('../controllers/sociosController');

router.get('/', obtenerDirectorioController);
router.get('/directorio', obtenerDirectorioController);
router.patch('/estado', actualizarEstadoSocioController);

module.exports = router;
