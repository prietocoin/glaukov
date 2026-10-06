// =================================================================
// ARCHIVO: comprobantesAcciones.js
// RESPONSABILIDAD: Modales de auditoría, edición, borrado y WhatsApp
// =================================================================

export const comprobantesAcciones = {
  abrirModalEdicion(item) {
    let dateInput = '';
    const ts = item.timestamp || item.timestamp_comprobante;
    if (ts) {
      const d = new Date(ts * 1000);
      const tzOffset = d.getTimezoneOffset() * 60000;
      dateInput = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    }

    const loteSeleccionado = item.id_tasa || item.lote_tasa || item.lote_tasa_asignado || 'T052';

    this.itemEdicion = {
      ...item,
      id_tasa: loteSeleccionado,
      lote_tasa: loteSeleccionado,
      lote_tasa_asignado: loteSeleccionado,
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

      const payload = {
        ...this.itemEdicion,
        id_tasa: this.itemEdicion.id_tasa || this.itemEdicion.lote_tasa_asignado || 'T052',
        lote_tasa: this.itemEdicion.id_tasa || this.itemEdicion.lote_tasa_asignado || 'T052'
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
  }
};
