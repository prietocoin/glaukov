/**
 * @file componentLoader.js
 * @description Inyector de HTML con re-hidratación explícita para Alpine.js.
 */

export async function cargarComponentes() {
  const nodos = document.querySelectorAll('[x-include]');
  for (const el of nodos) {
    const url = el.getAttribute('x-include');
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (res.ok) {
        el.innerHTML = await res.text();
        el.removeAttribute('x-include');
        
        // 🟢 CLAVE: Obliga a Alpine a procesar las directivas (x-show, x-text) del HTML inyectado
        if (window.Alpine) {
          window.Alpine.initTree(el);
        }
      } else {
        console.warn(`[componentLoader ⚠️] No se pudo cargar: ${url}`);
      }
    } catch (err) {
      console.error(`[componentLoader ❌] Error cargando ${url}:`, err);
    }
  }
}
