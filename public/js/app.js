import { AteneaAPI } from './api.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    vistaActiva: 'comprobantes',
    comprobantes: [],
    directorio: [],
    socios: [],

    // Métricas KPI
    saldoAnterior: 0,

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

    // Modales y Visor
    modalAbierto: false,
    itemEdicion: null,
    modalConfigSocioAbierto: false,
    socioConfigEdit: null,
    modalImagenAbierto: false,
    itemSeleccionado: null,

    // Sync
    timerPolling: null,
    ultimaActualizacion: '',

    // Cartelera Tasas
    carteleraTasas: [
      { pais: 'Argentina (ARS)', bandera: '🇦🇷', comprar: 1626, vender: 1563 },
      { pais: 'Venezuela (VES)', bandera: '🇻🇪', comprar: 984, vender: 950 },
      { pais: 'Peru (PEN)', bandera: '🇵🇪', comprar: 3.44, vender: 3.31 },
      { pais: 'Colombia (COP)', bandera: '🇨🇴', comprar: 3335, vender: 3140 },
      { pais: 'Chile (CLP)', bandera: '🇨🇱', comprar: 1005, vender: 928 },
      { pais: 'Brazil (BRL)', bandera: '🇧🇷', comprar: 5.42, vender: 4.91 },
      { pais: 'Paraguay (PYG)', bandera: '🇵🇾', comprar: 6104, vender: 5749 },
      { pais: 'Ecuador (ECU)', bandera: '🇪🇨', comprar: 1.06, vender: 0.94 },
      { pais: 'Mexico (MXN)', bandera: '🇲🇽', comprar: 18.62, vender: 16.51 }
    ],

    async init() {
      await this.cargarSocios();
      await this.cargarComprobantes();
      await this.cargarDirectorio();
      this.iniciarAutoSync();
    },

    iniciarAutoSync() {
      if (this.timerPolling) clearInterval(this.timerPolling);
      this.timerPolling = setInterval(() => {
        if (this.vistaActiva === 'comprobantes') {
          this.cargarComprobantes(true);
        }
      }, 5000);
    },

    async cargarComprobantes(silencioso = false) {
      try {
        const params = {};
        if (this.filtroSocio) params.socio = this.filtroSocio;
        if (this.filtroRol) params.rol = this.filtroRol;
        if (this.filtroFechaInicio) params.fechaInicio = this.filtroFechaInicio;
        if (this.filtroFechaFin) params.fechaFin = this.filtroFechaFin;
        if (this.filtroHashBusqueda) params.hash = this.filtroHashBusqueda;
        if (this.ordenarPor) params.orden = this.ordenarPor;

        const res = await AteneaAPI.getComprobantes(params);
        this.comprobantes = Array.isArray(res) ? res : [];
        this.ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
      } catch (err) {
        if (!silencioso) console.error('[Glaukov UI ❌]', err);
        this.comprobantes = [];
      }
    },

    async cargarDirectorio() {
      try {
        const res = await AteneaAPI.getDirectorio();
        this.directorio = Array.isArray(res) ? res : [];
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    async cargarSocios() {
      try {
        const res = await AteneaAPI.getSocios();
        this.socios = Array.isArray(res) ? res : [];
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    abrirModal(item) {
      if (!item) return;
      let dateInput = '';
      if (item.fecha_hora_comprobante) {
        const d = new Date(item.fecha_hora_comprobante);
        if (!isNaN(d.getTime())) {
          const tzOffset = d.getTimezoneOffset() * 60000;
          dateInput = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
        }
      }

      this.itemEdicion = { 
        ...item,
        tipo_manual: item.tipo_op_socio || item.tipo_op || 'D',
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

        await AteneaAPI.actualizarComprobante(this.itemEdicion.hash_largo, this.itemEdicion);
        this.modalAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        console.error('Error en guardarCambios:', err);
        alert('Error guardando cambios: ' + err.message);
      }
    },

    async eliminarComprobante(hashLargo) {
      if (!hashLargo || !confirm('¿Deseas eliminar este comprobante?')) return;
      try {
        await AteneaAPI.eliminarComprobante(hashLargo);
        this.modalAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        console.error('Error eliminando comprobante:', err);
        alert('Error eliminando: ' + err.message);
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
      const d = new Date(fechaStr);
      return isNaN(d.getTime()) ? fechaStr : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    },

    get sujetoAuditado() {
      return this.filtroSocio ? this.filtroSocio.toUpperCase() : 'TODOS LOS SOCIOS';
    },

    get movimientoFiltradoTotal() {
      if (!Array.isArray(this.comprobantes)) return 0;
      return this.comprobantes.reduce((sum, item) => sum + (parseFloat(item.m1_socio) || parseFloat(item.monto) || 0), 0);
    },

    get monedaSocioDominante() {
      return (this.comprobantes && this.comprobantes[0]?.moneda) || 'USDT';
    },

    get saldoActualTotal() {
      return (parseFloat(this.saldoAnterior) || 0) + this.movimientoFiltradoTotal;
    },

    get directorioFiltrado() {
      if (!Array.isArray(this.directorio)) return [];
      if (!this.busquedaDirectorio) return this.directorio;
      const q = this.busquedaDirectorio.toLowerCase();
      return this.directorio.filter(d => 
        (d && d.nombre && d.nombre.toLowerCase().includes(q)) ||
        (d && d.roles && d.roles.toLowerCase().includes(q))
      );
    },

    async toggleEstadoSocio(socio) {
      try {
        const nuevoEstado = !socio.activo;
        await AteneaAPI.patchEstadoSocio(socio.nombre, nuevoEstado);
        socio.activo = nuevoEstado;
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    }
  }));
});
