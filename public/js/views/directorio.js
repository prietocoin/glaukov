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
        ((s.rol || s.roles) && (s.rol || s.roles).toLowerCase().includes(q)) ||
        ((s.id_grupo || s.whatsapp) && (s.id_grupo || s.whatsapp).toLowerCase().includes(q))
      );
    },

    async toggleEstado(socio) {
      try {
        const estadoActual = socio.mostrar?.tasas ?? true;
        const nuevoEstado = !estadoActual;

        const result = await window.AteneaAPI.patchEstadoSocio(socio.nombre, nuevoEstado);
        
        if (result) {
          if (!socio.mostrar) {
            socio.mostrar = { tasas: true, dashboard: true };
          }
          socio.mostrar.tasas = nuevoEstado;
          socio.activo = nuevoEstado; 
        }
      } catch (err) {
        console.error('[Glaukov UI ❌]', err.message);
      }
    },

    // 🟢 MÉTODO PARA CAMBIAR EL ESTADO DE HERENCIA (ON/OFF)
    async toggleHerencia(socio) {
      try {
        const nuevaHerencia = !Boolean(socio.herencia);

        let monedasObj = socio.monedas;
        if (typeof monedasObj === 'string') {
          try { monedasObj = JSON.parse(monedasObj); } catch (e) { monedasObj = {}; }
        }

        let mostrarObj = socio.mostrar;
        if (typeof mostrarObj === 'string') {
          try { mostrarObj = JSON.parse(mostrarObj); } catch (e) { mostrarObj = {}; }
        }

        const payload = {
          nombre: socio.nombre,
          rol: socio.rol || socio.roles || 'SOCIO',
          moneda_base: String(socio.moneda_base || socio.moneda_socio || 'USDT').toUpperCase().trim(),
          id_grupo: socio.id_grupo || socio.whatsapp || '',
          saldo_inicial: parseFloat(socio.saldo_inicial ?? socio.saldo_anterior ?? 0) || 0,
          mostrar: mostrarObj || { tasas: true, dashboard: true },
          monedas: monedasObj || {},
          herencia: nuevaHerencia
        };

        const result = await window.AteneaAPI.guardarSocioConfig(payload);
        if (result) {
          socio.herencia = nuevaHerencia;
        }
      } catch (err) {
        console.error('[Glaukov UI ❌ Error al cambiar herencia]', err.message);
      }
    }
  };
}
