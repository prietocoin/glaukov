/**
 * Regla exclusiva de truncado estricto para Tasas
 */
function aplicarReglaPrecisionTasa(val) {
  if (val === null || val === undefined || isNaN(val) || val === 0) return 0;
  const num = parseFloat(val);
  if (num === 0) return 0;

  const signo = num < 0 ? -1 : 1;
  const v = Math.abs(num);
  const vRound = Math.round(v * 1e8) / 1e8;

  let res = 0;
  if (vRound > 99.99) {
    res = Math.trunc(vRound);
  } else if (vRound >= 10.0) {
    res = Math.trunc((vRound + 0.0000001) * 100) / 100;
  } else {
    const magnitud = Math.floor(Math.log10(vRound));
    const factor = Math.pow(10, 2 - magnitud);
    res = Math.trunc((vRound + 0.0000001) * factor) / factor;
  }

  return signo * res;
}

/**
 * Regla exclusiva para Montos (Conserva exactamente 2 decimales)
 */
function aplicarPrecisionMonto(val) {
  if (val === null || val === undefined || isNaN(val) || val === 0) return 0;
  const num = parseFloat(val);
  if (num === 0) return 0;

  const signo = num < 0 ? -1 : 1;
  const v = Math.abs(num);
  const vRound = Math.round(v * 1e8) / 1e8;

  return signo * (Math.trunc((vRound + 0.0000001) * 100) / 100);
}

/**
 * Convierte un valor de tasa a su representación en string truncada
 */
function truncarTasaOficial(val) {
  const num = aplicarReglaPrecisionTasa(val);
  if (num === 0) return "0";
  
  const absNum = Math.abs(num);
  if (absNum > 99.99) {
    return num.toLocaleString('en-US');
  }
  return num.toString();
}

/**
 * Obtener Fecha y Hora formateadas en zona horaria de Venezuela (GMT-4)
 */
function obtenerFechaHoraVE() {
  const ahora = new Date();
  const opcionesFecha = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' };
  const opcionesHora = { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

  const fechaStr = ahora.toLocaleDateString('es-VE', opcionesFecha);
  const horaStr = ahora.toLocaleTimeString('es-VE', opcionesHora);

  return { fechaStr, horaStr, timestamp: Math.floor(ahora.getTime() / 1000) };
}

/**
 * Normaliza números de teléfono o IDs a formato WhatsApp Remote JID
 */
function extractJid(rawInput) {
  if (!rawInput) return null;
  const str = String(rawInput).trim();
  if (!str) return null;

  if (str.includes('@g.us') || str.includes('@s.whatsapp.net')) {
    return str;
  }

  const limpio = str.replace(/\D/g, '');
  if (!limpio) return null;

  return `${limpio}@s.whatsapp.net`;
}

module.exports = {
  aplicarReglaPrecisionTasa,
  aplicarPrecisionMonto,
  truncarTasaOficial,
  obtenerFechaHoraVE,
  extractJid
};
