/**
 * Trunca la tasa según las reglas de precisión del sistema
 */
function truncarTasaOficial(valor, ancho = 0) {
  const num = parseFloat(valor);
  let formateado = "-";

  if (!isNaN(num) && num > 0) {
    let puntoCorte = (num >= 100) ? 0 : (num >= 1) ? 2 : (-Math.floor(Math.log10(num)) + 2);
    const mult = Math.pow(10, puntoCorte);
    const truncado = Math.trunc(Math.round(num * mult * 1e9) / 1e9) / mult;
    formateado = (puntoCorte === 0) ? Math.trunc(truncado).toString() : truncado.toFixed(puntoCorte).replace(/\.?0+$/, "");
  } else if (num === 0) {
    formateado = "0";
  }
  
  if (ancho === 0) return formateado.toString();
  
  const espacios = Math.max(0, ancho - formateado.length);
  const izq = Math.floor(espacios / 2);
  return (" ".repeat(izq) + formateado + " ".repeat(espacios - izq)).toString();
}

/**
 * Obtiene fecha y hora formateadas en zona horaria de Caracas (America/Caracas)
 */
function obtenerFechaHoraVE() {
  const ahora = new Date();
  let fechaStr = "";
  let horaStr = "";
  try {
    fechaStr = ahora.toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' });
    horaStr = ahora.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch (err) {
    fechaStr = ahora.toLocaleDateString();
    horaStr = ahora.toLocaleTimeString();
  }
  return { fechaStr, horaStr };
}

/**
 * Normaliza y extrae un identificador JID de WhatsApp
 */
const extractJid = (val) => {
  if (!val) return "";
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) {
        return String(parsed.id || parsed.jid || parsed.value || parsed.chatId || Object.values(parsed)[0] || "");
      }
    } catch(e) {
      return val;
    }
    return val;
  }
  if (typeof val === 'object' && val !== null) {
    return String(val.id || val.jid || val.value || val.chatId || Object.values(val)[0] || "");
  }
  return String(val);
};

module.exports = {
  truncarTasaOficial,
  obtenerFechaHoraVE,
  extractJid
};
