import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js';
import { AteneaAPI } from './api.js';

if (!window.Alpine) {
  Alpine.data('app', () => ({
    vistaActiva: 'comprobantes',
    comprobantes: [],
    directorio: [],
    socios: [],

    filtroSocio: '',
    filtroReporteRol: '',
    filtroFecha: '',
    filtroFechaFin: '',
    filtroHash: '',
    busquedaDirectorio: '',

    modalImagenAbierto: false,
    itemSeleccionado: null,

    async init() {
      await this.cargarSocios();
      await this.cargarComprobantes();
      await this.cargarDirectorio();
    },

    async cargarComprobantes() {
      try {
        const params = {};
        if (this.filtroSocio) params.socio = this.filtroSocio;
        if (this.filtroReporteRol) params.rol = this.filtroReporteRol;
        if (this.filtroFecha) params.fechaInicio = this.filtroFecha;
        if (this.filtroFechaFin) params.fechaFin = this.filtroFechaFin;
        if (this.filtroHash) params.hash = this.filtroHash;

        this.comprobantes = await AteneaAPI.getComprobantes(params);
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
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

    get directorioFiltrado() {
      if (!this.busquedaDirectorio.trim()) return this.directorio;
      const q = this.busquedaDirectorio.toLowerCase();
      return this.directorio.filter(d => 
        (d.nombre && d.nombre.toLowerCase().includes(q)) ||
        (d.roles && d.roles.toLowerCase().includes(q)) ||
        (d.whatsapp && d.whatsapp.toLowerCase().includes(q))
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
