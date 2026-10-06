/**
 * @file appBootstrap.js
 * @description Secuencia de arranque determinista para Atenea V2.0.
 */

import { LISTA_MONEDAS_ACTIVAS, obtenerInfoMonedasMaestra } from './constants/listaMonedasActivas.js';
import { calcularTasaEnVivo, obtenerClaseTalla } from './utils/calculoTasaEnVivo.js';
import { cargarComponentes } from './utils/componentLoader.js';
import { obtenerDirectorioNormalizado } from './services/directorioService.js';
import { alternarEstadoSocioWA } from './services/socioEstadoService.js';
import { alternarHerenciaSocio } from './services/socioHerenciaService.js';
import { obtenerTasasVigentes } from './services/tasasMercadoService.js';
import { despacharTasaIndividual } from './services/despachoTasaIndividualService.js';
import { capturarBorradorHoo } from './services/hooApiService.js';
import { publicarBorradorTasa, reenviarLoteCompleto } from './services/publicacionTasasService.js';
import { prepararEdicionSocio, guardarConfiguracionSocio } from './services/socioConfigModalService.js';
import { obtenerComprobantes, prepararEdicionComprobante, guardarCambiosComprobante, eliminarComprobantePorHash } from './services/comprobantesService.js';
import { solicitarRelecturaIA } from './services/comprobantesIaService.js';
import { calcularMovimientoFiltradoTotal, calcularSociosPendientesConsolidado } from './services/consolidadoSaldosService.js';

function cargarAlpineCDN() {
  return new Promise((resolve, reject) => {
    if (window.Alpine) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.5/dist/cdn.min.js';
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

async function arrancar() {
  console.log('[Atenea 1/3 🧩] Descargando componentes HTML...');
  await cargarComponentes();

  console.log('[Atenea 2/3 ⚡] Cargando motor Alpine.js...');
  await cargarAlpineCDN();

  console.log('[Atenea 3/3 🟢] Registrando estado y arrancando Alpine...');
  window.Alpine.data('app', () => ({
    vistaActiva: 'dashboard',
    vistaDashboardSubmenu: 'balance',
    loteSeleccionadoInspector: '',
    comprobantes: [],
    directorio: [],
    socios: [],
    filtroSocio: '',
    filtroFechaInicio: '',
    filtroFechaFin: '',
    listaMonedasActivas: LISTA_MONEDAS_ACTIVAS,
    modoPruebaActivo: false,
    loteActivo: '',
    tasasProduccion: {},
    borradorCapturado: {},
    historialTasas: [],
    socioConfigEdit: null,
    modalConfigSocioAbierto: false,
    modalAbierto: false,
    itemEdicion: null,

    get infoMonedasMaestra() { return obtenerInfoMonedasMaestra(); },

    async init() {
      await Promise.all([
        this.cargarTasasMercado(),
        this.cargarDirectorio(),
        this.cargarComprobantes()
      ]);
    },

    async cargarDirectorio() { this.directorio = await obtenerDirectorioNormalizado() || []; },
    async toggleEstadoSocio(socio) { await alternarEstadoSocioWA(socio); await this.cargarDirectorio(); },
    async toggleHerenciaSocio(socio) { await alternarHerenciaSocio(socio); await this.cargarDirectorio(); },
    async cargarTasasMercado() { const t = await obtenerTasasVigentes(); this.loteActivo = t?.id_tasa || ''; this.tasasProduccion = t?.tasas || {}; },
    async conectarHooAPI() { const b = await capturarBorradorHoo(); if (b) this.borradorCapturado = b; },
    async publicarTasaOficial() { const id = await publicarBorradorTasa(this.borradorCapturado, this.modoPruebaActivo); if (id) this.loteActivo = id; },
    async reenviarTasaActual() { await reenviarLoteCompleto(this.loteActivo, this.modoPruebaActivo); },
    async enviarTasaIndividual(socio, fPrueba = null) { await despacharTasaIndividual(this.loteActivo, socio, fPrueba, this.modoPruebaActivo); },
    calcularTasaEnVivo(code, pct, esResta) { return calcularTasaEnVivo(this.tasasProduccion[code], pct, esResta); },
    abrirConfigSocio(socio) { this.socioConfigEdit = prepararEdicionSocio(socio, this.infoMonedasMaestra); this.modalConfigSocioAbierto = true; },
    async guardarConfigSocioModal() { await guardarConfiguracionSocio(this.socioConfigEdit); this.modalConfigSocioAbierto = false; await this.cargarDirectorio(); },
    getTallaClass(socio) { return obtenerClaseTalla(socio); },
    async cargarComprobantes() { this.comprobantes = await obtenerComprobantes({ socio: this.filtroSocio }) || []; },
    abrirModal(item) { this.itemEdicion = prepararEdicionComprobante(item, this.loteActivo); this.modalAbierto = true; },
    async guardarCambios() { if (await guardarCambiosComprobante(this.itemEdicion?.hash_largo, this.itemEdicion, this.loteActivo)) { this.modalAbierto = false; await this.cargarComprobantes(); } },
    async releerIAModal() { if (await solicitarRelecturaIA(this.itemEdicion?.hash_largo)) { this.modalAbierto = false; await this.cargarComprobantes(); } },
    async eliminarComprobante(hash) { if (await eliminarComprobantePorHash(hash)) { this.modalAbierto = false; await this.cargarComprobantes(); } },
    get movimientoFiltradoTotal() { return calcularMovimientoFiltradoTotal(this.comprobantes, this.filtroSocio); },
    get sociosPendientesConsolidado() { return calcularSociosPendientesConsolidado(this.directorio, this.comprobantes, { fechaInicio: this.filtroFechaInicio, fechaFin: this.filtroFechaFin }); }
  }));

  window.Alpine.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar);
} else {
  arrancar();
}
