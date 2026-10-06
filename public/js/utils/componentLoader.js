/**
 * @file componentLoader.js
 * @description Inyector bloqueante pre-renderizado de componentes HTML.
 */

async function esperarDOM() {
  if (document.readyState === 'loading') {
    await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve));
  }
}

export async function cargarComponentes() {
  await esperarDOM();

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
          console.error(`[componentLoader ❌] Error en ${url}:`, err.message);
        }
      })
    );
    nodos = document.querySelectorAll('[x-include]');
  }
}
