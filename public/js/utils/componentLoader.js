/**
 * @file componentLoader.js
 * @description Inyecta componentes HTML definidos mediante el atributo x-include.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const elements = document.querySelectorAll('[x-include]');
  for (const el of elements) {
    const file = el.getAttribute('x-include');
    if (file) {
      try {
        const res = await fetch(file);
        if (res.ok) {
          el.innerHTML = await res.text();
        } else {
          console.warn(`[componentLoader ⚠️] No se encontró el componente: ${file}`);
        }
      } catch (err) {
        console.error(`[componentLoader ❌] Error al cargar ${file}:`, err.message);
      }
    }
  }
});
