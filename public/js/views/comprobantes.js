export function comprobantesView() {
  return {
    items: [],
    socios: [],
    directorio: [],
    
    // Métricas KPI y Saldos
    saldoAnteriorReporte: 0.00,
    
    // Filtros
    filtroRol: '',
    filtroSocio: '',
    filtroFechaInicio: '',
    filtroFechaFin: '',
    filtroDesdeHash: '',
    filtroHastaHash: '',
    filtroHash: '',
    filtroOrden: 'fecha_desc',
    soloDuplicados: false,

    // Modales de auditoría y vista previa
    modalEdicionAbierto: false,
    itemEdicion: null,
    modalVistaPreviaAbierto: false,
    enviandoReporte: false,

    async init() {
      await this.cargarDirectorio();
      await this.cargarSocios();
      await this.cargarComprobantes();
    },

    async cargarComprobantes() {
      try {
        const filtros = {
          socio: this.filtroSocio,
          rol: this.filtroRol,
          fechaInicio: this.filtroFechaInicio,
          fechaFin: this.filtroFechaFin,
          desdeHash: this.filtroDesdeHash,
          hastaHash: this.filtroHastaHash,
          hash: this.filtroHash,
          soloDuplicados: this.soloDuplicados
        };

        if (this.filtroSocio) {
          const socioNorm = this.filtroSocio.trim().toUpperCase();
          const reg = this.directorio.find(d => d.nombre && d.nombre.trim().toUpperCase() === socioNorm);
          if (reg) {
            const valSaldo = reg.saldo_inicial ?? reg.saldo_anterior ?? 0;
            this.saldoAnteriorReporte = parseFloat(valSaldo) || 0;
          }
        }

        this.items = await window.AteneaAPI.getComprobantes(filtros);
      } catch (err) {
        console.error('[Glaukov Comprobantes ❌]', err);
      }
    },

    async cargarSocios() {
      try {
        const res = await window.AteneaAPI.getSocios();
        this.socios = Array.isArray(res) ? res.map(s => s.nombre || s) : [];
      } catch (err) {
        console.error('[Glaukov Socios ❌]', err);
      }
    },

    async cargarDirectorio() {
      try {
        this.directorio = await window.AteneaAPI.getDirectorio();
      } catch (err) {
        console.error('[Glaukov Directorio ❌]', err);
      }
    },

    // --- CÁLCULO DE TASAS POR SOCIO ---
    obtenerTasaSocioCalculada(c, numSocio = 1) {
      if (!c) return 1.0;
      const propTasa = numSocio === 2 ? (c.tasa_2 || c.tasa_socio_2) : (c.tasa_1 || c.tasa_socio_1 || c.tasa_socio);
      const valTasa = parseFloat(propTasa || c.tasa_base || c.tasa);
      return (!isNaN(valTasa) && valTasa !== 0) ? valTasa : 1.0;
    },

    // --- CÁLCULOS ME1 Y ME2 ORIGINALES RESTAURADOS ---
    obtenerME1(c) {
      if (!c) return 0;
      if (c.m1_socio !== undefined && c.m1_socio !== null && c.m1_socio !== '') {
        return Math.abs(parseFloat(c.m1_socio) || 0);
      }
      if (c.me1 !== undefined && c.me1 !== null && c.me1 !== '') {
        return Math.abs(parseFloat(c.me1) || 0);
      }

      const montoOrigen = Math.abs(parseFloat(c.monto || c.monto_origen || 0));
      const tasa = Math.abs(this.obtenerTasaSocioCalculada(c, 1));
      const moneda = String(c.moneda || c.moneda_comprobante || 'USDT').toUpperCase().trim();

      let equivalente = 0;
      if (['USD', 'USDT', 'PYUSD'].includes(moneda)) {
        equivalente = tasa > 0 ? (montoOrigen * tasa) : montoOrigen;
      } else {
        equivalente = tasa > 0 ? (montoOrigen / tasa) : montoOrigen;
      }

      return parseFloat(Math.abs(equivalente).toFixed(2));
    },

    obtenerME2(c) {
      if (!c) return 0;
      if (c.m2_socio !== undefined && c.m2_socio !== null && c.m2_socio !== '') {
        return Math.abs(parseFloat(c.m2_socio) || 0);
      }
      if (c.me2 !== undefined && c.me2 !== null && c.me2 !== '') {
        return Math.abs(parseFloat(c.me2) || 0);
      }

      const montoOrigen = Math.abs(parseFloat(c.monto || c.monto_origen || 0));
      const tasa = Math.abs(this.obtenerTasaSocioCalculada(c, 2));
      const moneda = String(c.moneda || c.moneda_comprobante || 'USDT').toUpperCase().trim();

      let equivalente = 0;
      if (['USD', 'USDT', 'PYUSD'].includes(moneda)) {
        equivalente = tasa > 0 ? (montoOrigen * tasa) : montoOrigen;
      } else {
        equivalente = tasa > 0 ? (montoOrigen / tasa) : montoOrigen;
      }

      return parseFloat(Math.abs(equivalente).toFixed(2));
    },

    obtenerMontoSocioCalculado(c) {
      if (!c) return 0;

      if (this.filtroSocio) {
        const socioNorm = this.filtroSocio.trim().toUpperCase();
        const s1 = String(c.socio_1 || c.socio || '').trim().toUpperCase();
        const s2 = String(c.socio_2 || '').trim().toUpperCase();

        if (socioNorm === s2) {
          return this.obtenerME2(c);
        }
        if (socioNorm === s1) {
          return this.obtenerME1(c);
        }
        if (c.monto_socio_final !== undefined && c.monto_socio_final !== null) {
          return Math.abs(parseFloat(c.monto_socio_final) || 0);
        }
      }

      return this.obtenerME1(c);
    },

    // --- CÁLCULOS Y ORDENAMIENTO DE COMPROBANTES ---
    get comprobantesProcesadosYOrdenados() {
      if (!this.items || !this.items.length) return [];
      let lista = [...this.items];

      return lista.sort((a, b) => {
        const tsA = parseInt(a.timestamp || a.timestamp_comprobante) || 0;
        const tsB = parseInt(b.timestamp || b.timestamp_comprobante) || 0;
        const montoA = parseFloat(this.obtenerMontoSocioCalculado(a)) || 0;
        const montoB = parseFloat(this.obtenerMontoSocioCalculado(b)) || 0;

        switch (this.filtroOrden) {
          case 'fecha_asc': return tsA - tsB;
          case 'fecha_desc': return tsB - tsA;
          case 'monto_desc': return montoB - montoA;
          case 'monto_asc': return montoA - montoB;
          default: return tsB - tsA;
        }
      });
    },

    get totalMovimientoFiltrado() {
      if (!this.items || !this.items.length) return 0;
      return this.items.reduce((acc, c) => acc + (parseFloat(this.obtenerMontoSocioCalculado(c)) || 0), 0);
    },

    get nuevoSaldoTotalCalculado() {
      const saldoAnt = parseFloat(this.saldoAnteriorReporte) || 0;
      return saldoAnt + this.totalMovimientoFiltrado;
    },

    get monedaSocioDominante() {
      if (!this.filtroSocio) return 'USDT';
      const socioNorm = this.filtroSocio.trim().toUpperCase();
      const reg = this.directorio.find(d => d.nombre && d.nombre.trim().toUpperCase() === socioNorm);
      if (reg) {
        const m = (reg.moneda_base || reg.moneda_socio || 'USDT').toUpperCase();
        return m === 'USD' ? 'USDT' : m;
      }
      return 'USDT';
    },

    get jidSocioActual() {
      if (!this.filtroSocio) return '';
      const socioNorm = this.filtroSocio.trim().toUpperCase();
      const reg = this.directorio.find(d => d.nombre && d.nombre.trim().toUpperCase() === socioNorm);
      return reg ? (reg.id_grupo || reg.whatsapp || '') : '';
    },

    obtenerEtiquetaHash(c) {
      if (c.etiqueta_hash) return c.etiqueta_hash;
      const tipo = c.tipo_op_socio || c.tipo_op || 'D';
      const hash = c.hash_corto || 'OP';
      return `[${tipo}-${hash}]`;
    },

    // 🟢 ALIAS Y ABRIR MODAL AUDITORÍA
    abrirModal(item) {
      this.abrirModalEdicion(item);
    },

    abrirModalEdicion(item) {
      let dateInput = '';
      const ts = item.timestamp || item.timestamp_comprobante;
      if (ts) {
        const d = new Date(ts * 1000);
        const tzOffset = d.getTimezoneOffset() * 60000;
        dateInput = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      }

      const loteSeleccionado = item.id_tasa || item.lote_tasa || item.lote_tasa_asignado || 'T052';
      const naturaleza = item.tipo_manual || item.tipo_op || item.tipo_op_1 || 'D';

      const baseMonto = parseFloat(item.monto || item.monto_local || 0);

      let m1 = item.monto_1 !== undefined && item.monto_1 !== null ? item.monto_1 : baseMonto;
      let m2 = item.monto_2 !== undefined && item.monto_2 !== null ? item.monto_2 : baseMonto;

      // 🟢 REGLA DE ABONO (A): Socio 1 (+) y Socio 2 (-)
      if (naturaleza === 'A') {
        m1 = Math.abs(parseFloat(m1) || 0);
        m2 = -Math.abs(parseFloat(m2) || 0);
      }

      this.itemEdicion = {
        ...item,
        id_tasa: loteSeleccionado,
        lote_tasa: loteSeleccionado,
        lote_tasa_asignado: loteSeleccionado,
        tipo_manual: naturaleza,
        fecha_hora_input: dateInput,
        monto_1: m1,
        monto_2: m2
      };
      
      this.modalEdicionAbierto = true;
    },

    // 🟢 RE-CALCULA SIGNOS AUTOMÁTICAMENTE AL CAMBIAR NATURALEZA A "A"
    actualizarSignosPorNaturaleza() {
      if (!this.itemEdicion) return;

      const nat = this.itemEdicion.tipo_manual;
      let val1 = Math.abs(parseFloat(this.itemEdicion.monto_1) || 0);
      let val2 = Math.abs(parseFloat(this.itemEdicion.monto_2) || 0);

      if (nat === 'A') {
        this.itemEdicion.monto_1 = val1;   // (+) Socio 1 suma
        this.itemEdicion.monto_2 = -val2;  // (-) Socio 2 resta
      }
    },

    // 🟢 GUARDAR EDICIÓN MANIFESTANDO LO INGRESADO POR EL ADMIN
    async guardarCambios() {
      await this.guardarEdicionComprobante();
    },

    async guardarEdicionComprobante() {
      if (!this.itemEdicion || !this.itemEdicion.hash_largo) return;
      try {
        if (this.itemEdicion.fecha_hora_input) {
          const ts = Math.floor(new Date(this.itemEdicion.fecha_hora_input).getTime() / 1000);
          if (!isNaN(ts) && ts > 0) this.itemEdicion.timestamp = ts;
        }

        const valM1 = this.itemEdicion.monto_1 !== '' ? parseFloat(this.itemEdicion.monto_1) : 0;
        const valM2 = this.itemEdicion.monto_2 !== '' ? parseFloat(this.itemEdicion.monto_2) : 0;

        const payload = {
          ...this.itemEdicion,
          id_tasa: this.itemEdicion.id_tasa || this.itemEdicion.lote_tasa_asignado || 'T052',
          lote_tasa: this.itemEdicion.id_tasa || this.itemEdicion.lote_tasa_asignado || 'T052',
          monto_1: valM1,
          monto_2: valM2,
          me1: valM1,
          me2: valM2,
          m1_socio: valM1,
          m2_socio: valM2
        };

        await window.AteneaAPI.actualizarComprobante(payload.hash_largo, payload);
        this.modalEdicionAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        alert('Error al guardar comprobante: ' + err.message);
      }
    },

    async eliminarComprobante(hashLargo) {
      if (!confirm('¿Deseas eliminar este comprobante de la base de datos?')) return;
      try {
        await window.AteneaAPI.eliminarComprobante(hashLargo);
        this.modalEdicionAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        alert('Error al eliminar comprobante: ' + err.message);
      }
    },

    async enviarReporteWhatsApp() {
      if (!this.jidSocioActual) {
        alert('El socio seleccionado no posee un Remote JID o ID Grupo de WhatsApp registrado.');
        return;
      }

      this.enviandoReporte = true;
      try {
        await window.AteneaAPI.enviarWhatsApp({
          socio: this.filtroSocio,
          remoteJid: this.jidSocioActual,
          saldoAnterior: this.saldoAnteriorReporte,
          movimiento: this.totalMovimientoFiltrado,
          nuevoSaldo: this.nuevoSaldoTotalCalculado,
          moneda: this.monedaSocioDominante,
          comprobantes: this.comprobantesProcesadosYOrdenados
        });
        alert(`✅ Reporte enviado a WhatsApp (${this.jidSocioActual}) con éxito.`);
      } catch (err) {
        alert('⚠️ Error enviando reporte: ' + err.message);
      } finally {
        this.enviandoReporte = false;
      }
    },

    // --- FORMATEADORES VISUALES ---
    formatMonto(val) {
      if (val === null || val === undefined || isNaN(val) || val === '') return '0.00';
      const num = parseFloat(val);
      if (num === 0) return '0.00';
      const parts = Math.abs(num).toFixed(2).split('.');
      const formatted = `${Number(parts[0]).toLocaleString('en-US')}.${parts[1]}`;
      return num < 0 ? `-${formatted}` : formatted;
    },

    formatTasa(val) {
      if (val === null || val === undefined || isNaN(val) || val === '') return '-';
      const num = Math.abs(parseFloat(val));
      if (isNaN(num) || num === 0) return '0';
      const vRound = Math.round(num * 1e8) / 1e8;

      if (vRound > 99.99) {
        return Math.trunc(vRound).toLocaleString('en-US');
      } else if (vRound >= 10.0) {
        const resNum = Math.trunc((vRound + 0.0000001) * 100) / 100;
        return resNum.toFixed(2).replace(/\.?0+$/, "");
      } else {
        const magnitud = Math.floor(Math.log10(vRound));
        const factor = Math.pow(10, 2 - magnitud);
        const resNum = Math.trunc((vRound + 0.0000001) * factor) / factor;
        return resNum.toString();
      }
    },

    formatFechaVE(ts) {
      if (!ts) return '-';
      const date = new Date(ts * 1000);
      return date.toLocaleString('es-VE', { 
        timeZone: 'America/Caracas', 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
      });
    },

    claseInsignia(codigo) {
      const mapa = {
        'D': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        'P': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        'A': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        'C': 'bg-purple-500/20 text-purple-300 border-purple-500/40'
      };
      return mapa[codigo] || 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };
}
