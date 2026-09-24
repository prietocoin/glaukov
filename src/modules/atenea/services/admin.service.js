const db = require('../../../config/db');

function validarAdminKey(claveAdmin) {
  return claveAdmin === 'ATENEA';
}

async function obtenerColaAdmin(claveAdmin) {
  if (!validarAdminKey(claveAdmin)) {
    throw new Error('Clave de administración inválida.');
  }

  const { rows } = await db.query(`
    SELECT hash_largo, hash_corto, timestamp, nombre_socio_1, nombre_socio_2, conteo, estado, url_imagen
    FROM cola_fb
    ORDER BY timestamp DESC
    LIMIT 100;
  `);
  return rows;
}

async function actualizarItemColaAdmin(hash_largo, datos) {
  const { adminKey, nombre_socio_1, nombre_socio_2, estado, conteo, timestamp } = datos;
  if (!validarAdminKey(adminKey)) {
    throw new Error('Clave de administración inválida.');
  }

  await db.query(`
    UPDATE cola_fb
    SET nombre_socio_1 = $1,
        nombre_socio_2 = $2,
        estado = COALESCE($3, estado),
        conteo = COALESCE($4, conteo),
        timestamp = COALESCE($5, timestamp)
    WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($6));
  `, [
    nombre_socio_1 || null, 
    nombre_socio_2 || null, 
    estado || 'PROCESADO', 
    conteo || 1, 
    timestamp ? parseInt(timestamp) : null,
    hash_largo
  ]);

  return { success: true };
}

async function eliminarItemColaAdmin(hash_largo, adminKey) {
  if (!validarAdminKey(adminKey)) {
    throw new Error('Clave de administración inválida.');
  }

  const targetHash = hash_largo.trim();

  await db.query(`DELETE FROM comprobantes_fb WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($1));`, [targetHash]);
  await db.query(`DELETE FROM comprobantes_auditados_fb WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($1));`, [targetHash]);
  await db.query(`DELETE FROM cola_fb WHERE TRIM(LOWER(hash_largo)) = TRIM(LOWER($1));`, [targetHash]);

  return { success: true };
}

module.exports = {
  obtenerColaAdmin,
  actualizarItemColaAdmin,
  eliminarItemColaAdmin
};
