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
