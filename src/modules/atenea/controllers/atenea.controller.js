const comprobantesService = require('../services/comprobantes.service');
const directorioService = require('../services/directorio.service');
const tasasService = require('../services/tasas.service');
const mercadoService = require('../services/mercado.service');
const reportesService = require('../services/reportes.service');
const adminService = require('../services/admin.service');
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
    const socios = await tasasService.obtenerSociosYProcesarTasas(filtroSocio);
    res.json({ success: true, total_socios: socios.length, data: socios });
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
      const socios = await tasasService.obtenerSociosYProcesarTasas();
      socioTarget = socios[index];
    } else {
      const socios = await tasasService.obtenerSociosYProcesarTasas(idParam);
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
    const resultado = await tasasService.encolarNotificacionesTasas(filtroSocio);
    res.json({ success: true, ...resultado });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en dispararWhatsApp:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 4. MERCADO & INTEGRACIÓN HOO API
// ==========================================

async function getUltimasTasas(req, res) {
  try {
    const resultado = await mercadoService.obtenerUltimasTasas();
    res.json(resultado);
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en getUltimasTasas:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function postN8nWebhook(req, res) {
  try {
    const borrador = mercadoService.guardarBorradorTasas(req.body);
    res.json({ success: true, message: 'Borrador cargado en memoria', rates: borrador });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en postN8nWebhook:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function fetchHoo(req, res) {
  try {
    const borrador = mercadoService.obtenerBorradorTasas();
    if (!borrador) {
      return res.status(404).json({ success: false, msg: 'No se ha recibido un borrador de n8n o Hoo recientemente.' });
    }
    res.json({ success: true, rates: borrador });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en fetchHoo:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function publicarTasa(req, res) {
  try {
    const { id_tasa, tasas } = req.body;
    const resultado = await mercadoService.publicarTasaOficial(id_tasa, tasas);
    res.json({ success: true, ...resultado, message: `Tasa ${resultado.id_tasa} publicada a producción correctamente.` });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en publicarTasa:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function reenviarTasa(req, res) {
  try {
    const { id_tasa } = req.body;
    const resultado = await mercadoService.reenviarTasa(id_tasa);
    res.json({ success: true, ...resultado, message: `Reenvío activado para la tasa ${resultado.id_tasa}` });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en reenviarTasa:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 5. REPORTES & WHATSAPP
// ==========================================

async function enviarWhatsAppReporte(req, res) {
  try {
    const resultado = await reportesService.enviarReporteWhatsApp(req.body);
    res.json({ success: true, message: 'Reporte enviado a WhatsApp exitosamente.', ...resultado });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en enviarWhatsAppReporte:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getFiltrosReportes(req, res) {
  try {
    const filtros = await reportesService.obtenerFiltrosReportes(req.query.rol);
    res.json({ success: true, ...filtros });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en getFiltrosReportes:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 6. ADMINISTRACIÓN DE COLA (RAW)
// ==========================================

async function getColaAdmin(req, res) {
  try {
    const claveAdmin = req.headers['x-admin-key'];
    const cola = await adminService.obtenerColaAdmin(claveAdmin);
    res.json({ success: true, data: cola });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en getColaAdmin:', err.message);
    res.status(401).json({ success: false, error: err.message });
  }
}

async function putColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    const resultado = await adminService.actualizarItemColaAdmin(hashLargo, req.body);
    res.json({ success: true, ...resultado, message: 'Registro de cola actualizado correctamente.' });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en putColaAdmin:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    const claveAdmin = req.headers['x-admin-key'] || req.body?.adminKey;
    const resultado = await adminService.eliminarItemColaAdmin(hashLargo, claveAdmin);
    res.json({ success: true, ...resultado, message: 'Registro eliminado permanentemente de todas las tablas.' });
  } catch (err) {
    console.error('[Atenea Controller ❌] Error en deleteColaAdmin:', err.message);
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
  dispararWhatsApp,
  getUltimasTasas,
  postN8nWebhook,
  fetchHoo,
  publicarTasa,
  reenviarTasa,
  enviarWhatsAppReporte,
  getFiltrosReportes,
  getColaAdmin,
  putColaAdmin,
  deleteColaAdmin
};
