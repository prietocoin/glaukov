const express = require('express');
const router = express.Router();
const { obtenerSociosYProcesarTasas } = require('../services/atenea.service');
const { generarImagenTasa } = require('../../render/services/puppeteer.service');

// Endpoint de prueba: Procesa la matriz y retorna el JSON estructurado de los socios
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

// Endpoint de prueba: Renderiza la imagen de un socio y la devuelve directamente como JPEG
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

module.exports = router;
