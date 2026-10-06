/**
 * @file comprobantesQuery.js
 * @description Interrogatio SQL cum pivoto impactorum (i1 et i2) pro Modo LAB.
 */
const db = require('../../../../config/db');

async function obtenerComprobantesCompletos(socio = null) {
  const params = [];
  let whereClause = "WHERE UPPER(TRIM(c.instancia)) = 'JAIRO'";

  if (socio && socio.trim() !== '' && socio !== 'undefined' && socio !== 'null') {
    whereClause += ` AND (
      LOWER(COALESCE(l.socio_1, i1.usuario_raw, '')) LIKE LOWER($1) OR
      LOWER(COALESCE(l.socio_2, i2.usuario_raw, '')) LIKE LOWER($1) OR
      LOWER(COALESCE(c.titular, '')) LIKE LOWER($1)
    )`;
    params.push(`%${socio.trim()}%`);
  }

  const sql = `
    WITH impactos_ordenados AS (
      SELECT 
        hash_largo, hash_corto, url_imagen, usuario_raw, grupo_raw, caption, timestamp_msg,
        ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(hash_largo)) ORDER BY id ASC) AS num_impacto
      FROM impactos_raw
      WHERE UPPER(TRIM(instancia)) = 'JAIRO'
    )
    SELECT 
      c.hash_largo,
      COALESCE(i1.hash_corto, SUBSTRING(c.hash_largo FROM 1 FOR 7)) AS hash_corto,
      COALESCE(c.creado_en, NOW()) AS fecha_hora_comprobante,
      COALESCE(c.monto, 0) AS monto,
      COALESCE(UPPER(c.moneda), 'USDT') AS moneda,
      COALESCE(c.banco, '-') AS banco,
      COALESCE(c.titular, '-') AS titular,
      COALESCE(c.referencia, '-') AS referencia,
      COALESCE(c.procesado_ia, FALSE) AS procesado_ia,
      COALESCE(c.url_r2, i1.url_imagen, '') AS url_imagen,
      (l.hash_largo IS NOT NULL) AS esta_liquidado,
      l.socio_1, l.tipo_op1, l.monto_1, l.tasa_1, l.me1,
      l.socio_2, l.tipo_op2, l.monto_2, l.tasa_2, l.me2, l.lote_tasa,
      COALESCE(l.socio_1, n_grupo1.nombre, n_user1.nombre, 'GENERAL') AS nombre_socio_1,
      COALESCE(l.socio_2, n_grupo2.nombre, n_user2.nombre, NULL) AS nombre_socio_2
    FROM comprobantes_raw c
    LEFT JOIN comprobantes_liq l ON LOWER(TRIM(l.hash_largo)) = LOWER(TRIM(c.hash_largo))
    LEFT JOIN impactos_ordenados i1 ON LOWER(TRIM(i1.hash_largo)) = LOWER(TRIM(c.hash_largo)) AND i1.num_impacto = 1
    LEFT JOIN impactos_ordenados i2 ON LOWER(TRIM(i2.hash_largo)) = LOWER(TRIM(c.hash_largo)) AND i2.num_impacto = 2
    LEFT JOIN perfiles_glaukov n_grupo1 ON i1.grupo_raw IS NOT NULL AND LOWER(TRIM(n_grupo1.id_grupo)) = LOWER(TRIM(i1.grupo_raw))
    LEFT JOIN perfiles_glaukov n_user1 ON i1.usuario_raw IS NOT NULL AND LOWER(TRIM(n_user1.id_grupo)) = LOWER(TRIM(i1.usuario_raw))
    LEFT JOIN perfiles_glaukov n_grupo2 ON i2.grupo_raw IS NOT NULL AND LOWER(TRIM(n_grupo2.id_grupo)) = LOWER(TRIM(i2.grupo_raw))
    LEFT JOIN perfiles_glaukov n_user2 ON i2.usuario_raw IS NOT NULL AND LOWER(TRIM(n_user2.id_grupo)) = LOWER(TRIM(i2.usuario_raw))
    ${whereClause}
    ORDER BY c.creado_en DESC
    LIMIT 50;
  `;

  const { rows } = await db.query(sql, params);
  return rows || [];
}

module.exports = { obtenerComprobantesCompletos };
