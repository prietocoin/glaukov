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
async function guardarConfigSocio(datos) {
  const { 
    nombre, roles, moneda_socio, saldo_anterior, whatsapp, activo,
    pen, cop, clp, ars, ves, brl, mxn, pyg, dop, crc, eur, cad, usd, ecu, pan, usdt,
    cartelera_paises, ajustes 
  } = datos;

  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre del socio es obligatorio.');
  }

  const socioNombre = nombre.trim();
  const isGeneral = socioNombre.toUpperCase() === 'GENERAL';
  const estadoActivo = isGeneral ? true : (activo ?? true);

  const cpArray = (Array.isArray(cartelera_paises) && cartelera_paises.length > 0) ? cartelera_paises : [];
  const conteoActivos = cpArray.filter(p => p.activo).length;
  const tallaCalculada = calcularTallaAutomatica(conteoActivos);

  const jsonCartelera = JSON.stringify(cpArray);
  const jsonAjustes = JSON.stringify(ajustes || {});
  const valSaldo = parseFloat(saldo_anterior) || 0;

  const checkRes = await db.query(
    `SELECT id_grupo, whatsapp FROM nombres_fb WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($1));`,
    [socioNombre]
  );

  let rows;
  if (checkRes.rows.length > 0) {
    const updateQuery = `
      UPDATE nombres_fb SET
        roles = $1, moneda_socio = $2, talla = $3, whatsapp = $4, activo = $5, saldo_anterior = $6,
        pen = $7, cop = $8, clp = $9, ars = $10, ves = $11, brl = $12, mxn = $13, pyg = $14,
        dop = $15, crc = $16, eur = $17, cad = $18, usd = $19, ecu = $20, pan = $21, usdt = $22,
        cartelera_paises = $23::jsonb, ajustes = $24::jsonb
      WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($25))
      RETURNING *;
    `;
    const updateRes = await db.query(updateQuery, [
      roles || (isGeneral ? 'MATRIZ_GENERAL' : 'SOCIO'), moneda_socio || 'USDT', tallaCalculada, 
      whatsapp || checkRes.rows[0].whatsapp || '', estadoActivo, valSaldo,
      pen || 'D', cop || 'D', clp || 'D', ars || 'D', ves || 'D', brl || 'D', mxn || 'D', pyg || 'D',
      dop || 'D', crc || 'D', eur || 'D', cad || 'D', usd || 'D', ecu || 'D', pan || 'D', usdt || 'A',
      jsonCartelera, jsonAjustes, socioNombre
    ]);
    rows = updateRes.rows;
  } else {
    const idGrupo = whatsapp && whatsapp.trim() ? whatsapp.trim() : ('GRP_' + socioNombre.toUpperCase().replace(/\s+/g, '_'));
    const insertQuery = `
      INSERT INTO nombres_fb (
        id_grupo, nombre, roles, moneda_socio, talla, whatsapp, activo, saldo_anterior,
        pen, cop, clp, ars, ves, brl, mxn, pyg, dop, crc, eur, cad, usd, ecu, pan, usdt,
        cartelera_paises, ajustes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb, $26::jsonb)
      RETURNING *;
    `;
    const insertRes = await db.query(insertQuery, [
      idGrupo, socioNombre, roles || (isGeneral ? 'MATRIZ_GENERAL' : 'SOCIO'), moneda_socio || 'USDT', tallaCalculada, whatsapp || '',
      estadoActivo, valSaldo,
      pen || 'D', cop || 'D', clp || 'D', ars || 'D', ves || 'D', brl || 'D', mxn || 'D', pyg || 'D',
      dop || 'D', crc || 'D', eur || 'D', cad || 'D', usd || 'D', ecu || 'D', pan || 'D', usdt || 'A',
      jsonCartelera, jsonAjustes
    ]);
    rows = insertRes.rows;
  }

  return rows[0];
}

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
