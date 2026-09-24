import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js';
import { AteneaAPI } from './api.js';

if (!window.Alpine) {
  Alpine.data('app', () => ({
    vistaActiva: 'comprobantes',
    comprobantes: [],
    directorio: [],
    socios: [],

    // Filtros
    filtroSocio: '',
    filtroReporteRol: '',
    filtroFecha: '',
    filtroFechaFin: '',
    filtroHash: '',
    busquedaDirectorio: '',

    // Modales
    modalImagenAbierto: false,
    itemSeleccionado: null,
    timerPolling: null,

    async init() {
      await this.cargarSocios();
      await this.cargarComprobantes();
      await this.cargarDirectorio();

      // Inicia la sincronización automática en segundo plano
      this.iniciarAutoSync();
    },

    iniciarAutoSync() {
      if (this.timerPolling) clearInterval(this.timerPolling);
      
      // Consulta en vivo cada 5 segundos
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
        if (this.filtroReporteRol) params.rol = this.filtroReporteRol;
        if (this.filtroFecha) params.fechaInicio = this.filtroFecha;
        if (this.filtroFechaFin) params.fechaFin = this.filtroFechaFin;
        if (this.filtroHash) params.hash = this.filtroHash;

        const nuevosDatos = await AteneaAPI.getComprobantes(params);
        
        // Reemplazo transparente en memoria (Alpine actualiza solo las filas cambiadas)
        this.comprobantes = nuevosDatos;
      } catch (err) {
        if (!silencioso) {
          console.error('[Glaukov UI ❌] Error al cargar comprobantes:', err);
        }
      }
    },

    async cargarDirectorio() {
      try {
        this.directorio = await AteneaAPI.getDirectorio();
      } catch (err) {
        console.error('[Glaukov UI ❌] Error al cargar directorio:', err);
      }
    },

    async cargarSocios() {
      try {
        this.socios = await AteneaAPI.getSocios();
      } catch (err) {
        console.error('[Glaukov UI ❌] Error al cargar lista de socios:', err);
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
        console.error('[Glaukov UI ❌] Error al cambiar estado:', err);
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
