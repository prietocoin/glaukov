// =================================================================
// ARCHIVO: comprobantes.js (Ensamblador Principal)
// RESPONSABILIDAD: Unifica sub-módulos y registra en Window para Alpine
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

// Registro global automático para Alpine.js
if (typeof window !== 'undefined') {
  window.comprobantesView = comprobantesView;
}
