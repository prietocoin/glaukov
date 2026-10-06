/**
 * @file comprobantesQueries.js
 * @description Consultas SQL aisladas y seguras para comprobantes.
 */

const db = require('../../../config/db');

async function buscarComprobantes(socio) {
  const esSocioValido = socio && socio !== 'undefined' && socio !== 'null' && socio.trim() !== '';
  let sql = `SELECT * FROM comprobantes`;
  const params = [];

  if (esSocioValido) {
    sql += ` WHERE (
      LOWER(COALESCE(nombre_socio_1, '')) LIKE LOWER($1) OR 
      LOWER(COALESCE(nombre_socio_2, '')) LIKE LOWER($1) OR 
      LOWER(COALESCE(socio_1, '')) LIKE LOWER($1) OR 
      LOWER(COALESCE(socio_2, '')) LIKE LOWER($1) OR 
      LOWER(COALESCE(titular, '')) LIKE LOWER($1)
    )`;
    params.push(`%${socio.trim()}%`);
  }
  sql += ` ORDER BY 1 DESC LIMIT 50;`;

  try {
    const { rows } = await db.query(sql, params);
    return rows || [];
  } catch {
    const { rows } = await db.query(`SELECT * FROM comprobantes LIMIT 50;`);
    return rows || [];
  }
}

async function actualizarEstado(hashLargo, estado) {
  return db.query(`UPDATE comprobantes SET estado = $1 WHERE hash_largo = $2;`, [estado, hashLargo]);
}

async function borrarPorHash(hashLargo) {
  return db.query(`DELETE FROM comprobantes WHERE hash_largo = $1;`, [hashLargo]);
}

module.exports = { buscarComprobantes, actualizarEstado, borrarPorHash };
