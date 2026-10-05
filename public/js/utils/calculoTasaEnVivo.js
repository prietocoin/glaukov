/**
 * @file calculoTasaEnVivo.js
 * @description Utilidades para cálculo en tiempo real de tasas de cartelera y etiquetado de talla.
 * Calcula valores en vivo con margen/porcentaje y evalúa el tamaño de la tarjeta por cantidad de divisas.
 */

/**
 * Calcula el precio comercial en vivo según tasa base, porcentaje y tipo de operación.
 * @param {number|string} tasaBase - Precio base de la divisa en producción.
 * @param {number|string} porcentaje - Margen comercial en %.
 * @param {boolean} esResta - Si el porcentaje descuenta (pago) o suma (depósito).
 * @returns {string} Tasa formateada para mostrar en el modal.
 */
export function calcularTasaEnVivo(tasaBase, porcentaje, esResta = false) {
  const base = parseFloat(tasaBase) || 1.0;
  const p = parseFloat(porcentaje) || 0;
  const factor = esResta ? (1 - (p / 100)) : (1 + (p / 100));
  const res = base * factor;

  if (res === 0) return '0';
  if (res > 99.99) return Math.trunc(res).toLocaleString('en-US');
  return (Math.trunc(res * 100) / 100).toFixed(2);
}

/**
 * Determina la categoría de talla (S, M, L) según el número de monedas activas del socio.
 * @param {Object} socioObj - Objeto con configuración de monedas del socio.
 * @returns {{label: string, color: string}} Objeto con texto de etiqueta y clases CSS de Tailwind.
 */
export function obtenerClaseTalla(socioObj) {
  let monedasObj = socioObj?.monedas;
  if (typeof monedasObj === 'string') {
    try { monedasObj = JSON.parse(monedasObj); } catch (e) { monedasObj = {}; }
  }
  monedasObj = (typeof monedasObj === 'object' && monedasObj !== null) ? monedasObj : {};

  const count = Object.keys(monedasObj).filter(k => monedasObj[k]?.activo).length || 3;
  if (count <= 3) return { label: `Talla: S [${count}]`, color: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40' };
  if (count <= 6) return { label: `Talla: M [${count}]`, color: 'border-amber-500/40 text-amber-300 bg-amber-950/40' };
  return { label: `Talla: L [${count}]`, color: 'border-purple-500/40 text-purple-300 bg-purple-950/40' };
}
