// =================================================================
// ARCHIVO: comprobantes.js (Ensamblador Principal)
// RESPONSABILIDAD: Unifica sub-módulos y registra en Window para Alpine
// =================================================================

// 1. IMPORTACIONES CON RUTAS ABSOLUTAS Y CACHE-BUSTER PARA EVITAR EL ERROR MIME 404
import { comprobantesState } from '/js/views/comprobantes/comprobantesState.js?v=2.1';
import { comprobantesCalculos } from '/js/views/comprobantes/comprobantesCalculos.js?v=2.1';
import { comprobantesGetters } from '/js/views/comprobantes/comprobantesGetters.js?v=2.1';
import { comprobantesAcciones } from '/js/views/comprobantes/comprobantesAcciones.js?v=2.1';
import { comprobantesFormatters } from '/js/views/comprobantes/comprobantesFormatters.js?v=2.1';

export function comprobantesView() {
  return {
    // 2. EXPANSIÓN MODULAR (Spread Operator)
    // Alpine unificará esto en un solo componente reactivo transparente
    ...comprobantesState,
    ...comprobantesCalculos,
    ...comprobantesGetters,
    ...comprobantesAcciones,
    ...comprobantesFormatters
  };
}

// 3. REGISTRO GLOBAL AUTOMÁTICO PARA ALPINE.JS
if (typeof window !== 'undefined') {
  window.comprobantesView = comprobantesView;
}
