/**
 * @file componentLoader.js
 * @description Inyector atómico de plantillas HTML para la directiva x-include.
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
      } else {
        console.warn(`[componentLoader ⚠️] No se pudo cargar: ${url}`);
      }
    } catch (err) {
      console.error(`[componentLoader ❌] Error en ${url}:`, err.message);
    }
  }
}

// Carga automática en DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarComponentes);
} else {
  cargarComponentes();
}
