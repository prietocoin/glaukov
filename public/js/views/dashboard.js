// =================================================================
// ARCHIVO: dashboard.js
// UBICACIÓN: public/js/views/dashboard.js
// RESPONSABILIDAD: Módulo para la vista de Dashboard y Pendientes
// =================================================================

export function dashboardView() {
  return {
    sociosPendientes: [],
    get sociosPendientesConsolidado() {
      return this.sociosPendientes || [];
    }
  };
}

if (typeof window !== 'undefined') {
  window.dashboardView = dashboardView;
}
