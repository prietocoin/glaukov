import { comprobantesView } from './views/comprobantes.js';
import { directorioView } from './views/directorio.js';
import { AteneaAPI } from './api.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    vistaActiva: 'comprobantes',
    listaSocios: [],
    comprobantes: comprobantesView(),
    directorio: directorioView(),

    async init() {
      try {
        this.listaSocios = await AteneaAPI.getSocios();
      } catch (err) {
        console.error('[Glaukov UI ❌] Error en init:', err);
      }
      await this.comprobantes.cargar();
      await this.directorio.cargar();
    }
  }));
});
