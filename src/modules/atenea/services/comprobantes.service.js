const db = require('../../../config/db');
const { aplicarReglaPrecisionTasa, aplicarPrecisionMonto } = require('../../../utils/formatters');

/**
 * Consulta de comprobantes unificando comprobantes_raw e impactos_raw con LATERAL JOINs
 * Garantiza exactamente 1 fila por comprobante sin generar duplicados.
 */
async function obtenerComprobantesAuditados(filtros = {}) {
  const { socio, rol, fechaInicio, fechaFin, hash, orden = 'fecha_desc' } = filtros;
  const targetSocio = (socio || '').trim();

  // 1. Filtros base sobre comprobantes_raw
  let whereClauses = [`UPPER(TRIM(c.instancia)) = 'JAIRO'`];
  const values = [];
  let paramIndex = 1;

  if (hash && hash.trim()) {
    whereClauses.push(`(c.hash_largo ILIKE $${paramIndex} OR c.referencia ILIKE $${paramIndex})`);
    values.push(`%${hash.trim()}%`);
    paramIndex++;
  }

  if (fechaInicio && fechaInicio.trim()) {
    whereClauses.push(`c.creado_en >= $${paramIndex}::timestamp`);
    values.push(`${fechaInicio.trim()} 00:00:00`);
    paramIndex++;
  }

  if (fechaFin && fechaFin.trim()) {
    whereClauses.push(`c.creado_en <= $${paramIndex}::timestamp`);
    values.push(`${fechaFin.trim()} 23:59:59`);
    paramIndex++;
  }

  const whereSql = whereClauses.join(' AND ');
  const orderDirection = orden === 'fecha_asc' ? 'ASC' : 'DESC';

  // 2. Consulta optimizada usando LATERAL JOINs con LIMIT 1 para evitar filas duplicadas
  const sqlBase = `
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

      COALESCE(n_grupo.nombre, n_user.nombre, n_titular.nombre, 'GENERAL') AS nombre_socio_1,
      CASE 
        WHEN UPPER(TRIM(COALESCE(n_grupo.moneda_socio, n_user.moneda_socio, n_titular.moneda_socio, 'USDT'))) = 'USD' THEN 'USDT'
        ELSE UPPER(TRIM(COALESCE(n_grupo.moneda_socio, n_user.moneda_socio, n_titular.moneda_socio, 'USDT')))
      END AS moneda_socio_1,
      COALESCE(n_grupo.roles, n_user.roles, n_titular.roles, 'SOCIO') AS rol_socio_1,
      COALESCE(n_grupo.ajustes, n_user.ajustes, n_titular.ajustes) AS ajustes_socio_1

    FROM comprobantes_raw c

    LEFT JOIN LATERAL (
      SELECT hash_corto, url_imagen, usuario_raw, grupo_raw, nombre_push, caption
      FROM impactos_raw
      WHERE LOWER(TRIM(hash_largo)) = LOWER(TRIM(c.hash_largo))
        AND UPPER(TRIM(instancia)) = 'JAIRO'
      LIMIT 1
    ) i ON TRUE

    LEFT JOIN LATERAL (
      SELECT nombre, moneda_socio, roles, ajustes
      FROM nombres_fb
      WHERE i.grupo_raw IS NOT NULL AND TRIM(i.grupo_raw) != ''
        AND (LOWER(TRIM(whatsapp)) = LOWER(TRIM(i.grupo_raw)) OR LOWER(TRIM(id_grupo)) = LOWER(TRIM(i.grupo_raw)))
      LIMIT 1
    ) n_grupo ON TRUE

    LEFT JOIN LATERAL (
      SELECT nombre, moneda_socio, roles, ajustes
      FROM nombres_fb
      WHERE i.usuario_raw IS NOT NULL AND TRIM(i.usuario_raw) != ''
        AND LOWER(TRIM(whatsapp)) = LOWER(TRIM(i.usuario_raw))
      LIMIT 1
    ) n_user ON TRUE

    LEFT JOIN LATERAL (
      SELECT nombre, moneda_socio, roles, ajustes
      FROM nombres_fb
      WHERE c.titular IS NOT NULL 
        AND LENGTH(TRIM(c.titular)) > 2 
        AND c.titular != '-'
        AND LENGTH(TRIM(nombre)) > 2
        AND UPPER(TRIM(c.titular)) ILIKE '%' || UPPER(TRIM(nombre)) || '%'
      LIMIT 1
    ) n_titular ON TRUE

    WHERE ${whereSql}
  `;

  let queryFinal = `
    WITH datos AS (${sqlBase})
    SELECT * FROM datos
    WHERE 1=1
  `;

  if (rol && rol.trim() && rol.trim().toUpperCase() !== 'TODOS') {
    queryFinal += ` AND UPPER(TRIM(rol_socio_1)) = UPPER(TRIM($${paramIndex}))`;
    values.push(rol.trim());
    paramIndex++;
  }

  if (targetSocio && targetSocio.toUpperCase() !== 'TODOS') {
    queryFinal += ` AND UPPER(TRIM(nombre_socio_1)) = UPPER(TRIM($${paramIndex}))`;
    values.push(targetSocio);
    paramIndex++;
  }

  queryFinal += ` ORDER BY creado_en ${orderDirection} LIMIT 100;`;

  try {
    const { rows } = await db.query(queryFinal, values);

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
  } catch (error) {
    console.error('[Atenea Service ❌] Error SQL:', error);
    throw error;
  }
}

async function actualizarComprobante(hashLargo, datos) { return { success: true }; }
async function eliminarComprobante(hashLargo) { return { success: true }; }

module.exports = {
  obtenerComprobantesAuditados,
  actualizarComprobante,
  eliminarComprobante
};
