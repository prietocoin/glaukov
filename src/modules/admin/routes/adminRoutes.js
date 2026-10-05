/**
 * @file adminRoutes.js
 * @description Endpoints de administración para inspección directa de la cola.
 */

const express = require('express');
const router = express.Router();
const {
  getColaAdmin,
  updateColaAdmin,
  deleteColaAdmin
} = require('../controllers/adminController');

router.get('/cola', getColaAdmin);
router.put('/cola/:hashLargo', updateColaAdmin);
router.delete('/cola/:hashLargo', deleteColaAdmin);

module.exports = router;
