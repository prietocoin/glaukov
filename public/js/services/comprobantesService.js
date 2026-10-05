/**
 * @file comprobantesService.js
 * @description Servicio atómico de auditoría y gestión de comprobantes/liquidaciones.
 * Permite la carga filtrada, preparación para modal de edición, guardado y eliminación.
 */

import { truncarTasaComercial } from '../utils/truncarTasaComercial.js';

/**
 * Consulta la lista de comprobantes aplicando los filtros activos de la UI.
 * @param {Object} params - Objeto de filtros (socio, rol, fechas, hash, orden).
 * @returns {Promise<Array>}
 */
export async function obtenerComprobantes(params = {}) {
  try {
    const res = await window.AteneaAPI.getComprobantes(params);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.error('[comprobantesService ❌ Error al obtener comprobantes]', err);
    return [];
  }
}

/**
 * Mapea y normaliza un objeto de comprobante para vincularlo en el modal de edición.
 * @param {Object} item - Comprobante crudo.
 * @param {string} loteActivo - Lote de tasa vigente para fallback.
 * @returns {Object}
 */
export function prepararEdicionComprobante(item, loteActivo = 'T052') {
  if (!item) return null;

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

  return {
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
    lote_tasa_asignado: item.lote_tasa_asignado || item.lote_tasa || loteActivo,
    fecha_hora_input: dateInput
  };
}

/**
 * Guarda las modificaciones de un comprobante hacia la API backend.
 * @param {string} hashLargo - Identificador único del comprobante.
 * @param {Object} itemEdicion - Datos del formulario editado.
 * @param {string} loteActivo - Lote de tasa por defecto.
 */
export async function guardarCambiosComprobante(hashLargo, itemEdicion, loteActivo = 'T052') {
  if (!hashLargo || !itemEdicion) return false;

  let timestamp = itemEdicion.timestamp;
  if (itemEdicion.fecha_hora_input) {
    const ts = Math.floor(new Date(itemEdicion.fecha_hora_input).getTime() / 1000);
    if (!isNaN(ts) && ts > 0) timestamp = ts;
  }

  const montoEditado = Math.abs(parseFloat(itemEdicion.monto || 0));
  const divisaEditada = (itemEdicion.moneda || 'USDT').toUpperCase();
  const loteSeleccionado = (itemEdicion.lote_tasa_asignado || itemEdicion.lote_tasa || loteActivo).toUpperCase().trim();

  const payload = {
    monto: montoEditado,
    moneda: divisaEditada,
    banco: itemEdicion.banco,
    referencia: itemEdicion.referencia,
    titular: itemEdicion.titular,
    tipo_manual: itemEdicion.tipo_manual || 'P',
    nombre_socio_1: itemEdicion.nombre_socio_1 || 'GENERAL',
    socio_1: itemEdicion.nombre_socio_1 || 'GENERAL',
    nombre_socio_2: itemEdicion.nombre_socio_2 || 'GENERAL',
    socio_2: itemEdicion.nombre_socio_2 || 'GENERAL',
    lote_tasa_asignado: loteSeleccionado,
    lote_tasa: loteSeleccionado,
    id_tasa: loteSeleccionado,
    ...(timestamp ? { timestamp } : {})
  };

  const res = await window.AteneaAPI.actualizarComprobante(hashLargo, payload);
  return Boolean(res && (res.success || res.status === 'SUCCESS'));
}

/**
 * Elimina de forma permanente un comprobante por su hash único.
 * @param {string} hashLargo - Hash del comprobante.
 */
export async function eliminarComprobantePorHash(hashLargo) {
  if (!hashLargo || !confirm('¿Deseas eliminar este comprobante?')) return false;
  try {
    await window.AteneaAPI.eliminarComprobante(hashLargo);
    return true;
  } catch (err) {
    console.error('[comprobantesService ❌ Error al eliminar comprobante]', err);
    return false;
  }
}
