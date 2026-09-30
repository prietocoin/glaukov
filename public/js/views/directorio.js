export function directorioView() {
  return {
    socios: [],
    busqueda: '',
    loading: false,

    async cargar() {
      this.loading = true;
      try {
        this.socios = await window.AteneaAPI.getDirectorio();
      } catch (err) {
        console.error('[Glaukov UI ❌]', err.message);
      } finally {
        this.loading = false;
      }
    },

    get filtrados() {
      if (!this.busqueda.trim()) return this.socios;
      const q = this.busqueda.toLowerCase();
      return this.socios.filter(s => 
        (s.nombre && s.nombre.toLowerCase().includes(q)) ||
        (s.roles && s.roles.toLowerCase().includes(q))
      );
    },

    async toggleEstado(socio) {
      try {
        const result = await window.AteneaAPI.patchEstadoSocio(socio.nombre, !socio.activo);
        if (result && result.success) socio.activo = !socio.activo;
      } catch (err) {
        console.error('[Glaukov UI ❌]', err.message);
      }
    }
  };
}
