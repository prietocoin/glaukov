/**
 * @file consolidadoSaldosService.js
 * @description Servicio matemático puro para cálculo algebraico de saldos pendientes y movimientos.
 * Aplica filtros de rango de fechas y limites por hash sin tocar directamente el DOM.
 */

/**
 * Calcula la suma algebraica de movimientos filtrados para un socio en específico.
 * @param {Array} comprobantes - Lista completa de comprobantes en memoria.
 * @param {string} socioTarget - Nombre del socio filtrado (o vacío para todos).
 * @returns {number}
 */
export function calcularMovimientoFiltradoTotal(comprobantes = [], socioTarget = '') {
  if (!Array.isArray(comprobantes)) return 0;
  const target = (socioTarget || '').trim().toUpperCase();

  return comprobantes.reduce((sum, item) => {
    const s1 = (item.nombre_socio_1 || item.socio_1 || '').trim().toUpperCase();
    const s2 = (item.nombre_socio_2 || item.socio_2 || '').trim().toUpperCase();

    let val = 0;
    if (target && s2 === target && s1 !== target) {
      val = parseFloat(item.monto_2 ?? item.m2_socio ?? 0) || 0;
    } else {
      val = parseFloat(item.monto_1 ?? item.m1_socio ?? item.monto) || 0;
    }
    return sum + val;
  }, 0);
}

/**
 * Genera el resumen consolidado de socios con saldos pendientes activos.
 * @param {Array} directorio - Lista de socios del directorio.
 * @param {Array} comprobantes - Lista de comprobantes.
 * @param {Object} filtros - Rango de fechas (fechaInicio, fechaFin) y hashes (desdeHash, hastaHash).
 * @returns {Array<{nombre: string, moneda: string, saldoBase: number, movimientoHistorico: number, saldoFinal: number}>}
 */
export function calcularSociosPendientesConsolidado(directorio = [], comprobantes = [], filtros = {}) {
  if (!Array.isArray(directorio)) return [];

  let compFiltrados = Array.isArray(comprobantes) ? [...comprobantes] : [];

  if (filtros.fechaInicio) {
    const fInit = new Date(filtros.fechaInicio + 'T00:00:00').getTime();
    compFiltrados = compFiltrados.filter(c => {
      const t = c.fecha_hora_comprobante ? new Date(c.fecha_hora_comprobante).getTime() : ((c.timestamp || 0) * 1000);
      return t >= fInit;
    });
  }

  if (filtros.fechaFin) {
    const fFin = new Date(filtros.fechaFin + 'T23:59:59').getTime();
    compFiltrados = compFiltrados.filter(c => {
      const t = c.fecha_hora_comprobante ? new Date(c.fecha_hora_comprobante).getTime() : ((c.timestamp || 0) * 1000);
      return t <= fFin;
    });
  }

  if (filtros.desdeHash || filtros.hastaHash) {
    let idxDesde = 0;
    let idxHasta = compFiltrados.length - 1;
    if (filtros.desdeHash) {
      const found = compFiltrados.findIndex(c => c.hash_largo === filtros.desdeHash);
      if (found !== -1) idxDesde = found;
    }
    if (filtros.hastaHash) {
      const found = compFiltrados.findIndex(c => c.hash_largo === filtros.hastaHash);
      if (found !== -1) idxHasta = found;
    }
    const start = Math.min(idxDesde, idxHasta);
    const end = Math.max(idxDesde, idxHasta);
    compFiltrados = compFiltrados.slice(start, end + 1);
  }

  return directorio
    .filter(socio => {
      let mostrarObj = socio.mostrar;
      if (typeof mostrarObj === 'string') {
        try { mostrarObj = JSON.parse(mostrarObj); } catch (e) { mostrarObj = {}; }
      }
      return (mostrarObj?.dashboard ?? true) !== false;
    })
    .map(socio => {
      const nombreUpper = (socio.nombre || '').trim().toUpperCase();
      const saldoBase = parseFloat(socio.saldo_inicial ?? socio.saldo_anterior) || 0;

      const movimientoHistorico = compFiltrados.reduce((acc, item) => {
        const s1 = (item.nombre_socio_1 || item.socio_1 || '').trim().toUpperCase();
        const s2 = (item.nombre_socio_2 || item.socio_2 || '').trim().toUpperCase();

        if (s1 === nombreUpper) {
          return acc + (parseFloat(item.monto_1 ?? item.m1_socio ?? item.monto) || 0);
        } else if (s2 === nombreUpper) {
          return acc + (parseFloat(item.monto_2 ?? item.m2_socio) || 0);
        }
        return acc;
      }, 0);

      const saldoFinal = Math.trunc((saldoBase + movimientoHistorico + 0.0000001) * 100) / 100;

      return {
        nombre: socio.nombre,
        moneda: (socio.moneda_base || socio.moneda_socio || 'USDT').toUpperCase(),
        saldoBase,
        movimientoHistorico,
        saldoFinal
      };
    })
    .filter(s => Math.abs(s.saldoFinal) >= 0.01);
}
