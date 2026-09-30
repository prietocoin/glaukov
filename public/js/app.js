function truncarTasaComercial(valor) {
  const num = Math.abs(parseFloat(valor) || 0);
  if (num === 0) return 1.0;
  if (num > 99.99) {
    return Math.trunc(num);
  }
  return Math.trunc((num + 0.0000001) * 100) / 100;
}

function registrarAppAlpine() {
  Alpine.data('app', () => ({
    vistaActiva: 'comprobantes',
    comprobantes: [],
    directorio: [],
    socios: [],

    // Estado Mercado & Hoo API
    loteActivo: '',
    tasasProduccion: {},
    borradorCapturado: {},
    imagenPreviewUrl: '',
    socioPreviewSeleccionado: 'GENERAL',
    cargandoPreviewImagen: false,

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

    // Modales
    modalAbierto: false,
    itemEdicion: null,
    modalImagenAbierto: false,
    itemSeleccionado: null,
    modalConfigSocioAbierto: false,
    socioConfigEdit: null,

    // Sync
    timerPolling: null,
    ultimaActualizacion: '',

    async init() {
      await this.cargarSocios();
      await this.cargarComprobantes();
      await this.cargarDirectorio();
      await this.cargarTasasMercado();
      this.iniciarAutoSync();
    },

    iniciarAutoSync() {
      if (this.timerPolling) clearInterval(this.timerPolling);
      this.timerPolling = setInterval(() => {
        if (this.vistaActiva === 'comprobantes') this.cargarComprobantes(true);
        this.ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
      }, 5000);
    },

    // ==========================================
    // MERCADO, HOO API & PREVIEW IMAGE
    // ==========================================
    async cargarTasasMercado() {
      try {
        const res = await window.AteneaAPI.getUltimasTasas();
        if (res) {
          if (res.id_tasa) this.loteActivo = res.id_tasa;
          if (res.tasas) this.tasasProduccion = res.tasas;
        }
      } catch (err) {
        console.error('[Glaukov UI ❌ Error al cargar tasas mercado]', err);
      }
    },

    async conectarHooAPI() {
      try {
        const res = await window.AteneaAPI.fetchHoo();
        if (res && (res.rates || res.rates_draft)) {
          const rawRates = res.rates || res.rates_draft;
          const ratesNormalizadas = {};
          
          // Normalización estricta de llaves a MAYÚSCULAS
          Object.keys(rawRates).forEach(k => {
            ratesNormalizadas[k.toUpperCase()] = rawRates[k];
          });
          
          this.borradorCapturado = { ...ratesNormalizadas };
          alert('✅ Borrador capturado e inyectado con éxito.');
        } else {
          alert('No hay un borrador reciente enviado por n8n / Hoo API.');
        }
      } catch (err) {
        console.error(err);
        alert('Error conectando con la API de Hoo: ' + err.message);
      }
    },

    async generarPreviewImagen(socioNombre = 'GENERAL') {
      this.cargandoPreviewImagen = true;
      this.socioPreviewSeleccionado = socioNombre;
      try {
        const timestamp = new Date().getTime();
        this.imagenPreviewUrl = `/api/preview-image/${encodeURIComponent(socioNombre)}?t=${timestamp}`;
      } catch (err) {
        console.error('Error generando preview de imagen:', err);
      } finally {
        this.cargandoPreviewImagen = false;
      }
    },

    async publicarTasaOficial() {
      if (!this.borradorCapturado || Object.keys(this.borradorCapturado).length === 0) {
        alert('No hay borrador capturado para publicar.');
        return;
      }
      if (!confirm('¿Deseas publicar este borrador como la tasa oficial en producción?')) return;
      try {
        const res = await window.AteneaAPI.publicarTasa(null, this.borradorCapturado);
        if (res && res.id_tasa) this.loteActivo = res.id_tasa;
        alert(`Tasa oficial ${res?.id_tasa || ''} publicada correctamente.`);
        await this.cargarTasasMercado();
      } catch (err) {
        console.error(err);
        alert('Error al publicar tasa: ' + err.message);
      }
    },

    async reenviarTasaActual() {
      if (!this.loteActivo) {
        alert('No hay un lote activo cargado.');
        return;
      }
      if (!confirm(`¿Reenviar notificaciones para el lote ${this.loteActivo}?`)) return;
      try {
        await window.AteneaAPI.reenviarTasa(this.loteActivo);
        alert(`Reenvío activado para la tasa ${this.loteActivo}.`);
      } catch (err) {
        console.error(err);
        alert('Error al reenviar tasa: ' + err.message);
      }
    },

    // ==========================================
    // COMPROBANTES, DIRECTORIO & MODALES
    // ==========================================
    async cargarComprobantes(silencioso = false) {
      try {
        const params = {};
        if (this.filtroSocio) params.socio = this.filtroSocio;
        if (this.filtroRol) params.rol = this.filtroRol;
        if (this.filtroFechaInicio) params.fechaInicio = this.filtroFechaInicio;
        if (this.filtroFechaFin) params.fechaFin = this.filtroFechaFin;
        if (this.filtroHashBusqueda) params.hash = this.filtroHashBusqueda;
        if (this.ordenarPor) params.orden = this.ordenarPor;

        const res = await window.AteneaAPI.getComprobantes(params);
        this.comprobantes = Array.isArray(res) ? res : [];
      } catch (err) {
        if (!silencioso) console.error('[Glaukov UI ❌]', err);
        this.comprobantes = [];
      }
    },

    async cargarDirectorio() {
      try {
        const res = await window.AteneaAPI.getDirectorio();
        this.directorio = Array.isArray(res) ? res : [];
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    async cargarSocios() {
      try {
        const res = await window.AteneaAPI.getSocios();
        this.socios = Array.isArray(res) ? res : [];
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    abrirConfigSocio(socioObj) {
      let aj = {};
      try { aj = typeof socioObj.ajustes === 'string' ? JSON.parse(socioObj.ajustes || '{}') : (socioObj.ajustes || {}); } catch (e) {}
      
      const listaPaisesDefault = [
        { code: 'ARS', nombre: 'Argentina', bandera: '🇦🇷', activo: true, factorD: aj['D-ARS'] ?? 1.0, factorP: aj['P-ARS'] ?? -0.95, naturaleza: aj['naturaleza_ARS'] || aj['NAT-ARS'] || 'D' },
        { code: 'VES', nombre: 'Venezuela', bandera: '🇻🇪', activo: true, factorD: aj['D-VES'] ?? 1.0, factorP: aj['P-VES'] ?? -0.95, naturaleza: aj['naturaleza_VES'] || aj['NAT-VES'] || 'D' },
        { code: 'PEN', nombre: 'Peru', bandera: '🇵🇪', activo: true, factorD: aj['D-PEN'] ?? 1.0, factorP: aj['P-PEN'] ?? -0.95, naturaleza: aj['naturaleza_PEN'] || aj['NAT-PEN'] || 'D' },
        { code: 'COP', nombre: 'Colombia', bandera: '🇨🇴', activo: true, factorD: aj['D-COP'] ?? 1.03, factorP: aj['P-COP'] ?? -0.97, naturaleza: aj['naturaleza_COP'] || aj['NAT-COP'] || 'D' },
        { code: 'CLP', nombre: 'Chile', bandera: '🇨🇱', activo: true, factorD: aj['D-CLP'] ?? 1.0, factorP: aj['P-CLP'] ?? -0.95, naturaleza: aj['naturaleza_CLP'] || aj['NAT-CLP'] || 'D' },
        { code: 'BRL', nombre: 'Brazil', bandera: '🇧🇷', activo: true, factorD: aj['D-BRL'] ?? 1.0, factorP: aj['P-BRL'] ?? -0.95, naturaleza: aj['naturaleza_BRL'] || aj['NAT-BRL'] || 'D' },
        { code: 'PYG', nombre: 'Paraguay', bandera: '🇵🇾', activo: false, factorD: aj['D-PYG'] ?? 1.0, factorP: aj['P-PYG'] ?? -0.95, naturaleza: aj['naturaleza_PYG'] || aj['NAT-PYG'] || 'D' },
        { code: 'EUR', nombre: 'Europa', bandera: '🇪🇺', activo: false, factorD: aj['D-EUR'] ?? 1.0, factorP: aj['P-EUR'] ?? -0.95, naturaleza: aj['naturaleza_EUR'] || aj['NAT-EUR'] || 'D' },
        { code: 'USD', nombre: 'EEUU-Zelle', bandera: '🇺🇸', activo: false, factorD: aj['D-USD'] ?? 1.0, factorP: aj['P-USD'] ?? -0.95, naturaleza: aj['naturaleza_USD'] || aj['NAT-USD'] || 'D' }
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
        nombre: '', roles: 'SOCIO', moneda_socio: 'USDT', whatsapp: '', saldo_anterior: 0, activo: true
      });
    },

    calcularTasaEnVivo(code, factor, esDeposito = true) {
      const base = this.tasasProduccion[code] || 1.0;
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
          ajustes[`naturaleza_${p.code}`] = p.naturaleza || 'D';
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

        await window.AteneaAPI.guardarSocioConfig(payload);
        this.modalConfigSocioAbierto = false;
        await this.cargarDirectorio();
        await this.cargarSocios();
        await this.cargarComprobantes();
      } catch (err) {
        console.error('Error al guardar socio:', err);
        alert('Error guardando socio: ' + err.message);
      }
    },

    async toggleEstadoSocio(socio) {
      try {
        const nuevoEstado = !socio.activo;
        await window.AteneaAPI.patchEstadoSocio(socio.nombre, nuevoEstado);
        socio.activo = nuevoEstado;
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    async apagarTodosSocios() {
      if (!confirm('¿Deseas apagar/desactivar todos los socios?')) return;
      try {
        await window.AteneaAPI.desactivarTodosSocios();
        await this.cargarDirectorio();
      } catch (err) {
        console.error(err);
      }
    },

    async guardarVigentes() {
      try {
        await window.AteneaAPI.guardarVigentes();
        alert('Plantilla de socios vigentes memorizada.');
      } catch (err) {
        console.error(err);
      }
    },

    async restaurarVigentes() {
      try {
        await window.AteneaAPI.restaurarVigentes();
        await this.cargarDirectorio();
        alert('Socios vigentes restaurados.');
      } catch (err) {
        console.error(err);
      }
    },

    async eliminarSocioDirectorio(nombre) {
      if (!confirm(`¿Eliminar permanentemente a ${nombre}?`)) return;
      try {
        await window.AteneaAPI.eliminarSocioDirectorio(nombre);
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

      const tipoOpBruto = (item.tipo_op1 || item.tipo_op_socio || item.tipo_op || item.tipo_manual || 'D').split('-')[0];
      const fallbackSocio1 = item.nombre_socio_1 || item.socio_1 || item.fb_socio_1 || 'GENERAL';
      const fallbackSocio2 = item.nombre_socio_2 || item.socio_2 || item.fb_socio_2 || 'GENERAL';
      const fallbackMonto = Math.abs(parseFloat(item.monto || item.monto_local || item.m1_socio || item.monto_1 || 0));

      this.itemEdicion = { 
        ...item,
        banco: item.banco && item.banco !== '-' ? item.banco : '',
        referencia: item.referencia && item.referencia !== '-' ? item.referencia : '',
        titular: item.titular && item.titular !== '-' ? item.titular : '',
        nombre_socio_1: fallbackSocio1,
        nombre_socio_2: fallbackSocio2,
        tipo_manual: tipoOpBruto,
        moneda: (item.moneda || item.moneda_local || 'COP').toUpperCase(),
        monto: fallbackMonto,
        tasa_1: truncarTasaComercial(item.tasa_1 || 1.0),
        me1: item.me1 !== undefined && item.me1 !== null ? item.me1 : fallbackMonto,
        tasa_2: truncarTasaComercial(item.tasa_2 || 1.0),
        me2: item.me2 || 0,
        lote_tasa_asignado: item.lote_tasa || item.lote_tasa_asignado || this.loteActivo || 'T041',
        fecha_hora_input: dateInput
      };
      this.modalAbierto = true;
    },

    async releerIAModal() {
      if (!this.itemEdicion || !this.itemEdicion.hash_largo) return;
      if (!confirm('¿Deseas enviar este comprobante a re-lectura con Gemini?')) return;
      try {
        await window.AteneaAPI.releerIA(this.itemEdicion.hash_largo);
        alert('⚡ Comprobante enviado a la cola de re-lectura IA correctamente.');
        this.modalAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        console.error('Error en re-lectura IA:', err);
        alert('Error: ' + err.message);
      }
    },

    async guardarCambios() {
      if (!this.itemEdicion || !this.itemEdicion.hash_largo) return;
      try {
        if (this.itemEdicion.fecha_hora_input) {
          const ts = Math.floor(new Date(this.itemEdicion.fecha_hora_input).getTime() / 1000);
          if (!isNaN(ts) && ts > 0) this.itemEdicion.timestamp = ts;
        }

        const montoEditado = Math.abs(parseFloat(this.itemEdicion.monto || 0));
        const divisaEditada = (this.itemEdicion.moneda || 'USDT').toUpperCase();

        await window.AteneaAPI.actualizarComprobante(this.itemEdicion.hash_largo, {
          monto: montoEditado,
          moneda: divisaEditada,
          banco: this.itemEdicion.banco,
          referencia: this.itemEdicion.referencia,
          titular: this.itemEdicion.titular
        });

        const tasaBaseDivisa = parseFloat(this.tasasProduccion[divisaEditada] || 1.0);

        const s1Obj = this.directorio.find(d => d.nombre === this.itemEdicion.nombre_socio_1);
        const s2Obj = this.directorio.find(d => d.nombre === this.itemEdicion.nombre_socio_2);

        const monS1 = (s1Obj?.moneda_socio || 'USDT').toUpperCase();
        const monS2 = (s2Obj?.moneda_socio || 'USDT').toUpperCase();

        const tasaBaseS1 = parseFloat(this.tasasProduccion[monS1] || 1.0);
        const tasaBaseS2 = parseFloat(this.tasasProduccion[monS2] || 1.0);

        let aj1 = {}, aj2 = {};
        try { aj1 = typeof s1Obj?.ajustes === 'string' ? JSON.parse(s1Obj.ajustes || '{}') : (s1Obj?.ajustes || {}); } catch (e) {}
        try { aj2 = typeof s2Obj?.ajustes === 'string' ? JSON.parse(s2Obj.ajustes || '{}') : (s2Obj?.ajustes || {}); } catch (e) {}

        const tipoOpLetra = (this.itemEdicion.tipo_manual || 'D').toUpperCase().charAt(0);
        
        const factor1 = Math.abs(parseFloat(aj1[`${tipoOpLetra}-${divisaEditada}`]) || 1.0);
        const factor2 = Math.abs(parseFloat(aj2[`${tipoOpLetra}-${divisaEditada}`]) || 1.0);

        const cross1 = (tasaBaseDivisa / (tasaBaseS1 > 0 ? tasaBaseS1 : 1.0)) * factor1;
        const tasa1Calculada = truncarTasaComercial(cross1);

        const cross2 = (tasaBaseDivisa / (tasaBaseS2 > 0 ? tasaBaseS2 : 1.0)) * factor2;
        const tasa2Calculada = truncarTasaComercial(cross2);

        const signo1 = tipoOpLetra === 'P' ? -1 : 1;
        const signo2 = -1 * signo1;
        const tieneSocio2 = this.itemEdicion.nombre_socio_2 && this.itemEdicion.nombre_socio_2 !== 'GENERAL';

        const m1Nominal = tasa1Calculada > 0 ? (signo1 * montoEditado / tasa1Calculada) : (signo1 * montoEditado);
        const me1USDT = m1Nominal / (tasaBaseS1 > 0 ? tasaBaseS1 : 1.0);

        const m2Nominal = tieneSocio2 ? (tasa2Calculada > 0 ? (signo2 * montoEditado / tasa2Calculada) : 0) : 0;
        const me2USDT = tieneSocio2 ? (m2Nominal / (tasaBaseS2 > 0 ? tasaBaseS2 : 1.0)) : 0;

        const tipoOpFinal = `${tipoOpLetra}-${divisaEditada}`;

        await window.AteneaAPI.liquidarComprobante({
          hash_largo: this.itemEdicion.hash_largo,
          socio_1: this.itemEdicion.nombre_socio_1 || 'GENERAL',
          tipo_op1: tipoOpFinal,
          monto_1: m1Nominal,
          tasa_1: tasa1Calculada,
          me1: me1USDT,
          socio_2: tieneSocio2 ? this.itemEdicion.nombre_socio_2 : null,
          tipo_op2: tipoOpFinal,
          monto_2: m2Nominal,
          tasa_2: tasa2Calculada,
          me2: me2USDT,
          lote_tasa: this.itemEdicion.lote_tasa_asignado || this.loteActivo || 'T041'
        });

        this.modalAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        console.error('❌ Error en guardarCambios:', err);
        alert('Error al guardar liquidación: ' + err.message);
      }
    },

    async eliminarComprobante(hashLargo) {
      if (!hashLargo || !confirm('¿Deseas eliminar este comprobante?')) return;
      try {
        await window.AteneaAPI.eliminarComprobante(hashLargo);
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
