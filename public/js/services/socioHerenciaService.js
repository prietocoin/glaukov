/**
 * @file socioHerenciaService.js
 * @description Servicio atómico para conmutar y guardar el estado de herencia de un socio.
 * Prepara el payload completo con los JSONB de 'mostrar' y 'monedas' para evitar sobrescrituras corruptas.
 */

/**
 * Alterna la bandera de herencia de un socio y guarda su configuración.
 * @param {Object} socio - Objeto del socio a modificar.
 * @returns {Promise<boolean>} Estado actualizado de herencia.
 */
export async function alternarHerenciaSocio(socio) {
  if (!socio) return false;

  const nuevaHerencia = !socio.herencia;
  socio.herencia = nuevaHerencia;

  let monedasObj = socio.monedas;
  if (typeof monedasObj === 'string') {
    try { monedasObj = JSON.parse(monedasObj); } catch (e) { monedasObj = {}; }
  }

  let mostrarObj = socio.mostrar;
  if (typeof mostrarObj === 'string') {
    try { mostrarObj = JSON.parse(mostrarObj); } catch (e) { mostrarObj = {}; }
  }

  const payload = {
    nombre: socio.nombre,
    rol: socio.rol || socio.roles || 'SOCIO',
    moneda_base: String(socio.moneda_base || socio.moneda_socio || 'USDT').toUpperCase().trim(),
    id_grupo: socio.id_grupo || socio.whatsapp || '',
    saldo_inicial: parseFloat(socio.saldo_inicial ?? socio.saldo_anterior ?? 0) || 0,
    mostrar: mostrarObj || { tasas: true, dashboard: true },
    monedas: monedasObj || {},
    herencia: Boolean(nuevaHerencia)
  };

  await window.AteneaAPI.guardarSocioConfig(payload);
  return nuevaHerencia;
}
