// =================================================================
// ARCHIVO: comprobantesGetters.js
// UBICACIÓN: public/js/views/comprobantes/comprobantesGetters.js
// RESPONSABILIDAD: Filtrado y ordenamiento seguro de comprobantes
// =================================================================

export const comprobantesGetters = {
  get comprobantesProcesadosYOrdenados() {
    // 1. Obtener la lista principal de ítems del estado de forma segura
    let list = Array.isArray(this.items) ? [...this.items] : [];
    if (!list.length) return [];

    // 2. Filtro por Rol (Ignora si es vacío o 'TODOS')
    if (this.filtroRol && this.filtroRol !== 'TODOS' && this.filtroRol !== '') {
      list = list.filter(i => (i.rol || '').toUpperCase() === this.filtroRol.toUpperCase());
    }

    // 3. Filtro por Socio / Entidad (Ignora si es vacío o 'TODOS')
    if (this.filtroSocio && this.filtroSocio !== 'TODOS' && this.filtroSocio !== '') {
      list = list.filter(i => {
        const nombre = i.socio_nombre || i.socio || i.entidad || '';
        return nombre.toLowerCase().includes(this.filtroSocio.toLowerCase());
      });
    }

    // 4. Filtro por Rango de Fechas
    if (this.filtroFechaInicio) {
      list = list.filter(i => i.fecha && i.fecha >= this.filtroFechaInicio);
    }
    if (this.filtroFechaFin) {
      list = list.filter(i => i.fecha && i.fecha <= this.filtroFechaFin);
    }

    // 5. Búsqueda por Texto (Hash, Titular o Banco)
    if (this.filtroHash && typeof this.filtroHash === 'string' && this.filtroHash.trim() !== '') {
      const q = this.filtroHash.trim().toLowerCase();
      list = list.filter(i => 
        (i.hash_largo || '').toLowerCase().includes(q) ||
        (i.hash_corto || '').toLowerCase().includes(q) ||
        (i.titular || '').toLowerCase().includes(q) ||
        (i.banco || '').toLowerCase().includes(q)
      );
    }

    // 6. Ordenamiento
    const orden = this.filtroOrden || 'fecha_desc';
    list.sort((a, b) => {
      if (orden === 'fecha_desc') return new Date(b.fecha || 0) - new Date(a.fecha || 0);
      if (orden === 'fecha_asc') return new Date(a.fecha || 0) - new Date(b.fecha || 0);
      if (orden === 'monto_desc') return (Number(b.monto_usdt) || 0) - (Number(a.monto_usdt) || 0);
      if (orden === 'monto_asc') return (Number(a.monto_usdt) || 0) - (Number(b.monto_usdt) || 0);
      return 0;
    });

    return list;
  }
};
