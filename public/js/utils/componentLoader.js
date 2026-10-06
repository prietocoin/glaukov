/**
 * @file componentLoader.js
 * @description Descarga e inyección atómica de HTML sin bloqueos de tiempo.
 */

export async function cargarComponentes() {
  let nodos = document.querySelectorAll('[x-include]');
  while (nodos.length > 0) {
    await Promise.all(
      Array.from(nodos).map(async (el) => {
        const url = el.getAttribute('x-include');
        el.removeAttribute('x-include');
        if (!url) return;
        try {
          const res = await fetch(url);
          if (res.ok) {
            el.innerHTML = await res.text();
          } else {
            console.error(`[componentLoader ❌] 404 en ${url}`);
          }
        } catch (err) {
          console.error(`[componentLoader ❌] Error al cargar ${url}:`, err.message);
        }
      })
    );
    nodos = document.querySelectorAll('[x-include]');
  }
}
