const db = require('../../../config/db');

async function enviarReporteWhatsApp(datos) {
  const { socio, remoteJid, saldoAnterior, movimiento, nuevoSaldo, moneda, comprobantes } = datos;

  if (!remoteJid || !remoteJid.trim()) {
    throw new Error('El socio no posee un JID válido en el Directorio.');
  }

  const N8N_WEBHOOK_URL = process.env.N8N_REPORTES_WEBHOOK || 'https://nochon.jairokov.com/webhook/reportes-whatsapp';

  const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      socio,
      remoteJid,
      saldoAnterior,
      movimiento,
      nuevoSaldo,
      moneda,
      comprobantes,
      fechaEnvio: new Date().toISOString()
    })
  });

  if (!n8nResponse.ok) {
    throw new Error(`n8n respondió con estatus HTTP ${n8nResponse.status}`);
  }

  return { success: true, remoteJid };
}

async function enviarMediaWhatsApp(datos) {
  const { socio, caption, base64 } = datos;

  if (!socio || !socio.trim()) {
    throw new Error('El parámetro socio es requerido.');
  }

  if (!base64) {
    throw new Error('No se proporcionó la imagen en formato Base64.');
  }

  // 🟢 1. Consulta SQL limpia en perfiles_glaukov: toma id_grupo
  const sql = `
    SELECT NULLIF(TRIM(id_grupo), '') AS jid
    FROM perfiles_glaukov
    WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($1))
    LIMIT 1;
  `;

  const dbRes = await db.query(sql, [socio.trim()]);
  const row = dbRes.rows?.[0];

  if (!row || !row.jid) {
    throw new Error(`El socio "${socio}" no posee un "id_grupo" configurado en perfiles_glaukov.`);
  }

  const jidDestino = row.jid.trim();

  // 2. Preparar credenciales de Evolution API desde el .env
  const evoUrlBase = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, "");
  const apiKey = process.env.AUTHENTICATION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE || 'Jairo';

  if (!evoUrlBase || !apiKey) {
    throw new Error('EVOLUTION_API_URL o AUTHENTICATION_API_KEY no están configuradas en el .env');
  }

  // 3. Limpiar encabezado del Base64
  const base64Data = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  // 4. Disparo a la instancia exacta 'Jairo'
  const endpoint = `${evoUrlBase}/message/sendMedia/${instance}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      number: jidDestino,
      mediatype: "image",
      mimetype: "image/jpeg",
      caption: caption || '',
      media: base64Data
    })
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`Evolution API respondió con error HTTP ${response.status}: ${JSON.stringify(responseData)}`);
  }

  return { success: true, jid: jidDestino, data: responseData };
}

async function obtenerFiltrosReportes(rolParam) {
  // 🟢 Buscar los roles existentes en la nueva tabla (Columna 'rol' singular)
  const rolesQuery = `
    SELECT DISTINCT UPPER(TRIM(rol)) AS rol 
    FROM perfiles_glaukov 
    WHERE rol IS NOT NULL AND TRIM(rol) != ''
    ORDER BY rol ASC;
  `;

  // 🟢 Armar la consulta de nombres basada en perfiles_glaukov cruzada con cola_fb
  let nombresQuery = `
    SELECT DISTINCT nombre FROM (
      SELECT nombre_socio_1 AS nombre, n1.rol AS rol 
      FROM cola_fb c 
      LEFT JOIN perfiles_glaukov n1 ON UPPER(TRIM(n1.nombre)) = UPPER(TRIM(c.nombre_socio_1)) 
      WHERE nombre_socio_1 IS NOT NULL AND nombre_socio_1 != ''
      UNION
      SELECT nombre_socio_2 AS nombre, n2.rol AS rol 
      FROM cola_fb c 
      LEFT JOIN perfiles_glaukov n2 ON UPPER(TRIM(n2.nombre)) = UPPER(TRIM(c.nombre_socio_2)) 
      WHERE nombre_socio_2 IS NOT NULL AND nombre_socio_2 != ''
      UNION
      SELECT nombre, rol 
      FROM perfiles_glaukov 
      WHERE rol IN ('SOCIO', 'MATRIZ_GENERAL', 'ASESOR', 'GRUPO', 'COMPRAS')
    ) s 
    WHERE nombre IS NOT NULL AND TRIM(nombre) != ''
  `;

  const params = [];
  if (rolParam && rolParam.trim() && rolParam.trim().toUpperCase() !== 'TODOS') {
    params.push(rolParam.trim());
    nombresQuery += ` AND UPPER(TRIM(rol)) = UPPER(TRIM($1))`;
  }

  nombresQuery += ` ORDER BY nombre ASC;`;

  // Consulta inalterada a los comprobantes
  const hashesQuery = `
    SELECT DISTINCT hash_corto AS hash
    FROM comprobantes_auditados_fb
    WHERE hash_corto IS NOT NULL AND hash_corto != ''
    ORDER BY hash_corto ASC
    LIMIT 100;
  `;

  const [rolesRes, nombresRes, hashesRes] = await Promise.all([
    db.query(rolesQuery),
    db.query(nombresQuery, params),
    db.query(hashesQuery)
  ]);

  return {
    roles: rolesRes.rows.map(r => r.rol),
    entidades: nombresRes.rows.map(r => r.nombre),
    hashes: hashesRes.rows.map(r => r.hash)
  };
}

module.exports = {
  enviarReporteWhatsApp,
  enviarMediaWhatsApp,
  obtenerFiltrosReportes
};
