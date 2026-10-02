const db = require('../../../config/db');

/**
 * Calcula la talla visual (S, M, L) según la cantidad de países activos
 */
function calcularTallaAutomatica(conteo) {
  if (conteo <= 3) return 'S';
  if (conteo <= 6) return 'M';
  return 'L';
}

/**
 * Obtiene el directorio completo de socios ordenado por nombre
 */
async function obtenerDirectorio() {
  const sql = `SELECT * FROM nombres_fb ORDER BY nombre ASC;`;
  const { rows } = await db.query(sql);
  return rows;
}

/**
 * Obtiene la lista simplificada de nombres de socios activos para dropdowns
 * Corregido: Lee exclusivamente de nombres_fb para evitar columnas inexistentes en comprobantes_raw
 */
async function obtenerListaSocios() {
  const sql = `
    SELECT DISTINCT TRIM(nombre) AS nombre 
    FROM nombres_fb 
    WHERE nombre IS NOT NULL 
      AND TRIM(nombre) != '' 
      AND roles IN ('SOCIO', 'MATRIZ_GENERAL', 'ASESOR', 'GRUPO', 'COMPRAS')
    ORDER BY nombre ASC;
  `;
  const { rows } = await db.query(sql);
  return rows.map(r => r.nombre);
}

/**
 * Crea o actualiza la configuración integral de un socio o de la entidad GENERAL
 */
// directorio.service.js

async function guardarSocioConfig(payload) {
  const {
    nombre,
    roles,
    moneda_socio,
    whatsapp,
    saldo_anterior,
    activo,
    mostrar_dashboard,
    ajustes,
    cartelera_paises
  } = payload;

  const nombreClean = String(nombre || '').trim().toUpperCase();

  // Serialización segura previa al envío a la BD
  const ajustesJson = typeof ajustes === 'object' 
    ? JSON.stringify(ajustes) 
    : (ajustes || '{}');
    
  const carteleraJson = Array.isArray(cartelera_paises) || typeof cartelera_paises === 'object'
    ? JSON.stringify(cartelera_paises)
    : (cartelera_paises || '[]');

  const query = `
    UPDATE nombres_fb
    SET 
      roles = $1,
      moneda_socio = $2,
      whatsapp = $3,
      saldo_anterior = $4,
      activo = $5,
      mostrar_dashboard = $6,
      ajustes = $7::jsonb,
      cartelera_paises = $8::jsonb
    WHERE UPPER(TRIM(nombre)) = $9
    RETURNING *;
  `;

  const values = [
    roles || 'SOCIO',
    (moneda_socio || 'USDT').toUpperCase(),
    whatsapp || '',
    parseFloat(saldo_anterior) || 0,
    activo ?? true,
    mostrar_dashboard ?? true,
    ajustesJson,
    carteleraJson,
    nombreClean
  ];

  const { rows } = await db.query(query, values);

  // Si el socio no existía previamente, se inserta la fila inicial
  if (rows.length === 0) {
    const insertQuery = `
      INSERT INTO nombres_fb (
        id_grupo, nombre, roles, moneda_socio, whatsapp, 
        saldo_anterior, activo, mostrar_dashboard, ajustes, cartelera_paises
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
      RETURNING *;
    `;
    const insertValues = [
      whatsapp || `${nombreClean}_JID`,
      nombreClean,
      roles || 'SOCIO',
      (moneda_socio || 'USDT').toUpperCase(),
      whatsapp || '',
      parseFloat(saldo_anterior) || 0,
      activo ?? true,
      mostrar_dashboard ?? true,
      ajustesJson,
      carteleraJson
    ];
    const insertRes = await db.query(insertQuery, insertValues);
    return insertRes.rows[0];
  }

  return rows[0];
}

module.exports = { guardarSocioConfig };

/**
 * Cambia el estado Activo/Inactivo de un socio
 */
async function cambiarEstadoSocio(nombre, activo) {
  const isGeneral = nombre.trim().toUpperCase() === 'GENERAL';
  const estadoActivo = isGeneral ? true : Boolean(activo);

  const { rows } = await db.query(
    `UPDATE nombres_fb SET activo = $1 WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($2)) RETURNING nombre, activo;`,
    [estadoActivo, nombre.trim()]
  );

  if (rows.length === 0) {
    throw new Error('Socio no encontrado.');
  }

  return rows[0];
}

/**
 * Desactiva todos los socios excepto la matriz GENERAL
 */
async function desactivarTodosSocios() {
  await db.query(`UPDATE nombres_fb SET activo = FALSE WHERE UPPER(TRIM(nombre)) != 'GENERAL';`);
  await db.query(`UPDATE nombres_fb SET activo = TRUE WHERE UPPER(TRIM(nombre)) = 'GENERAL';`);
  return { success: true, message: 'Todos los socios desactivados correctamente.' };
}

/**
 * Memoriza la plantilla actual de socios activos
 */
async function guardarSociosVigentes() {
  await db.query(`UPDATE nombres_fb SET recordar_activo = activo;`);
  return { success: true, message: 'Plantilla de socios vigentes memorizada.' };
}

/**
 * Restaura la plantilla previamente memorizada
 */
async function restaurarSociosVigentes() {
  await db.query(`UPDATE nombres_fb SET activo = COALESCE(recordar_activo, FALSE);`);
  await db.query(`UPDATE nombres_fb SET activo = TRUE WHERE UPPER(TRIM(nombre)) = 'GENERAL';`);
  return { success: true, message: 'Socios vigentes restaurados correctamente.' };
}

/**
 * Elimina un socio del directorio (protegiendo GENERAL)
 */
async function eliminarSocio(nombre) {
  if (!nombre) throw new Error('Nombre de socio requerido.');
  if (nombre.trim().toUpperCase() === 'GENERAL') {
    throw new Error('No se puede eliminar la entidad matriz GENERAL.');
  }

  const { rows } = await db.query(
    `DELETE FROM nombres_fb WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($1)) RETURNING *;`,
    [nombre.trim()]
  );

  if (rows.length === 0) throw new Error('Socio no encontrado.');
  return rows[0];
}

module.exports = {
  obtenerDirectorio,
  obtenerListaSocios,
  guardarConfigSocio,
  cambiarEstadoSocio,
  desactivarTodosSocios,
  guardarSociosVigentes,
  restaurarSociosVigentes,
  eliminarSocio
};
