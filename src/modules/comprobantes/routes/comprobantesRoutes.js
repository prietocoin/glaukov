/**
 * @file comprobantesRoutes.js
 * @description Endpoints REST para auditoría, liquidación y re-lectura IA.
 */

const express = require('express');
const router = express.Router();
const {
  getComprobantes,
  liquidarComprobante,
  releerIA,
  updateComprobante,
  deleteComprobante
} = require('../controllers/comprobantesController');

router.get('/', getComprobantes);
router.post('/liquidar', liquidarComprobante);
router.post('/:hashLargo/releer', releerIA);
router.put('/:hashLargo', updateComprobante);
router.delete('/:hashLargo', deleteComprobante);

module.exports = router;
