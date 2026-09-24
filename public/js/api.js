/**
 * Cliente HTTP unificado para Glaukov / Atenea
 * Conectado a las rutas reales de server.js
 */
export const AteneaAPI = {
  // 1. COMPROBANTES Y REPORTES
  async getComprobantes(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.socio) params.append('socio', filtros.socio);
    if (filtros.rol) params.append('rol', filtros.rol);
    if (filtros.fechaInicio) params.append('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params.append('fechaFin', filtros.fechaFin);
    if (filtros.desdeHash) params.append('desdeHash', filtros.desdeHash);
    if (filtros.hastaHash) params.append('hastaHash', filtros.hastaHash);
    if (filtros.hash) params.append('hash', filtros.hash);
    if (filtros.soloDuplicados) params.append('soloDuplicados', 'true');

    const res = await fetch(`/api/comprobantes?${params.toString()}`);
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

  // 2. TASAS Y MERCADO
  async getUltimasTasas() {
    const res = await fetch('/api/tasas/ultimas');
    if (!res.ok) throw new Error('Error al obtener últimas tasas');
    return await res.json();
  },

  async fetchHoo() {
    const res = await fetch('/api/tasas/fetch-hoo');
    if (!res.ok) throw new Error('Error al conectar con la API de Hoo');
    return await res.json();
  },

  async publicarTasa(idTasa, tasas) {
    const res = await fetch('/api/tasas/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tasa: idTasa, tasas })
    });
    if (!res.ok) throw new Error('Error al publicar tasa oficial');
    return await res.json();
  },

  async reenviarTasa(idTasa) {
    const res = await fetch('/api/tasas/reenviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tasa: idTasa })
    });
    if (!res.ok) throw new Error('Error al reenviar tasa');
    return await res.json();
  },

  // 3. SOCIOS Y DIRECTORIO (nombres_fb)
  async getSocios() {
    const res = await fetch('/api/socios');
    if (!res.ok) throw new Error('Error al obtener lista de socios');
    return await res.json();
  },

  async getDirectorio() {
    const res = await fetch('/api/directorio');
    if (!res.ok) throw new Error('Error al obtener directorio');
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
    if (!res.ok) throw new Error('Error al cambiar estado');
    return await res.json();
  },

  async desactivarTodosSocios() {
    const res = await fetch('/api/socios/desactivar-todos', { method: 'PATCH' });
    if (!res.ok) throw new Error('Error al desactivar socios');
    return await res.json();
  },

  async guardarVigentes() {
    const res = await fetch('/api/socios/guardar-vigentes', { method: 'POST' });
    if (!res.ok) throw new Error('Error al guardar socios vigentes');
    return await res.json();
  },

  async restaurarVigentes() {
    const res = await fetch('/api/socios/restaurar-vigentes', { method: 'POST' });
    if (!res.ok) throw new Error('Error al restaurar socios vigentes');
    return await res.json();
  },

  async eliminarSocioDirectorio(nombre) {
    const res = await fetch(`/api/directorio/${encodeURIComponent(nombre)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar socio');
    return await res.json();
  },

  // 4. ENVÍO DE REPORTES Y ADMIN
  async enviarWhatsApp(payload) {
    const res = await fetch('/api/reportes/enviar-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al enviar reporte a WhatsApp');
    return await res.json();
  },

  async getColaAdmin(claveAdmin) {
    const res = await fetch('/api/admin/cola', {
      headers: { 'x-admin-key': claveAdmin }
    });
    if (!res.ok) throw new Error('Acceso no autorizado a consola Admin');
    return await res.json();
  }
};
