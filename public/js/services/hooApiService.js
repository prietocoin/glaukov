/**
 * @file hooApiService.js
 * @description Cliente atómico para capturar borradores de tasas enviados por n8n / Hoo API.
 * Normaliza automáticamente todas las claves de divisas a MAYÚSCULAS.
 */

/**
 * Conecta con la API de Hoo y retorna el borrador de cotizaciones listo para publicar.
 * @returns {Promise<Object|null>} Objeto de tasas normalizado o null si falla.
 */
export async function capturarBorradorHoo() {
  try {
    const res = await window.AteneaAPI.fetchHoo();
    if (!res || (!res.rates && !res.rates_draft)) {
      alert('No hay un borrador reciente enviado por n8n / Hoo API.');
      return null;
    }

    const rawRates = res.rates || res.rates_draft;
    const ratesNormalizadas = {};

    Object.keys(rawRates).forEach(k => {
      ratesNormalizadas[k.toUpperCase().trim()] = rawRates[k];
    });

    alert('✅ Borrador capturado e inyectado con éxito.');
    return ratesNormalizadas;
  } catch (err) {
    console.error('[hooApiService ❌]', err);
    alert('Error conectando con la API de Hoo: ' + err.message);
    return null;
  }
}
