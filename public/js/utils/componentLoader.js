/**
 * @file componentLoader.js
 * @description Inyector puro de plantillas HTML.
 */

export async function cargarComponentes() {
  let nodos = Array.from(document.querySelectorAll('[x-include]'));
  while (nodos.length > 0) {
    await Promise.all(
      nodos.map(async (el) => {
        const url = el.getAttribute('x-include');
        el.removeAttribute('x-include');
        if (!url) return;
        try {
          const res = await fetch(url);
          if (res.ok) {
            el.innerHTML = await res.text();
          } else {
            console.error(`[componentLoader ❌] 404: ${url}`);
          }
        } catch (err) {
          console.error(`[componentLoader ❌] Error ${url}:`, err.message);
        }
      })
    );
    nodos = Array.from(document.querySelectorAll('[x-include]'));
  }
}
