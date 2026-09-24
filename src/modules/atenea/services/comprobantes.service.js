const db = require('../../../config/db');
const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Consulta unificada uniendo comprobantes_raw con impactos_raw e identificando
 * al socio por su ID de WhatsApp / Grupo en nombres_fb.
 */
async function obtenerComprobantesAuditados(filtros = {}) {
  const { socio, rol, fechaInicio, fechaFin, hash, orden = 'fecha_desc' } = filtros;
  const targetSocio = (socio || '').trim();

  let sql = `
    SELECT 
      c.hash_largo,
      COALESCE(i.hash_corto, SUBSTRING(c.hash_largo FROM 1 FOR 7)) AS hash_corto,
      c.creado_en,
      COALESCE(c.monto, 0) AS monto,
      COALESCE(UPPER(c.moneda), 'USDT') AS moneda,
      COALESCE(c.banco, '-') AS banco,
      COALESCE(c.titular, '-') AS titular,
      COALESCE(c.referencia, '-') AS referencia,
      COALESCE(c.procesado_ia, FALSE) AS procesado_ia,
      COALESCE(c.url_r2, i.url_imagen, '') AS url_imagen,
      i.usuario_raw,
      i.grupo_raw,
      i.nombre_push,
      i.caption,

      -- Identificación precisa del socio cruzando origen de WhatsApp con nombres_fb
      COALESCE(n_grupo.nombre, n_user.nombre, n_titular.nombre, 'GENERAL') AS nombre_socio_1,
      CASE 
        WHEN UPPER(TRIM(COALESCE(n_grupo.moneda_socio, n_user.moneda_socio, n_titular.moneda_socio, 'USDT'))) = 'USD' THEN 'USDT'
        ELSE UPPER(TRIM(COALESCE(n_grupo.moneda_socio, n_user.moneda_socio, n_titular.moneda_socio, 'USDT')))
      END AS moneda_socio_1,
      COALESCE(n_grupo.roles, n_user.roles, n_titular.roles, 'SOCIO') AS rol_socio_1,
      COALESCE(n_grupo.ajustes, n_user.ajustes, n_titular.ajustes) AS ajustes_socio_1

    FROM comprobantes_raw c
    LEFT JOIN impactos_raw i 
      ON LOWER(TRIM(c.hash_largo)) = LOWER(TRIM(i.hash_largo)) 
     AND UPPER(TRIM(i.instancia)) = 'JAIRO'
    LEFT JOIN nombres_fb n_grupo 
      ON LOWER(TRIM(n_grupo.whatsapp)) = LOWER(TRIM(i.grupo_raw)) OR LOWER(TRIM(n_grupo.id_grupo)) = LOWER(TRIM(i.grupo_raw))
    LEFT JOIN nombres_fb n_user 
      ON LOWER(TRIM(n_user.whatsapp)) = LOWER(TRIM(i.usuario_raw))
    LEFT JOIN nombres_fb n_titular 
      ON UPPER(TRIM(c.titular)) ILIKE '%' || UPPER(TRIM(n_titular.nombre)) || '%'

    WHERE UPPER(TRIM(c.instancia)) = 'JAIRO'
  `;

  const values = [];
  let paramIndex = 1;

  if (rol && rol.trim() && rol.trim().toUpperCase() !== 'TODOS') {
    sql += ` AND (
      UPPER(TRIM(n_grupo.roles)) = UPPER(TRIM($${paramIndex})) OR 
      UPPER(TRIM(n_user.roles)) = UPPER(TRIM($${paramIndex})) OR 
      UPPER(TRIM(n_titular.roles)) = UPPER(TRIM($${paramIndex}))
    )`;
    values.push(rol.trim());
    paramIndex++;
  }

  if (targetSocio && targetSocio.toUpperCase() !== 'TODOS') {
    sql += ` AND (
      UPPER(TRIM(n_grupo.nombre)) = UPPER(TRIM($${paramIndex})) OR 
      UPPER(TRIM(n_user.nombre)) = UPPER(TRIM($${paramIndex})) OR 
      UPPER(TRIM(n_titular.nombre)) = UPPER(TRIM($${paramIndex}))
    )`;
    values.push(targetSocio);
    paramIndex++;
  }

  if (hash && hash.trim()) {
    sql += ` AND (c.hash_largo ILIKE $${paramIndex} OR i.hash_corto ILIKE $${paramIndex} OR c.referencia ILIKE $${paramIndex})`;
    values.push(`%${hash.trim()}%`);
    paramIndex++;
  }

  if (fechaInicio && fechaInicio.trim()) {
    sql += ` AND c.creado_en >= $${paramIndex}::timestamp`;
    values.push(`${fechaInicio.trim()} 00:00:00`);
    paramIndex++;
  }

  if (fechaFin && fechaFin.trim()) {
    sql += ` AND c.creado_en <= $${paramIndex}::timestamp`;
    values.push(`${fechaFin.trim()} 23:59:59`);
    paramIndex++;
  }

  sql += (orden === 'fecha_asc') ? ` ORDER BY c.creado_en ASC LIMIT 100;` : ` ORDER BY c.creado_en DESC LIMIT 100;`;

  const { rows } = await db.query(sql, values);

  return rows.map(r => {
    const monto = aplicarPrecisionMonto(r.monto);
    const monOrig = r.moneda;
    const aj = typeof r.ajustes_socio_1 === 'string' ? JSON.parse(r.ajustes_socio_1 || '{}') : (r.ajustes_socio_1 || {});
    
    const factor = parseFloat(aj[`D-${monOrig}`]) || 1.0;
    const tasa = aplicarReglaPrecisionTasa(factor);
    const mSocio = aplicarPrecisionMonto(tasa > 0 ? (monto / tasa) : monto);

    return {
      hash_largo: r.hash_largo,
      hash_corto: r.hash_corto,
      fecha_hora_comprobante: r.creado_en,
      monto,
      moneda: r.moneda,
      banco: r.banco,
      titular: r.titular,
      referencia: r.referencia,
      url_imagen: r.url_imagen,
      procesado_ia: r.procesado_ia,
      caption: r.caption,
      nombre_socio_1: r.nombre_socio_1,
      nombre_socio_2: null,
      tasa_1: tasa,
      tasa_2: 0,
      m1_socio: mSocio,
      m1_usdt: mSocio,
      tipo_op_socio: 'D',
      etiqueta_hash: `[D-${r.hash_corto}]`
    };
  });
}

async function actualizarComprobante(hashLargo, datos) { return { success: true }; }
async function eliminarComprobante(hashLargo) { return { success: true }; }

module.exports = {
  obtenerComprobantesAuditados,
  actualizarComprobante,
  eliminarComprobante
};
