const express = require('express');
const router = express.Router();
const { obtenerSociosYProcesarTasas, encolarNotificacionesTasas } = require('../services/atenea.service');
const { generarImagenTasa } = require('../../render/services/puppeteer.service');

// Vista previa de datos en JSON
router.get('/preview-data', async (req, res) => {
  try {
    const socios = await obtenerSociosYProcesarTasas();
    res.json({
      success: true,
      total_socios: socios.length,
      data: socios
    });
  } catch (error) {
    console.error('[Atenea API ❌] Error procesando datos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Renderizado directo de la imagen JPEG
router.get('/preview-image/:index?', async (req, res) => {
  try {
    const socios = await obtenerSociosYProcesarTasas();
    const index = parseInt(req.params.index || '0', 10);
    
    if (!socios[index]) {
      return res.status(404).json({ success: false, message: 'Socio no encontrado en el índice' });
    }

    const imageBuffer = await generarImagenTasa(socios[index]);
    
    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);
  } catch (error) {
    console.error('[Atenea API ❌] Error generando imagen preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Permite tanto GET como POST para disparar las tareas directamente desde el navegador
router.all('/disparar', async (req, res) => {
  try {
    const resultado = await encolarNotificacionesTasas();
    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('[Atenea API ❌] Error al disparar tareas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
