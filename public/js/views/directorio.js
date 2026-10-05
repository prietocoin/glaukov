export function directorioView() {
  return {
    socios: [],
    busqueda: '',
    loading: false,

    async cargar() {
      this.loading = true;
      try {
        const res = await window.AteneaAPI.getDirectorio();
        this.socios = Array.isArray(res) ? res : [];
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
        (s.rol && s.rol.toLowerCase().includes(q)) || // 🟢 Mapeado a la nueva columna 'rol'
        (s.id_grupo && s.id_grupo.toLowerCase().includes(q)) // 🟢 Agregado filtro por número/grupo
      );
    },

    async toggleEstado(socio) {
      try {
        // 🟢 Lee el estado actual desde la nueva estructura JSONB 'mostrar.tasas'
        // Si no existe, asume que está activo por defecto
        const estadoActual = socio.mostrar?.tasas ?? true;
        const nuevoEstado = !estadoActual;

        // Llamada a la API para guardar el cambio en PostgreSQL
        const result = await window.AteneaAPI.patchEstadoSocio(socio.nombre, nuevoEstado);
        
        if (result) {
          // 🟢 Actualiza la vista en tiempo real asegurando la estructura del JSONB
          if (!socio.mostrar) {
            socio.mostrar = { tasas: true, dashboard: true };
          }
          socio.mostrar.tasas = nuevoEstado;
          
          // Actualizamos también socio.activo por si algún botón viejo en el HTML depende de esta variable
          socio.activo = nuevoEstado; 
        }
      } catch (err) {
        console.error('[Glaukov UI ❌]', err.message);
      }
    }
  };
}
