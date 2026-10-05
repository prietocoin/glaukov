/**
 * @file directorioAccionesService.js
 * @description Acciones masivas e individuales administrativas para la lista de directorio.
 * Permite apagar todos los socios, guardar/restaurar vigentes y eliminar socios.
 */

/**
 * Desactiva el envío de tasas de todos los socios del directorio.
 */
export async function apagarTodosLosSocios() {
  if (!confirm('¿Deseas apagar/desactivar todas las carteleras de los socios?')) return false;
  try {
    await window.AteneaAPI.desactivarTodosSocios();
    return true;
  } catch (err) {
    console.error('[directorioAcciones ❌]', err);
    return false;
  }
}

/**
 * Guarda en plantilla la lista de socios activos actualmente.
 */
export async function memorizarSociosVigentes() {
  try {
    await window.AteneaAPI.guardarVigentes();
    alert('Plantilla de socios vigentes memorizada.');
  } catch (err) {
    console.error('[directorioAcciones ❌]', err);
  }
}

/**
 * Restaura el estado de visibilidad de socios desde la plantilla memorizada.
 */
export async function restaurarSociosVigentes() {
  try {
    await window.AteneaAPI.restaurarVigentes();
    alert('Socios vigentes restaurados.');
    return true;
  } catch (err) {
    console.error('[directorioAcciones ❌]', err);
    return false;
  }
}

/**
 * Elimina un socio del directorio de forma permanente.
 * @param {string} nombreSocio - Nombre del socio.
 */
export async function eliminarSocioDelDirectorio(nombreSocio) {
  if (!nombreSocio || !confirm(`¿Eliminar permanentemente a ${nombreSocio}?`)) return false;
  try {
    await window.AteneaAPI.eliminarSocioDirectorio(nombreSocio);
    return true;
  } catch (err) {
    console.error('[directorioAcciones ❌]', err);
    return false;
  }
}
