import { AteneaAPI } from './api.js';

function registrarAppAlpine() {
  Alpine.data('app', () => ({
    vistaActiva: 'comprobantes',
    comprobantes: [],
    directorio: [],
    socios: [],

    // Filtros Comprobantes
    filtroRol: '',
    filtroSocio: '',
    filtroFechaInicio: '',
    filtroFechaFin: '',
    filtroDesdeHash: '',
    filtroHastaHash: '',
    ordenarPor: 'fecha_desc',
    filtroHashBusqueda: '',
    saldoAnterior: 0,

    // Directorio & Filtros
    busquedaDirectorio: '',

    // Modales de Comprobantes
    modalAbierto: false,
    itemEdicion: null,
    modalImagenAbierto: false,
    itemSeleccionado: null,

    // Modal Configuración Integral del Socio
    modalConfigSocioAbierto: false,
    socioConfigEdit: null,

    // Sync
    timerPolling: null,
    ultimaActualizacion: '',

    // Tasas base de mercado en memoria para precálculo
    tasasMercadoBase: {
      ARS: 1550,
      VES: 960,
      PEN: 3.38,
      COP: 3250,
      CLP: 950,
      BRL: 5.15,
      PYG: 5850,
      EUR: 0.88,
      USD: 1.00,
      MXN: 17.50
    },

    // Cartelera Tasas Glaukov
    carteleraTasas: [
      { pais: 'Argentina (ARS)', bandera: '🇦🇷', code: 'ARS', comprar: 1665, vender: 1536, trendC: 'up', trendV: 'up' },
      { pais: 'Venezuela (VES)', bandera: '🇻🇪', code: 'VES', comprar: 988, vender: 953, trendC: 'up', trendV: 'up' },
      { pais: 'Peru (PEN)', bandera: '🇵🇪', code: 'PEN', comprar: 3.48, vender: 3.35, trendC: 'up', trendV: 'up' },
      { pais: 'Colombia (COP)', bandera: '🇨🇴', code: 'COP', comprar: 3386, vender: 3253, trendC: 'up', trendV: 'up' },
      { pais: 'Chile (CLP)', bandera: '🇨🇱', code: 'CLP', comprar: 1001, vender: 924, trendC: 'down', trendV: 'down' },
      { pais: 'Brazil (BRL)', bandera: '🇧🇷', code: 'BRL', comprar: 5.46, vender: 4.94, trendC: 'up', trendV: 'up' },
      { pais: 'Paraguay (PYG)', bandera: '🇵🇾', code: 'PYG', comprar: 6222, vender: 5629, trendC: 'up', trendV: 'up' },
      { pais: 'Europa (EUR)', bandera: '🇪🇺', code: 'EUR', comprar: 0.985, vender: 0.774, trendC: 'eq', trendV: 'eq' },
      { pais: 'EEUU-Zelle (USD)', bandera: '🇺🇸', code: 'USD', comprar: 1.08, vender: 0.95, trendC: 'eq', trendV: 'eq' }
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
        if (this.vistaActiva === 'comprobantes') this.cargarComprobantes(true);
        this.ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
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

    // ==========================================
    // LÓGICA DEL DIRECTORIO Y CONFIGURACIÓN DE SOCIOS
    // ==========================================
    abrirConfigSocio(socioObj) {
      let aj = {};
      try { aj = typeof socioObj.ajustes === 'string' ? JSON.parse(socioObj.ajustes || '{}') : (socioObj.ajustes || {}); } catch (e) {}
      
      const listaPaisesDefault = [
        { code: 'ARS', nombre: 'Argentina', bandera: '🇦🇷', activo: true, factorD: aj['D-ARS'] ?? 1.0, factorP: aj['P-ARS'] ?? -0.95 },
        { code: 'VES', nombre: 'Venezuela', bandera: '🇻🇪', activo: true, factorD: aj['D-VES'] ?? 1.0, factorP: aj['P-VES'] ?? -0.95 },
        { code: 'PEN', nombre: 'Peru', bandera: '🇵🇪', activo: true, factorD: aj['D-PEN'] ?? 1.0, factorP: aj['P-PEN'] ?? -0.95 },
        { code: 'COP', nombre: 'Colombia', bandera: '🇨🇴', activo: true, factorD: aj['D-COP'] ?? 1.03, factorP: aj['P-COP'] ?? -0.97 },
        { code: 'CLP', nombre: 'Chile', bandera: '🇨🇱', activo: true, factorD: aj['D-CLP'] ?? 1.0, factorP: aj['P-CLP'] ?? -0.95 },
        { code: 'BRL', nombre: 'Brazil', bandera: '🇧🇷', activo: true, factorD: aj['D-BRL'] ?? 1.0, factorP: aj['P-BRL'] ?? -0.95 },
        { code: 'PYG', nombre: 'Paraguay', bandera: '🇵🇾', activo: false, factorD: aj['D-PYG'] ?? 1.0, factorP: aj['P-PYG'] ?? -0.95 },
        { code: 'EUR', nombre: 'Europa', bandera: '🇪🇺', activo: false, factorD: aj['D-EUR'] ?? 1.0, factorP: aj['P-EUR'] ?? -0.95 },
        { code: 'USD', nombre: 'EEUU-Zelle', bandera: '🇺🇸', activo: false, factorD: aj['D-USD'] ?? 1.0, factorP: aj['P-USD'] ?? -0.95 }
      ];

      this.socioConfigEdit = {
        nombre: socioObj.nombre || 'NUEVO_SOCIO',
        roles: socioObj.roles || 'SOCIO',
        moneda_socio: socioObj.moneda_socio || 'USDT',
        whatsapp: socioObj.whatsapp || socioObj.id_grupo || '',
        saldo_anterior: socioObj.saldo_anterior || 0,
        activo: socioObj.activo ?? true,
        paises: listaPaisesDefault
      };

      this.modalConfigSocioAbierto = true;
    },

    crearNuevoSocio() {
      this.abrirConfigSocio({
        nombre: '',
        roles: 'SOCIO',
        moneda_socio: 'USDT',
        whatsapp: '',
        saldo_anterior: 0,
        activo: true
      });
    },

    calcularTasaEnVivo(code, factor, esDeposito = true) {
      const base = this.tasasMercadoBase[code] || 1.0;
      const f = parseFloat(factor) || (esDeposito ? 1.0 : -0.95);
      const res = base * Math.abs(f);
      if (res === 0) return '0';
      if (res > 99.99) return Math.trunc(res).toLocaleString('en-US');
      return (Math.trunc(res * 100) / 100).toFixed(2);
    },

    async guardarConfigSocioModal() {
      if (!this.socioConfigEdit || !this.socioConfigEdit.nombre.trim()) {
        alert('Por favor especifica el nombre del socio.');
        return;
      }

      try {
        const ajustes = {};
        const carteleraPaises = [];

        this.socioConfigEdit.paises.forEach(p => {
          ajustes[`D-${p.code}`] = parseFloat(p.factorD) || 1.0;
          ajustes[`P-${p.code}`] = parseFloat(p.factorP) || -0.95;
          if (p.activo) {
            carteleraPaises.push({ moneda: p.code, pais: p.nombre, activo: true });
          }
        });

        const payload = {
          nombre: this.socioConfigEdit.nombre,
          roles: this.socioConfigEdit.roles,
          moneda_socio: this.socioConfigEdit.moneda_socio,
          whatsapp: this.socioConfigEdit.whatsapp,
          saldo_anterior: this.socioConfigEdit.saldo_anterior,
          activo: this.socioConfigEdit.activo,
          ajustes,
          cartelera_paises: carteleraPaises
        };

        await AteneaAPI.guardarSocioConfig(payload);
        this.modalConfigSocioAbierto = false;
        await this.cargarDirectorio();
        await this.cargarSocios();
      } catch (err) {
        console.error('Error al guardar socio:', err);
        alert('Error guardando socio: ' + err.message);
      }
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

    async apagarTodosSocios() {
      if (!confirm('¿Deseas apagar/desactivar todos los socios?')) return;
      try {
        await AteneaAPI.desactivarTodosSocios();
        await this.cargarDirectorio();
      } catch (err) {
        console.error(err);
      }
    },

    async guardarVigentes() {
      try {
        await AteneaAPI.guardarVigentes();
        alert('Plantilla de socios vigentes memorizada.');
      } catch (err) {
        console.error(err);
      }
    },

    async restaurarVigentes() {
      try {
        await AteneaAPI.restaurarVigentes();
        await this.cargarDirectorio();
        alert('Socios vigentes restaurados.');
      } catch (err) {
        console.error(err);
      }
    },

    async eliminarSocioDirectorio(nombre) {
      if (!confirm(`¿Eliminar permanentemente a ${nombre}?`)) return;
      try {
        await AteneaAPI.eliminarSocioDirectorio(nombre);
        await this.cargarDirectorio();
      } catch (err) {
        console.error(err);
      }
    },

    getTallaClass(socioObj) {
      const count = socioObj.cartelera_paises ? socioObj.cartelera_paises.length : 3;
      if (count <= 3) return { label: `Talla: S [${count}]`, color: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40' };
      if (count <= 6) return { label: `Talla: M [${count}]`, color: 'border-amber-500/40 text-amber-300 bg-amber-950/40' };
      return { label: `Talla: L [${count}]`, color: 'border-purple-500/40 text-purple-300 bg-purple-950/40' };
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
          if (!isNaN(ts) && ts > 0) this.itemEdicion.timestamp = ts;
        }

        await AteneaAPI.actualizarComprobante(this.itemEdicion.hash_largo, this.itemEdicion);
        this.modalAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        console.error('Error en guardarCambios:', err);
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
        (d && d.roles && d.roles.toLowerCase().includes(q)) ||
        (d && d.whatsapp && d.whatsapp.toLowerCase().includes(q))
      );
    }
  }));
}

if (window.Alpine) {
  registrarAppAlpine();
} else {
  document.addEventListener('alpine:init', registrarAppAlpine);
}
