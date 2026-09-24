const comprobantesService = require('../services/comprobantes.service');
const directorioService = require('../services/directorio.service');
const ateneaService = require('../services/atenea.service');
const { generarImagenTasa } = require('../../render/services/puppeteer.service');

// ==========================================
// 1. GESTIÓN DE COMPROBANTES Y AUDITORÍA
// ==========================================

async function getComprobantes(req, res) {
  try {
    const data = await comprobantesService.obtenerComprobantesAuditados(req.query);
    res.json(data);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en getComprobantes:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function updateComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    const actualizado = await comprobantesService.actualizarComprobante(hashLargo, req.body);
    res.json({ success: true, data: actualizado });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en updateComprobante:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function deleteComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    await comprobantesService.eliminarComprobante(hashLargo);
    res.json({ success: true, message: 'Comprobante descartado correctamente.' });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en deleteComprobante:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ==========================================
// 2. DIRECTORIO Y REGLAS DE SOCIOS
// ==========================================

async function getDirectorio(req, res) {
  try {
    const directorio = await directorioService.obtenerDirectorio();
    res.json(directorio);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en getDirectorio:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function getSocios(req, res) {
  try {
    const lista = await directorioService.obtenerListaSocios();
    res.json(lista);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en getSocios:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function postSocioConfig(req, res) {
  try {
    const socioGuardado = await directorioService.guardarConfigSocio(req.body);
    res.json({ success: true, data: socioGuardado });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en postSocioConfig:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function patchSocioEstado(req, res) {
  try {
    const { nombre } = req.params;
    const { activo } = req.body;
    const socio = await directorioService.cambiarEstadoSocio(nombre, activo);
    res.json({ success: true, data: socio });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en patchSocioEstado:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function patchDesactivarTodos(req, res) {
  try {
    const resultado = await directorioService.desactivarTodosSocios();
    res.json(resultado);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en patchDesactivarTodos:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function postGuardarVigentes(req, res) {
  try {
    const resultado = await directorioService.guardarSociosVigentes();
    res.json(resultado);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en postGuardarVigentes:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function postRestaurarVigentes(req, res) {
  try {
    const resultado = await directorioService.restaurarSociosVigentes();
    res.json(resultado);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en postRestaurarVigentes:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function deleteSocio(req, res) {
  try {
    const { nombre } = req.params;
    await directorioService.eliminarSocio(nombre);
    res.json({ success: true, message: `Socio ${nombre} eliminado del directorio.` });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en deleteSocio:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ==========================================
// 3. PREVISUALIZACIÓN Y DISPARO DE TARJETAS
// ==========================================

async function previewData(req, res) {
  try {
    const filtroSocio = req.query.socio || null;
    const socios = await ateneaService.obtenerSociosYProcesarTasas(filtroSocio);
    res.json({
      success: true,
      total_socios: socios.length,
      data: socios
    });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en previewData:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function previewImage(req, res) {
  try {
    const idParam = req.params.identificador || '0';
    let socioTarget = null;

    if (!isNaN(idParam)) {
      const index = parseInt(idParam, 10);
      const socios = await ateneaService.obtenerSociosYProcesarTasas();
      socioTarget = socios[index];
    } else {
      const socios = await ateneaService.obtenerSociosYProcesarTasas(idParam);
      socioTarget = socios[0];
    }

    if (!socioTarget) {
      return res.status(404).json({ success: false, message: 'Socio no encontrado o inactivo.' });
    }

    const imageBuffer = await generarImagenTasa(socioTarget);
    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en previewImage:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function dispararWhatsApp(req, res) {
  try {
    const filtroSocio = req.query.socio || req.body?.socio || null;
    const resultado = await ateneaService.encolarNotificacionesTasas(filtroSocio);
    res.json({ success: true, ...resultado });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en dispararWhatsApp:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getComprobantes,
  updateComprobante,
  deleteComprobante,
  getDirectorio,
  getSocios,
  postSocioConfig,
  patchSocioEstado,
  patchDesactivarTodos,
  postGuardarVigentes,
  postRestaurarVigentes,
  deleteSocio,
  previewData,
  previewImage,
  dispararWhatsApp
};
