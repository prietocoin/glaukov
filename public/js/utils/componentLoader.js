/**
 * @file componentLoader.js
 * @description Inyector de HTML con re-hidratación automática para Alpine.js v3.
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
        console.log(`[componentLoader ✅] Cargado e inyectado: ${url}`);

        // 🟢 Re-hidrata las directivas x-show / x-text de Alpine en el nodo inyectado
        if (window.Alpine) {
          window.Alpine.initTree(el);
        }
      } else {
        console.error(`[componentLoader ❌ HTTP ${res.status}] Fallo en: ${url}`);
      }
    } catch (err) {
      console.error(`[componentLoader ❌ Error Red] ${url}:`, err.message);
    }
  }
}
