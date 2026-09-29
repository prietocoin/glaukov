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

// 🟢 FUNCIÓN ACTUALIZADA: Soporta compresión JPEG y limpia el Base64 adecuadamente
async function enviarMediaWhatsApp(datos) {
  const { socio, caption, base64 } = datos;

  if (!socio || !socio.trim()) {
    throw new Error('El parámetro socio es requerido.');
  }

  if (!base64) {
    throw new Error('No se proporcionó la imagen en formato Base64.');
  }

  // 1. Consulta SQL en nombres_fb: toma id_grupo si existe, si no usa whatsapp
  const sql = `
    SELECT 
      COALESCE(
        NULLIF(TRIM(id_grupo), ''), 
        NULLIF(TRIM(whatsapp), '')
      ) AS jid
    FROM nombres_fb
    WHERE UPPER(TRIM(nombre)) = UPPER(TRIM($1))
    LIMIT 1;
  `;

  const dbRes = await db.query(sql, [socio.trim()]);
  const row = dbRes.rows?.[0];

  if (!row || !row.jid) {
    throw new Error(`El socio "${socio}" no posee un "id_grupo" ni "whatsapp" configurado en nombres_fb.`);
  }

  const jidDestino = row.jid.trim();

  // 2. Preparar credenciales de Evolution API desde el .env
  const evoUrlBase = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, "");
  const apiKey = process.env.AUTHENTICATION_API_KEY;

  if (!evoUrlBase || !apiKey) {
    throw new Error('EVOLUTION_API_URL o AUTHENTICATION_API_KEY no están configuradas en el .env');
  }

  // 3. Limpiar encabezado del Base64 (soporta PNG, JPEG y JPG)
  const base64Data = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  // 4. Disparo directo a la instancia JAIRO de Evolution API en formato JPEG
  const endpoint = `${evoUrlBase}/message/sendMedia/JAIRO`;

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

async function obtenerFiltrosReportes(rol) {
  const rolesQuery = `
    SELECT DISTINCT UPPER(TRIM(roles)) AS rol 
    FROM nombres_fb 
    WHERE roles IS NOT NULL AND TRIM(roles) != ''
    ORDER BY rol ASC;
  `;

  let nombresQuery = `
    SELECT DISTINCT nombre FROM (
      SELECT nombre_socio_1 AS nombre, n1.roles AS rol FROM cola_fb c LEFT JOIN nombres_fb n1 ON UPPER(TRIM(n1.nombre)) = UPPER(TRIM(c.nombre_socio_1)) WHERE nombre_socio_1 IS NOT NULL AND nombre_socio_1 != ''
      UNION
      SELECT nombre_socio_2 AS nombre, n2.roles AS rol FROM cola_fb c LEFT JOIN nombres_fb n2 ON UPPER(TRIM(n2.nombre)) = UPPER(TRIM(c.nombre_socio_2)) WHERE nombre_socio_2 IS NOT NULL AND nombre_socio_2 != ''
      UNION
      SELECT nombre, roles AS rol FROM nombres_fb WHERE roles IN ('SOCIO', 'MATRIZ_GENERAL', 'ASESOR', 'GRUPO', 'COMPRAS')
    ) s WHERE nombre IS NOT NULL AND TRIM(nombre) != ''
  `;

  const params = [];
  if (rol && rol.trim() && rol.trim().toUpperCase() !== 'TODOS') {
    params.push(rol.trim());
    nombresQuery += ` AND UPPER(TRIM(rol)) = UPPER(TRIM($1))`;
  }

  nombresQuery += ` ORDER BY nombre ASC;`;

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
