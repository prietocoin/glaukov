/**
 * @file comprobantesFilterService.js
 * @path public/js/modules/comprobantes/services/comprobantesFilterService.js
 * @description Servicio atómico de filtrado estricto por socio sin alterar el estado.
 */

export function limpiarFiltro(val) {
  if (!val) return '';
  const str = String(val).trim().toUpperCase();
  return (str === 'TODOS' || str === 'TODOS LOS SOCIOS' || str === 'GENERAL') ? '' : val;
}

/**
 * Auxiliar atómico para extraer el nombre real del socio descartando
 * valores nulos, genéricos o titularidades bancarias.
 */
function extraerNombreSocioLimpio(valor) {
  if (!valor || typeof valor !== 'string') return '';
  const limpio = valor.trim().toUpperCase();
  if (!limpio || limpio === 'GENERAL' || limpio === 'NO DEFINIDO' || limpio === 'N/A' || limpio === '-') {
    return '';
  }
  return limpio;
}

/**
 * Filtra comprobantes comparando de forma estricta contra Socio 1 o Socio 2,
 * imitando la cláusula SQL original de PostgreSQL por coincidencia exacta.
 */
export function filtrarComprobantesPorSocio(listaBase = [], directorio = [], filtroSocio = '') {
  if (!Array.isArray(listaBase) || listaBase.length === 0) return [];

  const socioBuscado = limpiarFiltro(filtroSocio).toUpperCase();

  // Si no hay filtro o es global, devuelve toda la lista
  if (!socioBuscado) {
    return listaBase;
  }

  // 1. Mapear socios válidos (incluyendo herencias de la tabla nombres_fb si existen)
  const sociosValidos = new Set([socioBuscado]);
  if (Array.isArray(directorio) && directorio.length > 0) {
    directorio.forEach(d => {
      const padre = String(d.padre || d.herencia || '').trim().toUpperCase();
      const nombre = String(d.nombre || '').trim().toUpperCase();
      if (padre === socioBuscado || nombre === socioBuscado) {
        if (d.nombre) sociosValidos.add(String(d.nombre).trim().toUpperCase());
      }
    });
  }

  // 2. Compara EXCLUSIVAMENTE sobre las propiedades reales de Socio 1 y Socio 2
  return listaBase.filter(item => {
    if (!item) return false;

    // Extracción limpia y sanitizada de Socio 1 y Socio 2 (Descarta Titular)
    const s1 = extraerNombreSocioLimpio(item.nombre_socio_1) || 
               extraerNombreSocioLimpio(item.socio_1) || 
               extraerNombreSocioLimpio(item.fb_socio_1);

    const s2 = extraerNombreSocioLimpio(item.nombre_socio_2) || 
               extraerNombreSocioLimpio(item.socio_2) || 
               extraerNombreSocioLimpio(item.fb_socio_2);

    // Solo aprueba si Socio 1 o Socio 2 coinciden exactamente con la lista de socios válidos
    return sociosValidos.has(s1) || sociosValidos.has(s2);
  });
}
