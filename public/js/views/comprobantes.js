// =================================================================
// ARCHIVO: comprobantes.js (Ensamblador Principal)
// UBICACIÓN: public/js/views/comprobantes.js
// =================================================================

import { comprobantesState } from './comprobantes/comprobantesState.js';
import { comprobantesCalculos } from './comprobantes/comprobantesCalculos.js';
import { comprobantesGetters } from './comprobantes/comprobantesGetters.js';
import { comprobantesAcciones } from './comprobantes/comprobantesAcciones.js';
import { comprobantesFormatters } from './comprobantes/comprobantesFormatters.js';

export function comprobantesView() {
  return {
    ...comprobantesState,
    ...comprobantesCalculos,
    ...comprobantesGetters,
    ...comprobantesAcciones,
    ...comprobantesFormatters
  };
}

// Registro explícito en el objeto global
window.comprobantesView = comprobantesView;
