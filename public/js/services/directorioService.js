/**
 * @file directorioService.js
 * @description Servicio de consulta y normalización del directorio de socios.
 * Mapea la estructura JSONB 'mostrar' proveniente de PostgreSQL hacia la propiedad
 * 'socio.activo' de Alpine.js para garantizar que la UI refleje el switch de WhatsApp real.
 */
export async function obtenerDirectorioNormalizado() {
  try {
    const res = await window.AteneaAPI.getDirectorio();
    const rawList = Array.isArray(res) ? res : [];

    return rawList.map(s => {
      let mostrarObj = s.mostrar;
      if (typeof mostrarObj === 'string') {
        try { mostrarObj = JSON.parse(mostrarObj); } catch (e) { mostrarObj = {}; }
      }
      mostrarObj = (typeof mostrarObj === 'object' && mostrarObj !== null) ? mostrarObj : {};

      const estaActivo = mostrarObj.tasas ?? s.activo ?? true;

      return {
        ...s,
        mostrar: mostrarObj,
        activo: Boolean(estaActivo),
        mostrar_dashboard: Boolean(mostrarObj.dashboard ?? s.mostrar_dashboard ?? true)
      };
    });
  } catch (err) {
    console.error('[directorioService ❌ Error al cargar directorio]', err);
    return [];
  }
}
