/**
 * @file tasasMercadoService.js
 * @description Servicio atómico de lectura y consulta de cotizaciones del mercado.
 * Obtiene el lote activo, las tasas vigentes y el historial de cambios guardado en PostgreSQL.
 */

/**
 * Consulta la última tasa oficial de mercado publicada en producción.
 * @returns {Promise<{id_tasa: string, tasas: Object}>}
 */
export async function obtenerTasasVigentes() {
  try {
    const res = await window.AteneaAPI.getUltimasTasas();
    if (!res) return { id_tasa: '', tasas: {} };
    return {
      id_tasa: res.id_tasa || '',
      tasas: res.tasas || {}
    };
  } catch (err) {
    console.error('[tasasMercadoService ❌ Error al cargar tasas mercado]', err);
    return { id_tasa: '', tasas: {} };
  }
}

/**
 * Obtiene el historial completo de lotes de tasas de la base de datos.
 * @returns {Promise<Array>} Lista de lotes históricos.
 */
export async function obtenerHistorialTasas() {
  try {
    if (window.AteneaAPI && typeof window.AteneaAPI.getHistorialTasas === 'function') {
      const res = await window.AteneaAPI.getHistorialTasas();
      return Array.isArray(res) ? res : (res?.rows || res?.data || []);
    }
    return [];
  } catch (err) {
    console.warn('[tasasMercadoService ⚠️ Error al cargar historial de tasas]', err);
    return [];
  }
}
