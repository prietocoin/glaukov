/**
 * @file componentLoader.js
 * @description Inyector paralelo de plantillas con hidratación directa en Alpine v3.
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

        // 🟢 Se elimina '.initialized' (inexistente en Alpine v3).
        // Se fuerza la hidratación inmediata del nodo inyectado.
        if (window.Alpine) {
          window.Alpine.initTree(el);
        }
      } else {
        console.error(`[componentLoader ❌ 404] No existe: ${url}`);
      }
    } catch (err) {
      console.error(`[componentLoader ❌ Error Red] ${url}:`, err.message);
    }
  }));
}
