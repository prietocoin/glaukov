/**
 * @file appBootstrap.js
 * @description Punto de entrada atómico de Alpine.js.
 * Conecta los micro-servicios independientes con el estado reactivo del frontend.
 */

import { LISTA_MONEDAS_ACTIVAS, obtenerInfoMonedasMaestra } from './constants/listaMonedasActivas.js';
import { truncarTasaComercial } from './utils/truncarTasaComercial.js';
import { calcularTasaEnVivo, obtenerClaseTalla } from './utils/calculoTasaEnVivo.js';
import { obtenerDirectorioNormalizado } from './services/directorioService.js';
import { alternarEstadoSocioWA } from './services/socioEstadoService.js';
import { alternarHerenciaSocio } from './services/socioHerenciaService.js';
import { obtenerTasasVigentes, obtenerHistorialTasas } from './services/tasasMercadoService.js';
import { despacharTasaIndividual } from './services/despachoTasaIndividualService.js';
import { capturarBorradorHoo } from './services/hooApiService.js';
import { publicarBorradorTasa, reenviarLoteCompleto } from './services/publicacionTasasService.js';
import { prepararEdicionSocio, guardarConfiguracionSocio } from './services/socioConfigModalService.js';
import { apagarTodosLosSocios, memorizarSociosVigentes, restaurarSociosVigentes, eliminarSocioDelDirectorio } from './services/directorioAccionesService.js';
import { obtenerComprobantes, prepararEdicionComprobante, guardarCambiosComprobante, eliminarComprobantePorHash } from './services/comprobantesService.js';
import { solicitarRelecturaIA } from './services/comprobantesIaService.js';
import { calcularMovimientoFiltradoTotal, calcularSociosPendientesConsolidado } from './services/consolidadoSaldosService.js';

export function registrarAppAlpine() {
  Alpine.data('app', () => ({
    vistaActiva: 'dashboard',
    vistaDashboardSubmenu: 'balance',
    loteSeleccionadoInspector: '',
    comprobantes: [],
    directorio: [],
    socios: [],
    listaMonedasActivas: LISTA_MONEDAS_ACTIVAS,

    get infoMonedasMaestra() { return obtenerInfoMonedasMaestra(); },

    modoPruebaActivo: false,
    loteActivo: '',
    tasasProduccion: {},
    borradorCapturado: {},
    historialTasas: [],
    socioConfigEdit: null,
    modalConfigSocioAbierto: false,
    modalAbierto: false,
    itemEdicion: null,

    async init() {
      await this.cargarTasasMercado();
      await this.cargarDirectorio();
      await this.cargarComprobantes();
    },

    async cargarDirectorio() { this.directorio = await obtenerDirectorioNormalizado(); },
    async toggleEstadoSocio(socio) { await alternarEstadoSocioWA(socio); await this.cargarDirectorio(); },
    async toggleHerenciaSocio(socio) { await alternarHerenciaSocio(socio); await this.cargarDirectorio(); },
    async cargarTasasMercado() { const t = await obtenerTasasVigentes(); this.loteActivo = t.id_tasa; this.tasasProduccion = t.tasas; },
    async conectarHooAPI() { const b = await capturarBorradorHoo(); if (b) this.borradorCapturado = b; },
    async publicarTasaOficial() { const id = await publicarBorradorTasa(this.borradorCapturado, this.modoPruebaActivo); if (id) this.loteActivo = id; },
    async reenviarTasaActual() { await reenviarLoteCompleto(this.loteActivo, this.modoPruebaActivo); },
    async enviarTasaIndividual(socio, fPrueba = null) { await despacharTasaIndividual(this.loteActivo, socio, fPrueba, this.modoPruebaActivo); },
    calcularTasaEnVivo(code, pct, esResta) { return calcularTasaEnVivo(this.tasasProduccion[code], pct, esResta); },
    abrirConfigSocio(socio) { this.socioConfigEdit = prepararEdicionSocio(socio, this.infoMonedasMaestra); this.modalConfigSocioAbierto = true; },
    async guardarConfigSocioModal() { await guardarConfiguracionSocio(this.socioConfigEdit); this.modalConfigSocioAbierto = false; await this.cargarDirectorio(); },
    getTallaClass(socio) { return obtenerClaseTalla(socio); },
    async cargarComprobantes() { this.comprobantes = await obtenerComprobantes({ socio: this.filtroSocio }); },
    abrirModal(item) { this.itemEdicion = prepararEdicionComprobante(item, this.loteActivo); this.modalAbierto = true; },
    async guardarCambios() { if (await guardarCambiosComprobante(this.itemEdicion?.hash_largo, this.itemEdicion, this.loteActivo)) { this.modalAbierto = false; await this.cargarComprobantes(); } },
    async releerIAModal() { if (await solicitarRelecturaIA(this.itemEdicion?.hash_largo)) { this.modalAbierto = false; await this.cargarComprobantes(); } },
    async eliminarComprobante(hash) { if (await eliminarComprobantePorHash(hash)) { this.modalAbierto = false; await this.cargarComprobantes(); } },
    get movimientoFiltradoTotal() { return calcularMovimientoFiltradoTotal(this.comprobantes, this.filtroSocio); },
    get sociosPendientesConsolidado() { return calcularSociosPendientesConsolidado(this.directorio, this.comprobantes, { fechaInicio: this.filtroFechaInicio, fechaFin: this.filtroFechaFin }); }
  }));
}

if (window.Alpine) { registrarAppAlpine(); }
else { document.addEventListener('alpine:init', registrarAppAlpine); }
