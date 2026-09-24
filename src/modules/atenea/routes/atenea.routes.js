const express = require('express');
const router = express.Router();
const { obtenerSociosYProcesarTasas, encolarNotificacionesTasas } = require('../services/atenea.service');
const { generarImagenTasa } = require('../../render/services/puppeteer.service');

// Preview JSON (acepta ?socio=nelsy)
router.get('/preview-data', async (req, res) => {
  try {
    const filtroSocio = req.query.socio || null;
    const socios = await obtenerSociosYProcesarTasas(filtroSocio);
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

// Preview de Imagen (acepta índice número o nombre directo: /preview-image/nelsy)
router.get('/preview-image/:identificador?', async (req, res) => {
  try {
    const idParam = req.params.identificador || '0';
    let socioTarget = null;

    if (!isNaN(idParam)) {
      const index = parseInt(idParam, 10);
      const socios = await obtenerSociosYProcesarTasas();
      socioTarget = socios[index];
    } else {
      const socios = await obtenerSociosYProcesarTasas(idParam);
      socioTarget = socios[0];
    }

    if (!socioTarget) {
      return res.status(404).json({ success: false, message: 'Socio no encontrado' });
    }

    const imageBuffer = await generarImagenTasa(socioTarget);
    
    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);
  } catch (error) {
    console.error('[Atenea API ❌] Error generando imagen preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disparar por WhatsApp (acepta ?socio=nelsy)
router.all('/disparar', async (req, res) => {
  try {
    const filtroSocio = req.query.socio || req.body?.socio || null;
    const resultado = await encolarNotificacionesTasas(filtroSocio);
    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('[Atenea API ❌] Error al disparar tareas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
