import { AteneaAPI } from '../api.js';

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

        // Sincroniza saldo anterior del socio desde el directorio
        if (this.filtroSocio) {
          const socioNorm = this.filtroSocio.trim().toUpperCase();
          const reg = this.directorio.find(d => d.nombre && d.nombre.trim().toUpperCase() === socioNorm);
          if (reg) {
            const aj = typeof reg.ajustes === 'string' ? JSON.parse(reg.ajustes || '{}') : (reg.ajustes || {});
            const valSaldo = aj.saldo_anterior !== undefined ? aj.saldo_anterior : reg.saldo_anterior;
            this.saldoAnteriorReporte = valSaldo !== undefined && valSaldo !== null ? parseFloat(valSaldo) : 0;
          }
        }

        this.items = await AteneaAPI.getComprobantes(filtros);
      } catch (err) {
        console.error('[Glaukov Comprobantes ❌]', err);
      }
    },

    async cargarSocios() {
      try {
        const res = await AteneaAPI.getSocios();
        this.socios = Array.isArray(res) ? res.map(s => s.nombre || s) : [];
      } catch (err) {
        console.error('[Glaukov Socios ❌]', err);
      }
    },

    async cargarDirectorio() {
      try {
        this.directorio = await AteneaAPI.getDirectorio();
      } catch (err) {
        console.error('[Glaukov Directorio ❌]', err);
      }
    },

    // --- CÁLCULOS KPI Y REGLAS DE NEGOCIO ---
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
          case 'monto_desc': return Math.abs(montoB) - Math.abs(montoA);
          case 'monto_asc': return Math.abs(montoA) - Math.abs(montoB);
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
      if (reg && reg.moneda_socio) {
        return reg.moneda_socio === 'USD' ? 'USDT' : reg.moneda_socio.toUpperCase();
      }
      return 'USDT';
    },

    get jidSocioActual() {
      if (!this.filtroSocio) return '';
      const socioNorm = this.filtroSocio.trim().toUpperCase();
      const reg = this.directorio.find(d => d.nombre && d.nombre.trim().toUpperCase() === socioNorm);
      return reg ? (reg.whatsapp || reg.id_grupo || '') : '';
    },

    obtenerMontoSocioCalculado(c) {
      if (c.monto_socio_final !== undefined && this.filtroSocio) {
        return parseFloat(c.monto_socio_final) || 0;
      }
      return parseFloat(c.m1_socio) || parseFloat(c.monto) || 0;
    },

    obtenerTasaSocioCalculada(c) {
      if (c.tasa_socio_final !== undefined) return parseFloat(c.tasa_socio_final) || 0;
      return parseFloat(c.tasa_1) || parseFloat(c.tasa_base) || 1.0;
    },

    obtenerEtiquetaHash(c) {
      if (c.etiqueta_hash) return c.etiqueta_hash;
      const tipo = c.tipo_op_socio || c.tipo_op || 'D';
      const hash = c.hash_corto || 'OP';
      return `[${tipo}-${hash}]`;
    },

    // --- ACCIONES MODAL EDICIÓN / AUDITORÍA ---
    abrirModalEdicion(item) {
      let dateInput = '';
      const ts = item.timestamp || item.timestamp_comprobante;
      if (ts) {
        const d = new Date(ts * 1000);
        const tzOffset = d.getTimezoneOffset() * 60000;
        dateInput = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      }

      this.itemEdicion = {
        ...item,
        lote_tasa_asignado: item.lote_tasa_asignado || 'T040',
        tipo_manual: item.tipo_op || item.tipo_op_1 || 'D',
        fecha_hora_input: dateInput
      };
      this.modalEdicionAbierto = true;
    },

    async guardarEdicionComprobante() {
      if (!this.itemEdicion || !this.itemEdicion.hash_largo) return;
      try {
        if (this.itemEdicion.fecha_hora_input) {
          const ts = Math.floor(new Date(this.itemEdicion.fecha_hora_input).getTime() / 1000);
          if (!isNaN(ts) && ts > 0) this.itemEdicion.timestamp = ts;
        }

        await AteneaAPI.actualizarComprobante(this.itemEdicion.hash_largo, this.itemEdicion);
        this.modalEdicionAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        alert('Error al guardar comprobante: ' + err.message);
      }
    },

    async eliminarComprobante(hashLargo) {
      if (!confirm('¿Deseas eliminar este comprobante de la base de datos?')) return;
      try {
        await AteneaAPI.eliminarComprobante(hashLargo);
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
        await AteneaAPI.enviarWhatsApp({
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
      const signoStr = num < 0 ? '-' : '';
      const v = Math.abs(num);
      const vRound = Math.round(v * 1e8) / 1e8;
      const vTrunc = Math.trunc((vRound + 0.0000001) * 100) / 100;
      const parts = vTrunc.toFixed(2).split('.');
      return `${signoStr}${Number(parts[0]).toLocaleString('en-US')}.${parts[1]}`;
    },

    formatTasa(val) {
      if (val === null || val === undefined || isNaN(val) || val === '') return '-';
      const num = parseFloat(val);
      if (isNaN(num) || num === 0) return '0';
      const signoStr = num < 0 ? '-' : '';
      const v = Math.abs(num);
      const vRound = Math.round(v * 1e8) / 1e8;

      if (vRound > 99.99) {
        return signoStr + Math.trunc(vRound).toLocaleString('en-US');
      } else if (vRound >= 10.0) {
        const resNum = Math.trunc((vRound + 0.0000001) * 100) / 100;
        return signoStr + resNum.toFixed(2).replace(/\.?0+$/, "");
      } else {
        const magnitud = Math.floor(Math.log10(vRound));
        const factor = Math.pow(10, 2 - magnitud);
        const resNum = Math.trunc((vRound + 0.0000001) * factor) / factor;
        return signoStr + resNum.toString();
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
