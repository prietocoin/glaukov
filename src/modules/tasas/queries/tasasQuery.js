/**
 * @file tasasQuery.js
 * @description Consultas SQL puras a la tabla 'tasas_glaukov'.
 * Obtiene lotes específicos por ID o los 2 últimos registros históricos.
 */

const db = require('../../../config/db');

/**
 * Consulta en PostgreSQL el lote actual y el lote anterior para comparación.
 * @param {string|null} idTasaRequerida - ID del lote específico (ej. 'T052').
 * @returns {Promise<{loteActual: Object, loteAnterior: Object}>}
 */
async function obtenerLotesTasas(idTasaRequerida = null) {
  let loteActual = null;
  let loteAnterior = null;

  if (idTasaRequerida) {
    const sqlEspecífica = `SELECT id_tasa, tasas, created_at FROM tasas_glaukov WHERE id_tasa = $1 LIMIT 1;`;
    const res = await db.query(sqlEspecífica, [idTasaRequerida]);
    if (res.rows.length > 0) {
      loteActual = res.rows[0];
      loteAnterior = loteActual;
    }
  }

  if (!loteActual) {
    const sqlRecientes = `SELECT id_tasa, tasas, created_at FROM tasas_glaukov ORDER BY created_at DESC, id DESC LIMIT 2;`;
    const res = await db.query(sqlRecientes);
    loteActual = res.rows[0] || { id_tasa: 'T001', tasas: {} };
    loteAnterior = res.rows[1] || loteActual;
  }

  return { loteActual, loteAnterior };
}

module.exports = { obtenerLotesTasas };
