export const AteneaAPI = {
  async getComprobantes(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/v1/atenea/comprobantes?${query}`);
    if (!res.ok) throw new Error('Error al obtener comprobantes');
    return await res.json();
  },

  async getDirectorio() {
    const res = await fetch('/api/v1/atenea/directorio');
    if (!res.ok) throw new Error('Error al obtener directorio');
    return await res.json();
  },

  async getSocios() {
    const res = await fetch('/api/v1/atenea/socios');
    if (!res.ok) throw new Error('Error al obtener lista de socios');
    return await res.json();
  },

  async patchEstadoSocio(nombre, activo) {
    const res = await fetch(`/api/v1/atenea/socios/${encodeURIComponent(nombre)}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo })
    });
    if (!res.ok) throw new Error('Error al cambiar estado');
    return await res.json();
  },

  async desactivarTodosSocios() {
    const res = await fetch('/api/v1/atenea/socios/desactivar-todos', { method: 'PATCH' });
    if (!res.ok) throw new Error('Error al desactivar socios');
    return await res.json();
  }
};
