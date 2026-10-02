window.AteneaAPI = {
  // ==========================================
  // 1. COMPROBANTES Y AUDITORÍA
  // ==========================================
  async getComprobantes(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/comprobantes${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error('Error al obtener comprobantes');
    return await res.json();
  },

  async actualizarComprobante(hashLargo, payload) {
    const res = await fetch(`/api/comprobantes/${encodeURIComponent(hashLargo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al actualizar comprobante');
    return await res.json();
  },

  async eliminarComprobante(hashLargo) {
    const res = await fetch(`/api/comprobantes/${encodeURIComponent(hashLargo)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar comprobante');
    return await res.json();
  },

  async liquidarComprobante(payload) {
    const res = await fetch('/api/comprobantes/liquidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al liquidar comprobante');
    return await res.json();
  },

  async releerIA(hashLargo) {
    const res = await fetch(`/api/comprobantes/${encodeURIComponent(hashLargo)}/releer`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Error al solicitar re-lectura IA');
    return await res.json();
  },

  // ==========================================
  // 2. DIRECTORIO Y SOCIOS
  // ==========================================
  async getDirectorio() {
    const res = await fetch('/api/directorio');
    if (!res.ok) throw new Error('Error al obtener directorio');
    return await res.json();
  },

  async getSocios() {
    const res = await fetch('/api/socios');
    if (!res.ok) throw new Error('Error al obtener lista de socios');
    return await res.json();
  },

  async guardarSocioConfig(payload) {
    const res = await fetch('/api/socios/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al guardar configuración del socio');
    return await res.json();
  },

  async patchEstadoSocio(nombre, activo) {
    const res = await fetch(`/api/socios/${encodeURIComponent(nombre)}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo })
    });
    if (!res.ok) throw new Error('Error al cambiar estado del socio');
    return await res.json();
  },

  async desactivarTodosSocios() {
    const res = await fetch('/api/socios/desactivar-todos', {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error('Error al desactivar todos los socios');
    return await res.json();
  },

  async guardarVigentes() {
    const res = await fetch('/api/socios/guardar-vigentes', {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Error al guardar socios vigentes');
    return await res.json();
  },

  async restaurarVigentes() {
    const res = await fetch('/api/socios/restaurar-vigentes', {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Error al restaurar socios vigentes');
    return await res.json();
  },

  async eliminarSocioDirectorio(nombre) {
    const res = await fetch(`/api/directorio/${encodeURIComponent(nombre)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar socio del directorio');
    return await res.json();
  },

  // ==========================================
  // 3. TASAS Y MERCADO (INCLUYE MODO PRUEBA)
  // ==========================================
  async getUltimasTasas() {
    const res = await fetch('/api/tasas/ultimas');
    if (!res.ok) throw new Error('Error al obtener últimas tasas');
    return await res.json();
  },

  async getHistorialTasas() {
    const res = await fetch('/api/tasas/historial');
    if (!res.ok) throw new Error('Error al obtener historial de tasas');
    return await res.json();
  },

  async fetchHoo() {
    const res = await fetch('/api/tasas/fetch-hoo');
    if (!res.ok) throw new Error('Error al consultar Hoo API');
    return await res.json();
  },

  // 🟢 Transmite la bandera modoPrueba al publicar
  async publicarTasa(id_tasa, tasas, modoPrueba = false) {
    const res = await fetch('/api/tasas/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tasa, tasas, modoPrueba })
    });
    if (!res.ok) throw new Error('Error al publicar tasa');
    return await res.json();
  },

  // 🟢 Transmite socio y modoPrueba en la ráfaga general
  async reenviarTasa(id_tasa, socio = 'GENERAL', modoPrueba = false) {
    const res = await fetch('/api/tasas/reenviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tasa, socio, modoPrueba })
    });
    if (!res.ok) throw new Error('Error al reenviar tasas');
    return await res.json();
  },

  // 🟢 Transmite modoPrueba en reenvío individual por socio
  async reenviarTasaSocio(id_tasa, socio, modoPrueba = false) {
    const res = await fetch('/api/tasas/reenviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tasa, socio, modoPrueba })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Error al solicitar reenvío individual');
    }
    return data;
  },

  // ==========================================
  // 4. REPORTES Y NOTIFICACIONES
  // ==========================================
  async enviarWhatsApp(payload) {
    const res = await fetch('/api/reportes/enviar-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al enviar reporte WhatsApp');
    return await res.json();
  },

  async enviarMediaWhatsApp(payload) {
    const res = await fetch('/api/whatsapp/enviar-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al enviar media a WhatsApp');
    return await res.json();
  },

  // ==========================================
  // 5. CONSOLA DE ADMINISTRACIÓN
  // ==========================================
  async getColaAdmin(claveAdmin) {
    const res = await fetch('/api/admin/cola', {
      headers: { 'x-admin-key': claveAdmin }
    });
    if (!res.ok) throw new Error('Acceso no autorizado a consola Admin');
    return await res.json();
  },

  async updateColaAdmin(hashLargo, payload) {
    const res = await fetch(`/api/admin/cola/${encodeURIComponent(hashLargo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al actualizar cola Admin');
    return await res.json();
  },

  async deleteColaAdmin(hashLargo, claveAdmin) {
    const res = await fetch(`/api/admin/cola/${encodeURIComponent(hashLargo)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claveAdmin })
    });
    if (!res.ok) throw new Error('Error al eliminar ítem de la cola Admin');
    return await res.json();
  }
};
