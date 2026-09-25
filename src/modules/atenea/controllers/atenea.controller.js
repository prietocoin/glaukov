const tasasService = require('../services/tasas.service');
const directorioService = require('../services/directorio.service');
const comprobantesService = require('../services/comprobantes.service');
const mercadoService = require('../services/mercado.service');
const reportesService = require('../services/reportes.service');
const adminService = require('../services/admin.service');
const { generarImagenTasa } = require('../../render/services/puppeteer.service');

// ==========================================
// 1. PREVISUALIZACIÓN Y DISPARO DE CARTELERAS
// ==========================================
async function previewData(req, res) {
  try {
    const fn = tasasService.obtenerCarteleraConsolidada || tasasService.obtenerSociosYProcesarTasas;
    const data = await fn();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function previewImage(req, res) {
  try {
    const fn = tasasService.obtenerCarteleraConsolidada || tasasService.obtenerSociosYProcesarTasas;
    const data = await fn();
    const socio = (req.params.identificador || 'GENERAL').toUpperCase();
    const targetData = data.find(d => d.nombre_socio && d.nombre_socio.toUpperCase() === socio) || data[0];

    if (!targetData) {
      return res.status(404).send('No se encontraron datos para generar la imagen.');
    }

    const imageBuffer = await generarImagenTasa(targetData);
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(imageBuffer);
  } catch (err) {
    res.status(500).send(`Error generando imagen: ${err.message}`);
  }
}

async function dispararWhatsApp(req, res) {
  try {
    const fn = tasasService.dispararPublicacionCartelera || tasasService.encolarNotificacionesTasas;
    const resultado = await fn();
    res.json({ success: true, ...resultado });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 2. AUDITORÍA DE COMPROBANTES
// ==========================================
async function getComprobantes(req, res) {
  try {
    const datos = await comprobantesService.obtenerComprobantesAuditados(req.query);
    res.json(datos || []);
  } catch (err) {
    console.error('❌ Error GET /api/comprobantes:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function updateComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    const actualizado = await comprobantesService.actualizarComprobante(hashLargo, req.body);
    res.json({ success: true, data: actualizado });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteComprobante(req, res) {
  try {
    const { hashLargo } = req.params;
    const resultado = await comprobantesService.eliminarComprobante(hashLargo);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 3. TASAS Y MERCADO (HOO / N8N)
// ==========================================
async function getUltimasTasas(req, res) {
  try {
    const resultado = await mercadoService.obtenerUltimasTasas();
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function postN8nWebhook(req, res) {
  try {
    const rates = mercadoService.guardarBorradorTasas(req.body);
    res.json({ success: true, message: 'Borrador cargado en memoria', rates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function getFetchHoo(req, res) {
  const rates = mercadoService.obtenerBorradorTasas();
  if (!rates) {
    return res.status(404).json({ success: false, msg: 'El motor de n8n aún no ha enviado un borrador reciente.' });
  }
  res.json({ success: true, rates });
}

async function postPublicarTasa(req, res) {
  try {
    const { id_tasa, tasas } = req.body;
    const resultado = await mercadoService.publicarTasaOficial(id_tasa, tasas);
    res.json({ success: true, ...resultado, message: `Tasa ${resultado.id_tasa} publicada correctamente` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function postReenviarTasa(req, res) {
  try {
    const { id_tasa } = req.body;
    const resultado = await mercadoService.reenviarTasa(id_tasa);
    res.json({ success: true, ...resultado, message: `Reenvío activado para la tasa ${resultado.id_tasa}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 4. DIRECTORIO Y SOCIOS (nombres_fb)
// ==========================================
async function getDirectorio(req, res) {
  try {
    const fn = directorioService.obtenerDirectorio || directorioService.obtenerDirectorioCompleto;
    const directorio = await fn();
    res.json(directorio || []);
  } catch (err) {
    console.error('❌ Error GET /api/directorio:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getSocios(req, res) {
  try {
    const fn = directorioService.obtenerListaSocios || directorioService.obtenerNombresSocios;
    const socios = await fn();
    res.json(socios || []);
  } catch (err) {
    console.error('❌ Error GET /api/socios:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function postSocioConfig(req, res) {
  try {
    const fn = directorioService.guardarConfigSocio || directorioService.guardarSocioConfig;
    const socio = await fn(req.body);
    res.json({ success: true, data: socio });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function patchDesactivarTodos(req, res) {
  try {
    await directorioService.desactivarTodosSocios();
    res.json({ success: true, message: 'Todos los socios desactivados correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function postGuardarVigentes(req, res) {
  try {
    const fn = directorioService.guardarSociosVigentes || directorioService.guardarVigentes;
    await fn();
    res.json({ success: true, message: 'Plantilla de socios activos memorizada correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function postRestaurarVigentes(req, res) {
  try {
    const fn = directorioService.restaurarSociosVigentes || directorioService.restaurarVigentes;
    await fn();
    res.json({ success: true, message: 'Socios vigentes restaurados correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function patchSocioEstado(req, res) {
  try {
    const { nombre } = req.params;
    const { activo } = req.body;
    const fn = directorioService.cambiarEstadoSocio || directorioService.patchEstadoSocio;
    const socio = await fn(nombre, activo);
    res.json({ success: true, data: socio });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteSocio(req, res) {
  try {
    const { nombre } = req.params;
    const fn = directorioService.eliminarSocio || directorioService.eliminarSocioDirectorio;
    const resultado = await fn(nombre);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 5. REPORTES Y ESTADOS DE CUENTA
// ==========================================
async function getReportesFiltros(req, res) {
  try {
    const filtros = await reportesService.obtenerFiltrosReportes(req.query.rol);
    res.json({ success: true, ...filtros });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function postEnviarReporteWhatsApp(req, res) {
  try {
    const resultado = await reportesService.enviarReporteWhatsApp(req.body);
    res.json({ success: true, message: 'Reporte enviado con éxito.', ...resultado });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 6. CONSOLA DE ADMINISTRACIÓN COLA (RAW)
// ==========================================
async function getColaAdmin(req, res) {
  try {
    const adminKey = req.headers['x-admin-key'];
    const data = await adminService.obtenerColaAdmin(adminKey);
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
}

async function updateColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    await adminService.actualizarItemColaAdmin(hashLargo, req.body);
    res.json({ success: true, message: 'Registro de cola actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteColaAdmin(req, res) {
  try {
    const { hashLargo } = req.params;
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    await adminService.eliminarItemColaAdmin(hashLargo, adminKey);
    res.json({ success: true, message: 'Registro eliminado permanentemente de todas las tablas.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  previewData,
  previewImage,
  dispararWhatsApp,
  getComprobantes,
  updateComprobante,
  deleteComprobante,
  getUltimasTasas,
  postN8nWebhook,
  getFetchHoo,
  postPublicarTasa,
  postReenviarTasa,
  getDirectorio,
  getSocios,
  postSocioConfig,
  patchDesactivarTodos,
  postGuardarVigentes,
  postRestaurarVigentes,
  patchSocioEstado,
  deleteSocio,
  getReportesFiltros,
  postEnviarReporteWhatsApp,
  getColaAdmin,
  updateColaAdmin,
  deleteColaAdmin
};
