// =================================================================
// ARCHIVO: comprobantesGetters.js
// RESPONSABILIDAD: Propiedades computadas y ordenamiento de grilla
// =================================================================

export const comprobantesGetters = {
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
    const reg = (this.directorio || []).find(d => d.nombre && d.nombre.trim().toUpperCase() === socioNorm);
    if (reg) {
      const m = (reg.moneda_base || reg.moneda_socio || 'USDT').toUpperCase();
      return m === 'USD' ? 'USDT' : m;
    }
    return 'USDT';
  },

  get jidSocioActual() {
    if (!this.filtroSocio) return '';
    const socioNorm = this.filtroSocio.trim().toUpperCase();
    const reg = (this.directorio || []).find(d => d.nombre && d.nombre.trim().toUpperCase() === socioNorm);
    return reg ? (reg.id_grupo || reg.whatsapp || '') : '';
  },

  obtenerEtiquetaHash(c) {
    if (c.etiqueta_hash) return c.etiqueta_hash;
    const tipo = c.tipo_op_socio || c.tipo_op || 'D';
    const hash = c.hash_corto || 'OP';
    return `[${tipo}-${hash}]`;
  }
};
