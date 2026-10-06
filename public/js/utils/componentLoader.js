/**
 * @file componentLoader.js
 * @description Inyector paralelo de componentes HTML con soporte Alpine.js.
 */

export async function cargarComponentes() {
  const nodos = Array.from(document.querySelectorAll('[x-include]'));
  if (!nodos.length) return;

  await Promise.all(nodos.map(async (el) => {
    const url = el.getAttribute('x-include');
    if (!url) return;
    try {
      const res = await fetch(url);
      if (res.ok) {
        el.innerHTML = await res.text();
        el.removeAttribute('x-include');
        if (window.Alpine && window.Alpine.initialized) {
          window.Alpine.initTree(el);
        }
      } else {
        console.error(`[componentLoader ❌ 404] No existe la plantilla: ${url}`);
      }
    } catch (err) {
      console.error(`[componentLoader ❌ Error Network] Fallo al pedir ${url}:`, err.message);
    }
  }));
}
