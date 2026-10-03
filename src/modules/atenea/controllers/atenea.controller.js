const tasasService = require('../services/tasas.service');
const directorioService = require('../services/directorio.service');
const comprobantesService = require('../services/comprobantes.service');
const mercadoService = require('../services/mercado.service');
const reportesService = require('../services/reportes.service');
const adminService = require('../services/admin.service');
const { generarImagenTasa } = require('../../render/services/puppeteer.service');
const db = require('../../../config/db'); // 🟢 Base de datos cargada

// Helper de pausa para rate-limiting en envíos masivos de WhatsApp
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    let data = [];
    try { data = (await fn()) || []; } catch (e) { console.error('⚠️ DB Timeout:', e.message); }

    const rawSocio = (req.params.identificador || req.params.socio || req.query.socio || 'GENERAL');
    const socioBuscado = String(rawSocio).trim().toUpperCase();

    // 1. Intentar buscar en la cartelera consolidada
    let foundData = data.find(d => {
      const nombreItem = String(d.nombre_socio || d.nombre || d.socio || '').trim().toUpperCase();
      return nombreItem === socioBuscado;
    });

    // 2. Si no está en la cartelera, buscar en el Directorio
    if (!foundData) {
      try {
        const fnDir = directorioService.obtenerDirectorio || directorioService.obtenerDirectorioCompleto;
        const directorio = (await fnDir()) || [];
        const socioObj = directorio.find(s => String(s.nombre || '').trim().toUpperCase() === socioBuscado);

        if (socioObj) {
          if (typeof tasasService.procesarTasasSocio === 'function') {
            foundData = await tasasService.procesarTasasSocio(socioObj);
          } else if (typeof tasasService.construirCarteleraSocio === 'function') {
            foundData = await tasasService.construirCarteleraSocio(socioObj);
          } else {
            foundData = {
              nombre_socio: socioObj.nombre,
              roles: socioObj.roles,
              moneda_socio: socioObj.moneda_socio || socioObj.monedasocio || 'USDT',
              ajustes: typeof socioObj.ajustes === 'string' ? JSON.parse(socioObj.ajustes || '{}') : (socioObj.ajustes || {}),
              cartelera_paises: socioObj.cartelera_paises || []
            };
          }
        }
      } catch (dirErr) {
        console.error('⚠️ Error al consultar directorio:', dirErr.message);
      }
    }

    // 3. Fallback dinámico leyendo la última tasa de la BD
    let targetData;
    if (foundData) {
      targetData = JSON.parse(JSON.stringify(foundData));
    } else if (data.length > 0) {
      targetData = JSON.parse(JSON.stringify(data[0]));
    } else {
      let ultimoLote = 'T001';
      try {
        const ult = await mercadoService.obtenerUltimasTasas();
        if (ult && ult.id_tasa) ultimoLote = ult.id_tasa;
      } catch (e) {}

      targetData = {
        nombre_socio: socioBuscado,
        moneda_socio: 'USDT',
        lote_tasa: ultimoLote,
        tasa_base_ref: ultimoLote,
        cartelera_paises: [
          { moneda: 'ARS', pais: 'Argentina', activo: true, compra: '1664', venta: '1536' },
          { moneda: 'VES', pais: 'Venezuela', activo: true, compra: '988', venta: '953' },
          { moneda: 'PEN', pais: 'Peru', activo: true, compra: '3.48', venta: '3.35' },
          { moneda: 'COP', pais: 'Colombia', activo: true, compra: '3386', venta: '3253' },
          { moneda: 'CLP', pais: 'Chile', activo: true, compra: '996', venta: '957' }
        ]
      };
    }

    // 4. Forzar el nombre dinámico del socio
    targetData.nombre_socio = socioBuscado;
    targetData.nombre = socioBuscado;
    targetData.socio = socioBuscado;

    // 5. Renderizar y responder imagen
    const imageBuffer = await generarImagenTasa(targetData);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.send(imageBuffer);

  } catch (err) {
    console.error('❌ Error generando imagen:', err);
    return res.status(500).send(`Error generando imagen: ${err.message}`);
  }
}

// 🟢 DISPARO MASIVO DE CARTELERAS
async function dispararWhatsApp(req, res) {
  try {
    const bodyObj = req?.body || {};
    const queryObj = req?.query || {};

    const esModoPrueba = bodyObj.modoPrueba === true || bodyObj.esPrueba === true || queryObj.modoPrueba === 'true';
    
    const jidPruebaRaw = esModoPrueba 
      ? process.env.TEST_JID_OVERRIDE 
      : (bodyObj.jidPrueba || queryObj.jidPrueba || null);

    const jidPrueba = jidPruebaRaw ? String(jidPruebaRaw).trim() : null;
    const delayMs = parseInt(bodyObj.delayMs || process.env.WHATSAPP_DELAY_MS || '3000', 10);

    if (jidPrueba) {
      console.log(`🧪 [MODO PRUEBA BATCH] Redirigiendo carteleras al grupo test: ${jidPrueba}`);
    } else {
      console.log(`🚀 [MODO OFICIAL] Disparando ráfaga masiva a canales oficiales con pausa de ${delayMs}ms.`);
    }

    if (typeof tasasService.dispararPublicacionCartelera === 'function') {
      const resultado = await tasasService.dispararPublicacionCartelera({ 
        jidOverride: jidPrueba, 
        destinationJid: jidPrueba,
        delayMs 
      });
      
      const payload = { 
        success: true, 
        ...resultado, 
        modoPrueba: !!jidPrueba,
        message: jidPrueba ? `🧪 Lote enviado al grupo de prueba ${jidPrueba}` : '🚀 Carteleras enviadas a todos los socios' 
      };

      if (res && typeof res.json === 'function') return res.json(payload);
      return payload;
    }

    const fnConsolidada = tasasService.obtenerCarteleraConsolidada || tasasService.obtenerSociosYProcesarTasas;
    const carteleras = (await fnConsolidada()) || [];
    const fnMedia = reportesService.enviarMediaWhatsApp || reportesService.enviarReporteMediaWhatsApp;

    const envios = [];
    for (let i = 0; i < carteleras.length; i++) {
      const targetData = carteleras[i];
      const socioNombre = String(targetData.nombre_socio || targetData.nombre || 'SOCIO').toUpperCase().trim();

      console.log(`[Batch WA 📤 (${i + 1}/${carteleras.length})] Generando cartelera para ${socioNombre}...`);
      const imageBuffer = await generarImagenTasa(targetData);
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      let envRes;
      if (typeof fnMedia === 'function') {
        envRes = await fnMedia({ 
          socio: socioNombre, 
          base64: base64Image,
          jidOverride: jidPrueba 
        });
      } else {
        envRes = await mercadoService.reenviarTasa(bodyObj.id_tasa, socioNombre, jidPrueba);
      }

      envios.push({ socio: socioNombre, ok: true, detail: envRes });

      if (i < carteleras.length - 1) {
        await sleep(delayMs);
      }
    }

    const responsePayload = {
      success: true,
      procesados: envios.length,
      modoPrueba: !!jidPrueba,
      destino: jidPrueba || 'GRUPOS_OFICIALES',
      envios
    };

    if (res && typeof res.json === 'function') {
      return res.json(responsePayload);
    }
    return responsePayload;

  } catch (err) {
    console.error('❌ Error en disparo masivo de WhatsApp:', err.message);
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ success: false, error: err.message });
    }
    throw err;
  }
}

// ==========================================
// 2. AUDITORÍA DE COMPROBANTES Y LIQUIDACIONES
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

async function liquidarComprobante(req, res) {
  try {
    const fn = comprobantesService.liquidarComprobante || comprobantesService.guardarLiquidacion;
    const resultado = await fn(req.body);
    res.json({ success: true, message: 'Liquidación registrada correctamente', data: resultado });
  } catch (err) {
    console.error('❌ Error POST /api/comprobantes/liquidar:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function releerIA(req, res) {
  try {
    const { hashLargo } = req.params;
    const resultado = await comprobantesService.releerIA(hashLargo);
    res.json(resultado);
  } catch (err) {
    console.error('❌ Error POST /api/comprobantes/:hashLargo/releer:', err.message);
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
// 3. TASAS Y MERCADO (HOO / API)
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

async function getFetchHoo(req, res) {
  try {
    let rates = null;
    if (typeof mercadoService.consultarApiHoo === 'function') {
      rates = await mercadoService.consultarApiHoo();
    } else {
      rates = mercadoService.obtenerBorradorTasas();
    }

    if (!rates || Object.keys(rates).length === 0) {
      const ultimas = await mercadoService.obtenerUltimasTasas();
      rates = ultimas.tasas || {};
    }

    return res.json({ success: true, rates });
  } catch (err) {
    console.error('⚠️ Error procesando GET /api/tasas/fetch-hoo:', err.message);
    try {
      const ultimas = await mercadoService.obtenerUltimasTasas();
      return res.json({
        success: true,
        rates: ultimas.tasas || {},
        warning: 'Respuesta recuperada desde base de datos'
      });
    } catch (dbErr) {
      return res.json({ success: true, rates: {} });
    }
  }
}

// 🟢 PUBLICACIÓN DE TASA (ACTUALIZADO CON INSERT PARA N8N)
async function postPublicarTasa(req, res) {
  try {
    const { id_tasa, tasas } = req.body;
    
    // 1. Guardar el nuevo lote en tasas_glaukov
    const resultado = await mercadoService.publicarTasaOficial(id_tasa, tasas);
    console.log(`[Publicar Tasa 🚀] Lote ${resultado.id_tasa} guardado en tasas_glaukov.`);

    // ⚡ INSERTAR EN notificaciones_tasas (DISPARA EL TRIGGER DE N8N)
    try {
      await db.query(
        `INSERT INTO notificaciones_tasas (id_tasa) VALUES ($1)`,
        [resultado.id_tasa]
      );
      console.log(`[Trigger n8n 🔔] Inserción registrada en notificaciones_tasas para: ${resultado.id_tasa}`);
    } catch (notifErr) {
      console.error('❌ Error al insertar en notificaciones_tasas:', notifErr.message);
    }

    // 2. Disparar el envío masivo en segundo plano
    dispararWhatsApp(req, null)
      .then(resWa => console.log('✅ Despacho masivo completado:', resWa?.procesados || 0, 'socios'))
      .catch(errWa => console.error('❌ Error en disparo masivo:', errWa.message));

    // 3. Responder de inmediato al Dashboard
    return res.json({ 
      success: true, 
      ...resultado, 
      message: `Tasa oficial ${resultado.id_tasa} publicada correctamente. Enviando carteleras por WhatsApp...` 
    });

  } catch (err) {
    console.error('❌ Error en postPublicarTasa:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 🟢 REENVÍO DE TASA
async function postReenviarTasa(req, res) {
  const rawSocio = req.body && typeof req.body.socio === 'string' ? req.body.socio : 'GENERAL';
  const socioBuscado = String(rawSocio).trim().toUpperCase();

  console.log(`[Reenviar Tasa ⚡] Solicitud de reenvío para: ${socioBuscado}`);

  try {
    if (socioBuscado === 'GENERAL') {
      return await dispararWhatsApp(req, res);
    }

    const esModoPrueba = req.body?.modoPrueba === true || req.body?.esPrueba === true;
    const jidPruebaRaw = esModoPrueba ? process.env.TEST_JID_OVERRIDE : (req.body?.jidPrueba || null);
    const jidPrueba = jidPruebaRaw ? String(jidPruebaRaw).trim() : null;

    const fn = tasasService.obtenerCarteleraConsolidada || tasasService.obtenerSociosYProcesarTasas;
    let data = [];
    try { data = (await fn()) || []; } catch (e) { console.error('⚠️ DB Timeout:', e.message); }

    let targetData = data.find(d => {
      const n = String(d.nombre_socio || d.nombre || d.socio || '').trim().toUpperCase();
      return n === socioBuscado;
    });

    if (!targetData) {
      const fnDir = directorioService.obtenerDirectorio || directorioService.obtenerDirectorioCompleto;
      const directorio = (await fnDir()) || [];
      const socioObj = directorio.find(s => String(s.nombre || '').trim().toUpperCase() === socioBuscado);
      if (socioObj) {
        targetData = {
          nombre_socio: socioObj.nombre,
          roles: socioObj.roles,
          moneda_socio: socioObj.moneda_socio || socioObj.monedasocio || 'USDT',
          ajustes: typeof socioObj.ajustes === 'string' ? JSON.parse(socioObj.ajustes || '{}') : (socioObj.ajustes || {}),
          cartelera_paises: socioObj.cartelera_paises || []
        };
      }
    }

    if (!targetData && data.length > 0) targetData = JSON.parse(JSON.stringify(data[0]));
    if (!targetData) throw new Error(`No existen datos para el socio ${socioBuscado}`);

    targetData.nombre_socio = socioBuscado;
    targetData.nombre = socioBuscado;

    const imageBuffer = await generarImagenTasa(targetData);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const fnMedia = reportesService.enviarMediaWhatsApp || reportesService.enviarReporteMediaWhatsApp;
    
    let envRes;
    if (typeof fnMedia === 'function') {
      envRes = await fnMedia({ socio: socioBuscado, base64: base64Image, jidOverride: jidPrueba });
    } else {
      envRes = await mercadoService.reenviarTasa(req.body.id_tasa, socioBuscado, jidPrueba);
    }

    return res.json({ success: true, message: `Cartelera enviada a ${socioBuscado}`, result: envRes });

  } catch (err) {
    console.error(`[Reenviar Tasa ❌ Error]:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getSocios(req, res) {
  try {
    const fn = directorioService.obtenerListaSocios || directorioService.obtenerNombresSocios;
    const socios = await fn();
    res.json(socios || []);
  } catch (err) {
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

async function postEnviarMediaWhatsApp(req, res) {
  try {
    const fn = reportesService.enviarMediaWhatsApp || reportesService.enviarReporteMediaWhatsApp;
    const resultado = await fn(req.body);
    res.json({ success: true, message: 'Reporte en imagen enviado con éxito.', ...resultado });
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

async function getHistorialTasas(req, res) {
  try {
    const sql = `
      SELECT id_tasa, tasas, created_at
      FROM tasas_glaukov
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const result = await db.query(sql);
    
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error al obtener historial de tasas:', error);
    res.status(500).json({ error: 'Error interno del servidor al consultar historial' });
  }
}

module.exports = {
  previewData,
  previewImage,
  dispararWhatsApp,
  getComprobantes,
  liquidarComprobante,
  releerIA,
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
  postEnviarMediaWhatsApp,
  getColaAdmin,
  updateColaAdmin,
  deleteColaAdmin,
  getHistorialTasas
};
