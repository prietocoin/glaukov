import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js';
import { AteneaAPI } from './api.js';

if (!window.Alpine) {
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

    // Modales y Sync
    modalImagenAbierto: false,
    itemSeleccionado: null,
    timerPolling: null,
    ultimaActualizacion: '',

    // Tarjetas de Tasas (Cartelera)
    carteleraTasas: [
      { pais: 'Argentina (ARS)', bandera: '🇦🇷', comprar: 1626, vender: 1563, estadoC: 'up', estadoV: 'up' },
      { pais: 'Venezuela (VES)', bandera: '🇻🇪', comprar: 984, vender: 950, estadoC: 'eq', estadoV: 'eq' },
      { pais: 'Peru (PEN)', bandera: '🇵🇪', comprar: 3.44, vender: 3.31, estadoC: 'eq', estadoV: 'eq' },
      { pais: 'Colombia (COP)', bandera: '🇨🇴', comprar: 3335, vender: 3140, estadoC: 'up', estadoV: 'up' },
      { pais: 'Chile (CLP)', bandera: '🇨🇱', comprar: 1005, vender: 928, estadoC: 'up', estadoV: 'up' },
      { pais: 'Brazil (BRL)', bandera: '🇧🇷', comprar: 5.42, vender: 4.91, estadoC: 'up', estadoV: 'up' },
      { pais: 'Paraguay (PYG)', bandera: '🇵🇾', comprar: 6104, vender: 5749, estadoC: 'up', estadoV: 'up' },
      { pais: 'Ecuador (ECU)', bandera: '🇪🇨', comprar: 1.06, vender: 0.94, estadoC: 'eq', estadoV: 'eq' },
      { pais: 'Mexico (MXN)', bandera: '🇲🇽', comprar: 18.62, vender: 16.51, estadoC: 'up', estadoV: 'up' }
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

        this.comprobantes = await AteneaAPI.getComprobantes(params);
        this.ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
      } catch (err) {
        if (!silencioso) console.error('[Glaukov UI ❌]', err);
      }
    },

    async cargarDirectorio() {
      try {
        this.directorio = await AteneaAPI.getDirectorio();
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    async cargarSocios() {
      try {
        this.socios = await AteneaAPI.getSocios();
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    // Métricas Calculadas KPI
    get sujetoAuditado() {
      return this.filtroSocio || 'TODOS LOS SOCIOS';
    },

    get movimientoFiltradoTotal() {
      return this.comprobantes.reduce((sum, item) => sum + (parseFloat(item.m1_socio) || parseFloat(item.monto) || 0), 0);
    },

    get monedaSocioDominante() {
      return this.comprobantes[0]?.moneda || 'PEN';
    },

    get saldoActualTotal() {
      return (parseFloat(this.saldoAnterior) || 0) + this.movimientoFiltradoTotal;
    },

    get directorioFiltrado() {
      if (!this.busquedaDirectorio) return this.directorio;
      const q = this.busquedaDirectorio.toLowerCase();
      return this.directorio.filter(d => 
        (d.nombre && d.nombre.toLowerCase().includes(q)) ||
        (d.roles && d.roles.toLowerCase().includes(q))
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
    },

    verDetalleImagen(item) {
      this.itemSeleccionado = item;
      this.modalImagenAbierto = true;
    },

    formatearFecha(fechaStr) {
      if (!fechaStr) return '-';
      const d = new Date(fechaStr);
      return isNaN(d.getTime()) ? fechaStr : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    }
  }));

  window.Alpine = Alpine;
  Alpine.start();
}
