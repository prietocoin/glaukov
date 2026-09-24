import { AteneaAPI } from '../api.js';

export function comprobantesView() {
  return {
    items: [],
    filtros: { socio: '', rol: '', fechaInicio: '', fechaFin: '', hash: '' },
    loading: false,

    async cargar() {
      this.loading = true;
      try {
        this.items = await AteneaAPI.getComprobantes(this.filtros);
      } catch (err) {
        console.error('[Glaukov UI ❌]', err.message);
      } finally {
        this.loading = false;
      }
    },

    formatearFecha(fechaStr) {
      if (!fechaStr) return '-';
      const d = new Date(fechaStr);
      return isNaN(d.getTime()) ? fechaStr : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    }
  };
}
