/**
 * @file socioConfigModalService.js
 * @description Servicio para transformar y guardar la configuración integral de un socio.
 * Mapea estructuras JSONB entre el formulario de la UI y el modelo de PostgreSQL.
 */

/**
 * Construye el objeto borrador de edición para el modal de configuración de socio.
 * @param {Object} socioObj - Objeto con datos crudos del socio.
 * @param {Object} infoMonedasMaestra - Diccionario maestro de banderas/nombres de monedas.
 * @returns {Object} Objeto preparado para vincular en el formulario.
 */
export function prepararEdicionSocio(socioObj, infoMonedasMaestra = {}) {
  let monedasConfig = typeof socioObj.monedas === 'string'
    ? JSON.parse(socioObj.monedas || '{}')
    : (socioObj.monedas || {});
  let mostrarConfig = typeof socioObj.mostrar === 'string'
    ? JSON.parse(socioObj.mostrar || '{}')
    : (socioObj.mostrar || {});

  const paisesArray = Object.keys(monedasConfig).map(code => {
    const info = infoMonedasMaestra[code] || { nombre: code, bandera: '🌐' };
    const cfg = monedasConfig[code] || {};
    return {
      code,
      nombre: info.nombre,
      bandera: info.bandera,
      activo: cfg.activo ?? true,
      pctD: cfg.porcentaje?.deposito || 0,
      pctP: cfg.porcentaje?.pago || 0,
      polaridadSuma: cfg.polaridad === '+' || cfg.polaridad === undefined,
      naturaleza: cfg.tipo || 'D'
    };
  });

  return {
    nombre: socioObj.nombre || '',
    roles: socioObj.rol || socioObj.roles || 'SOCIO',
    moneda_socio: String(socioObj.moneda_base || socioObj.moneda_socio || 'USDT').toUpperCase().trim(),
    whatsapp: socioObj.id_grupo || socioObj.whatsapp || '',
    saldo_anterior: parseFloat(socioObj.saldo_inicial ?? socioObj.saldo_anterior ?? 0) || 0,
    activo: mostrarConfig.tasas ?? socioObj.activo ?? true,
    mostrar_dashboard: mostrarConfig.dashboard ?? socioObj.mostrar_dashboard ?? true,
    herencia: Boolean(socioObj.herencia),
    paises: paisesArray
  };
}

/**
 * Persiste la configuración del socio editada desde el modal hacia el backend.
 * @param {Object} socioConfigEdit - Estado del socio en edición.
 */
export async function guardarConfiguracionSocio(socioConfigEdit) {
  if (!socioConfigEdit || !socioConfigEdit.nombre.trim()) {
    throw new Error('Por favor especifica el nombre del socio.');
  }

  const monedasFinales = {};
  (socioConfigEdit.paises || []).forEach(p => {
    const code = p.code.toUpperCase();
    monedasFinales[code] = {
      activo: Boolean(p.activo),
      tipo: p.naturaleza || 'D',
      polaridad: p.polaridadSuma ? '+' : '-',
      porcentaje: {
        deposito: Math.abs(parseFloat(p.pctD) || 0),
        pago: Math.abs(parseFloat(p.pctP) || 0)
      }
    };
  });

  const payload = {
    nombre: socioConfigEdit.nombre,
    rol: socioConfigEdit.roles,
    moneda_base: String(socioConfigEdit.moneda_socio || 'USDT').toUpperCase().trim(),
    id_grupo: socioConfigEdit.whatsapp,
    saldo_inicial: parseFloat(socioConfigEdit.saldo_anterior) || 0,
    herencia: Boolean(socioConfigEdit.herencia),
    mostrar: {
      tasas: Boolean(socioConfigEdit.activo),
      dashboard: Boolean(socioConfigEdit.mostrar_dashboard)
    },
    monedas: monedasFinales
  };

  await window.AteneaAPI.guardarSocioConfig(payload);
}
