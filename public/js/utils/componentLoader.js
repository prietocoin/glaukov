/**
 * @file componentLoader.js
 * @description Descargador de plantillas HTML dinámicas.
 */

export async function cargarComponentes() {
  const elementos = Array.from(document.querySelectorAll('[x-include]'));

  for (const el of elementos) {
    const url = el.getAttribute('x-include');
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (res.ok) {
        el.innerHTML = await res.text();
        el.removeAttribute('x-include');
      } else {
        console.error(`[componentLoader ❌ HTTP ${res.status}] ${url}`);
      }
    } catch (err) {
      console.error(`[componentLoader ❌ Error Red] ${url}:`, err.message);
    }
  }
}
