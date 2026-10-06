/**
 * @file formatters.js
 * @description Utilidades de formateo e interfaz dual (Navegador / Node.js).
 */

function aplicarPrecisionMonto(val) {
  if (!val || isNaN(val)) return 0;
  const num = parseFloat(val);
  const signo = num < 0 ? -1 : 1;
  const vRound = Math.round(Math.abs(num) * 1e8) / 1e8;
  return signo * (Math.trunc((vRound + 1e-7) * 100) / 100);
}

function formatMonto(val) {
  const num = aplicarPrecisionMonto(val);
  return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function aplicarReglaPrecisionTasa(val) {
  if (!val || isNaN(val)) return 0;
  const num = Math.abs(parseFloat(val));
  const vRound = Math.round(num * 1e8) / 1e8;
  if (vRound === 0) return 0;
  const signo = parseFloat(val) < 0 ? -1 : 1;
  if (vRound > 99.99) return signo * Math.trunc(vRound);
  if (vRound >= 10.0) return signo * (Math.trunc((vRound + 1e-7) * 100) / 100);
  const factor = Math.pow(10, 2 - Math.floor(Math.log10(vRound)));
  return signo * (Math.trunc((vRound + 1e-7) * factor) / factor);
}

// 🟢 Exportación segura: Browser (window) vs Server (module.exports)
const utilidades = { formatMonto, aplicarPrecisionMonto, aplicarReglaPrecisionTasa };

if (typeof window !== 'undefined') {
  Object.assign(window, utilidades);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = utilidades;
}
