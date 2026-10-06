/**
 * @file componentLoader.js
 * @description Inyector secuencial con trazabilidad para la directiva x-include.
 */

export async function cargarComponentes() {
  const elementos = Array.from(document.querySelectorAll('[x-include]'));
  console.log(`[componentLoader 🔍] Encontrados ${elementos.length} elementos x-include.`);

  for (const el of elementos) {
    const url = el.getAttribute('x-include');
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (res.ok) {
        el.innerHTML = await res.text();
        el.removeAttribute('x-include');
        console.log(`[componentLoader ✅] Cargado: ${url}`);
      } else {
        console.error(`[componentLoader ❌ HTTP ${res.status}] Fallo en: ${url}`);
      }
    } catch (err) {
      console.error(`[componentLoader ❌ Error Red] ${url}:`, err.message);
    }
  }
}
