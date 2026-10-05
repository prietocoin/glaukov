/**
 * @file socioEstadoService.js
 * @description Manejador atómico para conmutar el switch de WhatsApp (WA) de un socio.
 * Actualiza la persistencia en PostgreSQL mediante AteneaAPI y sincroniza el objeto en memoria.
 */

/**
 * Invierte el estado de activación de WhatsApp del socio y persiste el cambio.
 * @param {Object} socio - Objeto del socio a modificar.
 * @returns {Promise<boolean>} Nuevo estado de activación.
 */
export async function alternarEstadoSocioWA(socio) {
  if (!socio) return false;

  let mostrarObj = typeof socio.mostrar === 'string' ? JSON.parse(socio.mostrar || '{}') : (socio.mostrar || {});
  mostrarObj = (typeof mostrarObj === 'object' && mostrarObj !== null) ? mostrarObj : {};

  const nuevoEstado = !Boolean(mostrarObj.tasas ?? socio.activo ?? true);

  socio.activo = nuevoEstado;
  mostrarObj.tasas = nuevoEstado;
  socio.mostrar = mostrarObj;

  await window.AteneaAPI.patchEstadoSocio(socio.nombre, nuevoEstado);
  return nuevoEstado;
}
