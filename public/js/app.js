function registrarAppAlpine() {
  Alpine.data('app', () => ({
    vistaActiva: 'comprobantes',
    comprobantes: [],
    socios: [],
    directorio: [],
    carteleraTasas: [],
    
    // Filtros
    filtroRol: '',
    filtroSocio: '',
    filtroFechaInicio: '',
    filtroFechaFin: '',
    filtroDesdeHash: '',
    filtroHastaHash: '',
    ordenarPor: 'fecha_desc',
    filtroHashBusqueda: '',
    busquedaDirectorio: '',
    saldoAnterior: 0,
    
    // Modales de UI
    modalAbierto: false,
    itemEdicion: null,
    modalConfigSocioAbierto: false,
    socioConfigEdit: null,
    modalImagenAbierto: false,
    itemSeleccionado: null,

    async init() {
      await this.cargarSocios();
      await this.cargarDirectorio();
      await this.cargarComprobantes();
    },

    async cargarComprobantes() {
      try {
        const query = new URLSearchParams();
        if (this.filtroRol) query.append('rol', this.filtroRol);
        if (this.filtroSocio) query.append('socio', this.filtroSocio);
        if (this.filtroFechaInicio) query.append('fechaInicio', this.filtroFechaInicio);
        if (this.filtroFechaFin) query.append('fechaFin', this.filtroFechaFin);
        if (this.filtroDesdeHash) query.append('desdeHash', this.filtroDesdeHash);
        if (this.filtroHastaHash) query.append('hastaHash', this.filtroHastaHash);
        if (this.filtroHashBusqueda) query.append('hash', this.filtroHashBusqueda);

        const res = await fetch(`/api/comprobantes?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          this.comprobantes = Array.isArray(data) ? data : [];
        } else {
          this.comprobantes = [];
        }
      } catch (err) {
        console.error('Error cargando comprobantes:', err);
        this.comprobantes = [];
      }
    },

    async cargarSocios() {
      try {
        const res = await fetch('/api/socios');
        if (res.ok) {
          const data = await res.json();
          this.socios = Array.isArray(data) ? data.map(s => typeof s === 'string' ? s : s.nombre) : [];
        }
      } catch (err) {
        console.error('Error cargando socios:', err);
      }
    },

    async cargarDirectorio() {
      try {
        const res = await fetch('/api/directorio');
        if (res.ok) {
          const data = await res.json();
          this.directorio = Array.isArray(data) ? data : [];
        }
      } catch (err) {
        console.error('Error cargando directorio:', err);
      }
    },

    // MANEJADORES DE MODALES
    abrirModal(item) {
      if (!item) return;
      let dateInput = '';
      if (item.timestamp) {
        const d = new Date(item.timestamp * 1000);
        const tzOffset = d.getTimezoneOffset() * 60000;
        dateInput = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      }

      this.itemEdicion = { 
        ...item,
        tipo_manual: item.tipo_op || 'D',
        lote_tasa_asignado: item.lote_tasa_asignado || 'T041',
        fecha_hora_input: dateInput
      };
      this.modalAbierto = true;
    },

    async guardarCambios() {
      if (!this.itemEdicion || !this.itemEdicion.hash_largo) return;
      try {
        if (this.itemEdicion.fecha_hora_input) {
          const ts = Math.floor(new Date(this.itemEdicion.fecha_hora_input).getTime() / 1000);
          if (!isNaN(ts) && ts > 0) {
            this.itemEdicion.timestamp = ts;
          }
        }

        const res = await fetch(`/api/comprobantes/${encodeURIComponent(this.itemEdicion.hash_largo)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.itemEdicion)
        });

        if (res.ok) {
          this.modalAbierto = false;
          await this.cargarComprobantes();
        } else {
          alert('Error al guardar cambios.');
        }
      } catch (err) {
        console.error('Error en guardarCambios:', err);
      }
    },

    async eliminarComprobante(hashLargo) {
      if (!hashLargo || !confirm('¿Deseas eliminar este comprobante?')) return;
      try {
        const res = await fetch(`/api/comprobantes/${encodeURIComponent(hashLargo)}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          this.modalAbierto = false;
          await this.cargarComprobantes();
        }
      } catch (err) {
        console.error('Error eliminando comprobante:', err);
      }
    },

    verDetalleImagen(item) {
      this.itemSeleccionado = item;
      this.modalImagenAbierto = true;
    },

    formatMonto(val) {
      if (val === null || val === undefined || isNaN(val) || val === '') return '0.00';
      const num = parseFloat(val);
      if (num === 0) return '0.00';
      const signoStr = num < 0 ? '-' : '';
      const v = Math.abs(num);
      const vTrunc = Math.trunc((v + 0.0000001) * 100) / 100;
      const parts = vTrunc.toFixed(2).split('.');
      return `${signoStr}${Number(parts[0]).toLocaleString('en-US')}.${parts[1]}`;
    },

    formatearFecha(fechaStr) {
      if (!fechaStr) return '-';
      const date = new Date(fechaStr);
      return isNaN(date.getTime()) ? '-' : date.toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    },

    get sujetoAuditado() {
      return this.filtroSocio ? this.filtroSocio.toUpperCase() : 'TODOS LOS SOCIOS';
    },

    get monedaSocioDominante() {
      return 'USDT';
    },

    get movimientoFiltradoTotal() {
      if (!Array.isArray(this.comprobantes)) return 0;
      return this.comprobantes.reduce((acc, c) => acc + (parseFloat(c.m1_socio) || 0), 0);
    },

    get saldoActualTotal() {
      return (parseFloat(this.saldoAnterior) || 0) + this.movimientoFiltradoTotal;
    },

    get directorioFiltrado() {
      if (!Array.isArray(this.directorio)) return [];
      if (!this.busquedaDirectorio) return this.directorio;
      const q = this.busquedaDirectorio.toLowerCase();
      return this.directorio.filter(d => d && d.nombre && d.nombre.toLowerCase().includes(q));
    }
  }));
}

// Verificación anti race-condition para Alpine v3
if (window.Alpine) {
  registrarAppAlpine();
} else {
  document.addEventListener('alpine:init', registrarAppAlpine);
}
