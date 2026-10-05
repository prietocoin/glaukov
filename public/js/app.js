function truncarTasaComercial(valor) {
  const num = Math.abs(parseFloat(valor) || 0);
  if (num === 0) return 1.0;
  if (num > 99.99) {
    return Math.trunc(num);
  }
  return Math.trunc((num + 0.0000001) * 100) / 100;
}

function registrarAppAlpine() {
  Alpine.data('app', () => ({
    vistaActiva: 'dashboard',
    vistaDashboardSubmenu: 'balance',
    loteSeleccionadoInspector: '',

    comprobantes: [],
    directorio: [],
    socios: [],

    // 🟢 LISTA MAESTRA CENTRALIZADA DE LAS 18 MONEDAS DE GLAUKOV
    listaMonedasActivas: [
      { code: 'ARS', label: 'ARS (Peso Argentino)', nombre: 'Argentina', bandera: '🇦🇷' },
      { code: 'BOB', label: 'BOB (Boliviano)', nombre: 'Bolivia', bandera: '🇧🇴' },
      { code: 'BRL', label: 'BRL (Real Brasileño)', nombre: 'Brazil', bandera: '🇧🇷' },
      { code: 'CAD', label: 'CAD (Dólar Canadiense)', nombre: 'Canada', bandera: '🇨🇦' },
      { code: 'CLP', label: 'CLP (Peso Chileno)', nombre: 'Chile', bandera: '🇨🇱' },
      { code: 'COP', label: 'COP (Peso Colombiano)', nombre: 'Colombia', bandera: '🇨🇴' },
      { code: 'CRC', label: 'CRC (Colón Costarricense)', nombre: 'Costa Rica', bandera: '🇨🇷' },
      { code: 'DOP', label: 'DOP (Peso Dominicano)', nombre: 'Dominicana', bandera: '🇩🇴' },
      { code: 'ECU', label: 'ECU (Dólar Ecuador)', nombre: 'Ecuador', bandera: '🇪🇨' },
      { code: 'EUR', label: 'EUR (Euro)', nombre: 'Europa', bandera: '🇪🇺' },
      { code: 'MXN', label: 'MXN (Peso Mexicano)', nombre: 'Mexico', bandera: '🇲🇽' },
      { code: 'PAN', label: 'PAN (Balboa / Dólar Panamá)', nombre: 'Panamá', bandera: '🇵🇦' },
      { code: 'PEN', label: 'PEN (Sol Peruano)', nombre: 'Peru', bandera: '🇵🇪' },
      { code: 'PYG', label: 'PYG (Guaraní Paraguayo)', nombre: 'Paraguay', bandera: '🇵🇾' },
      { code: 'PYUSD', label: 'PYUSD (PayPal USD)', nombre: 'PYUSD', bandera: '🪙' },
      { code: 'USD', label: 'USD (EEUU - Zelle)', nombre: 'EEUU-Zelle', bandera: '🇺🇸' },
      { code: 'USDT', label: 'USDT (Tether)', nombre: 'USDT', bandera: '🪙' },
      { code: 'VES', label: 'VES (Bolívar Venezolano)', nombre: 'Venezuela', bandera: '🇻🇪' }
    ],

    // 🟢 DICCIONARIO MAESTRO (DERIVADO DINÁMICAMENTE)
    get infoMonedasMaestra() {
      const map = {};
      this.listaMonedasActivas.forEach(m => {
        map[m.code] = { nombre: m.nombre, bandera: m.bandera };
      });
      return map;
    },

    modoPruebaActivo: false,
    loteActivo: '',
    tasasProduccion: {},
    borradorCapturado: {},
    historialTasas: [],
    imagenPreviewUrl: '',
    socioPreviewSeleccionado: 'GENERAL',
    cargandoPreviewImagen: false,

    filtroRol: '',
    filtroSocio: '',
    filtroFechaInicio: '',
    filtroFechaFin: '',
    filtroDesdeHash: '',
    filtroHastaHash: '',
    ordenarPor: 'fecha_desc',
    filtroHashBusqueda: '',
    saldoAnterior: 0,

    busquedaDirectorio: '',

    modalAbierto: false,
    itemEdicion: null,
    modalImagenAbierto: false,
    itemSeleccionado: null,
    modalConfigSocioAbierto: false,
    socioConfigEdit: null,

    timerPolling: null,
    ultimaActualizacion: '',

    async init() {
      try { await this.cargarSocios(); } catch (e) {}
      try { await this.cargarDirectorio(); } catch (e) {}
      try { await this.cargarComprobantes(); } catch (e) {}
      try { await this.cargarTasasMercado(); } catch (e) {}
      try { await this.cargarHistorialTasas(); } catch (e) {}
      this.iniciarAutoSync();
    },

    iniciarAutoSync() {
      if (this.timerPolling) clearInterval(this.timerPolling);
      this.timerPolling = setInterval(() => {
        if (this.vistaActiva === 'comprobantes') this.cargarComprobantes(true);
        this.ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
      }, 5000);
    },

    toggleDashSocio(socio) {
      if (!socio) return;
      let mostrarObj = typeof socio.mostrar === 'string' ? JSON.parse(socio.mostrar || '{}') : (socio.mostrar || {});
      mostrarObj.dashboard = !(mostrarObj.dashboard ?? true);
      socio.mostrar = mostrarObj;
    },

    async toggleEstadoSocio(socio) {
      if (!socio) return;
      try {
        const nuevoEstado = !socio.activo;
        socio.activo = nuevoEstado;
        await window.AteneaAPI.patchEstadoSocio(socio.nombre, nuevoEstado);
      } catch (err) {
        console.error('[Glaukov UI ❌ Error al cambiar estado socio WA]', err);
      }
    },

    // 🟢 NUEVO TOGGLE RÁPIDO PARA HERENCIA DE SOCIO
    async toggleHerenciaSocio(socio) {
      if (!socio) return;
      try {
        const nuevaHerencia = !socio.herencia;
        socio.herencia = nuevaHerencia;

        let monedasObj = socio.monedas;
        if (typeof monedasObj === 'string') {
          try { monedasObj = JSON.parse(monedasObj); } catch (e) { monedasObj = {}; }
        }

        let mostrarObj = socio.mostrar;
        if (typeof mostrarObj === 'string') {
          try { mostrarObj = JSON.parse(mostrarObj); } catch (e) { mostrarObj = {}; }
        }

        const payload = {
          nombre: socio.nombre,
          rol: socio.rol || socio.roles || 'SOCIO',
          moneda_base: String(socio.moneda_base || socio.moneda_socio || 'USDT').toUpperCase().trim(),
          id_grupo: socio.id_grupo || socio.whatsapp || '',
          saldo_inicial: parseFloat(socio.saldo_inicial ?? socio.saldo_anterior ?? 0) || 0,
          mostrar: mostrarObj || { tasas: true, dashboard: true },
          monedas: monedasObj || {},
          herencia: Boolean(nuevaHerencia)
        };

        await window.AteneaAPI.guardarSocioConfig(payload);
        await this.cargarDirectorio();
        await this.cargarComprobantes();
      } catch (err) {
        console.error('[Glaukov UI ❌ Error al cambiar herencia socio]', err);
      }
    },

    async cargarTasasMercado() {
      try {
        const res = await window.AteneaAPI.getUltimasTasas();
        if (res) {
          if (res.id_tasa) {
            this.loteActivo = res.id_tasa;
            if (!this.loteSeleccionadoInspector) this.loteSeleccionadoInspector = res.id_tasa;
          }
          if (res.tasas) this.tasasProduccion = res.tasas;
        }
      } catch (err) {
        console.error('[Glaukov UI ❌ Error al cargar tasas mercado]', err);
      }
    },

    async cargarHistorialTasas() {
      try {
        if (window.AteneaAPI && typeof window.AteneaAPI.getHistorialTasas === 'function') {
          const res = await window.AteneaAPI.getHistorialTasas();
          this.historialTasas = Array.isArray(res) ? res : (res?.rows || res?.data || []);
          if (this.historialTasas.length > 0 && !this.loteSeleccionadoInspector) {
            this.loteSeleccionadoInspector = this.historialTasas[0].id_tasa || this.loteActivo;
          }
        }
      } catch (err) {
        console.warn('[Glaukov UI ⚠️ Error al cargar historial de tasas]', err);
        this.historialTasas = [];
      }
    },

    get datosLoteInspeccionado() {
      const targetLote = this.loteSeleccionadoInspector || this.loteActivo;
      const loteFound = (this.historialTasas || []).find(l => String(l.id_tasa || '').toUpperCase() === String(targetLote || '').toUpperCase());

      if (loteFound) {
        let tasasObj = loteFound.tasas;
        if (typeof tasasObj === 'string') {
          try { tasasObj = JSON.parse(tasasObj); } catch (e) { tasasObj = {}; }
        }
        return { 
          id_tasa: loteFound.id_tasa, 
          tasas: tasasObj || {}, 
          fecha: loteFound.created_at ? new Date(loteFound.created_at).toLocaleString('es-ES') : ''
        };
      }

      return { id_tasa: this.loteActivo || 'N/A', tasas: this.tasasProduccion || {} };
    },

    async conectarHooAPI() {
      try {
        const res = await window.AteneaAPI.fetchHoo();
        if (res && (res.rates || res.rates_draft)) {
          const rawRates = res.rates || res.rates_draft;
          const ratesNormalizadas = {};
          
          Object.keys(rawRates).forEach(k => {
            ratesNormalizadas[k.toUpperCase()] = rawRates[k];
          });
          
          this.borradorCapturado = { ...ratesNormalizadas };
          alert('✅ Borrador capturado e inyectado con éxito.');
        } else {
          alert('No hay un borrador reciente enviado por n8n / Hoo API.');
        }
      } catch (err) {
        console.error(err);
        alert('Error conectando con la API de Hoo: ' + err.message);
      }
    },

    async generarPreviewImagen(socioNombre = 'GENERAL') {
      this.cargandoPreviewImagen = true;
      this.socioPreviewSeleccionado = socioNombre;
      try {
        const timestamp = new Date().getTime();
        this.imagenPreviewUrl = `/api/preview-image/${encodeURIComponent(socioNombre)}?t=${timestamp}`;
        window.open(this.imagenPreviewUrl, '_blank');
      } catch (err) {
        console.error('Error generando preview de imagen:', err);
      } fontalmente {
        this.cargandoPreviewImagen = false;
      }
    },

    async publicarTasaOficial() {
      if (!this.borradorCapturado || Object.keys(this.borradorCapturado).length === 0) {
        alert('No hay borrador capturado para publicar.');
        return;
      }
      
      const mensajeConfirm = this.modoPruebaActivo 
        ? '🧪 MODO PRUEBA ACTIVADO\n¿Deseas publicar el borrador y enviarlo AL GRUPO DE PRUEBAS?' 
        : '🚀 MODO PRODUCCIÓN ACTIVADO\n¿Deseas publicar el borrador como tasa oficial a TODOS LOS SOCIOS?';

      if (!confirm(mensajeConfirm)) return;

      try {
        const res = await window.AteneaAPI.publicarTasa(null, this.borradorCapturado, this.modoPruebaActivo);
        if (res && res.id_tasa) this.loteActivo = res.id_tasa;
        
        alert(`Tasa oficial ${res?.id_tasa || ''} publicada. ${this.modoPruebaActivo ? '🧪 Enviado al grupo de pruebas.' : '🚀 Enviado a producción.'}`);
        await this.cargarTasasMercado();
        await this.cargarHistorialTasas();
      } catch (err) {
        console.error(err);
        alert('Error al publicar tasa: ' + err.message);
      }
    },

    async reenviarTasaActual() {
      if (!this.loteActivo) {
        alert('No hay un lote activo cargado.');
        return;
      }

      const mensajeConfirm = this.modoPruebaActivo 
        ? `🧪 MODO PRUEBA ACTIVADO\n¿Reenviar notificaciones del lote ${this.loteActivo} AL GRUPO DE PRUEBAS?` 
        : `🚀 MODO PRODUCCIÓN ACTIVADO\n¿Reenviar notificaciones del lote ${this.loteActivo} a TODOS LOS SOCIOS?`;

      if (!confirm(mensajeConfirm)) return;

      try {
        await window.AteneaAPI.reenviarTasa(this.loteActivo, 'GENERAL', this.modoPruebaActivo);
        alert(`Reenvío activado para la tasa ${this.loteActivo} ${this.modoPruebaActivo ? '(🧪 Grupo de Prueba)' : '(🚀 Producción)'}.`);
      } catch (err) {
        console.error(err);
        alert('Error al reenviar tasa: ' + err.message);
      }
    },

    async enviarTasaIndividual(socioObj) {
      if (!this.loteActivo) {
        alert('No hay un lote activo en producción para enviar.');
        return;
      }
      if (!socioObj || !socioObj.nombre) {
        alert('No se ha definido un socio válido para enviar.');
        return;
      }
      
      const modoTexto = this.modoPruebaActivo ? '🧪 [GRUPO PRUEBA]' : '🚀 [PRODUCCIÓN]';

      if (!socioObj.whatsapp && !socioObj.id_grupo) {
         if (!confirm(`⚠️ El socio ${socioObj.nombre} NO parece tener WhatsApp configurado. ¿Intentar enviar en modo ${modoTexto}?`)) return;
      } else {
         if (!confirm(`⚡ ¿Enviar cartelera [${this.loteActivo}] para ${socioObj.nombre} ${modoTexto}?`)) return;
      }
      
      try {
        await window.AteneaAPI.reenviarTasaSocio(this.loteActivo, socioObj.nombre, this.modoPruebaActivo);
        alert(`✅ Cartelera de ${socioObj.nombre} despachada ${modoTexto}.`);
      } catch (err) {
        console.error(err);
        alert('❌ Error al enviar tasa individual: ' + err.message);
      }
    },

    actualizarSocioSeleccionado() {
      const socioNom = (this.filtroSocio || '').trim().toUpperCase();
      if (socioNom) {
        const socioFound = (this.directorio || []).find(d => (d.nombre || '').trim().toUpperCase() === socioNom);
        const saldoVal = socioFound?.saldo_inicial ?? socioFound?.saldo_anterior;
        if (saldoVal !== undefined && saldoVal !== null) {
          this.saldoAnterior = parseFloat(saldoVal) || 0;
        } else {
          this.saldoAnterior = 0;
        }
      } else {
        this.saldoAnterior = 0;
      }
      this.cargarComprobantes();
    },

    async cargarComprobantes(silencioso = false) {
      try {
        const params = {};
        if (this.filtroSocio) params.socio = this.filtroSocio;
        if (this.filtroRol) params.rol = this.filtroRol;
        if (this.filtroFechaInicio) params.fechaInicio = this.filtroFechaInicio;
        if (this.filtroFechaFin) params.fechaFin = this.filtroFechaFin;
        if (this.filtroHashBusqueda) params.hash = this.filtroHashBusqueda;
        if (this.ordenarPor) params.orden = this.ordenarPor;

        const res = await window.AteneaAPI.getComprobantes(params);
        this.comprobantes = Array.isArray(res) ? res : [];
      } catch (err) {
        if (!silencioso) console.error('[Glaukov UI ❌]', err);
        this.comprobantes = [];
      }
    },

    async cargarDirectorio() {
      try {
        const res = await window.AteneaAPI.getDirectorio();
        this.directorio = Array.isArray(res) ? res : [];
        if (this.filtroSocio) {
          const socioNom = this.filtroSocio.trim().toUpperCase();
          const socioFound = this.directorio.find(d => (d.nombre || '').trim().toUpperCase() === socioNom);
          const saldoVal = socioFound?.saldo_inicial ?? socioFound?.saldo_anterior;
          if (saldoVal !== undefined && saldoVal !== null) {
            this.saldoAnterior = parseFloat(saldoVal) || 0;
          }
        }
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    async cargarSocios() {
      try {
        const res = await window.AteneaAPI.getSocios();
        this.socios = Array.isArray(res) ? res : [];
      } catch (err) {
        console.error('[Glaukov UI ❌]', err);
      }
    },

    calcularTasaEnVivo(code, pct, esResta = false) {
      const base = parseFloat(this.tasasProduccion[code]) || 1.0;
      const p = parseFloat(pct) || 0;
      const factor = esResta ? (1 - (p / 100)) : (1 + (p / 100));
      const res = base * factor;
      if (res === 0) return '0';
      if (res > 99.99) return Math.trunc(res).toLocaleString('en-US');
      return (Math.trunc(res * 100) / 100).toFixed(2);
    },

    // 🟢 APERTURA DE MODAL ADAPTADA A JSONB 'herencia' Y 'monedas' DE PERFILES_GLAUKOV
    abrirConfigSocio(socioObj) {
      let monedasConfig = socioObj.monedas;
      if (typeof monedasConfig === 'string') {
        try { monedasConfig = JSON.parse(monedasConfig); } catch (e) { monedasConfig = {}; }
      }
      monedasConfig = typeof monedasConfig === 'object' && monedasConfig !== null ? monedasConfig : {};

      let mostrarConfig = socioObj.mostrar;
      if (typeof mostrarConfig === 'string') {
        try { mostrarConfig = JSON.parse(mostrarConfig); } catch (e) { mostrarConfig = {}; }
      }
      mostrarConfig = typeof mostrarConfig === 'object' && mostrarConfig !== null ? mostrarConfig : {};

      const paisesArray = [];
      const baseDefecto = ['ARS', 'VES', 'PEN', 'COP', 'CLP', 'BRL'];
      
      const codigosConfigurados = Object.keys(monedasConfig);
      const codigosMostrar = [...new Set([...baseDefecto, ...codigosConfigurados])];

      codigosMostrar.forEach(code => {
        const info = this.infoMonedasMaestra[code] || { nombre: code, bandera: '🌐' };
        const config = monedasConfig[code];

        if (config) {
          paisesArray.push({
            code,
            nombre: info.nombre,
            bandera: info.bandera,
            activo: config.activo ?? true,
            pctD: config.porcentaje?.deposito || 0,
            pctP: config.porcentaje?.pago || 0,
            polaridadSuma: config.polaridad === '+' || config.polaridad === undefined,
            naturaleza: config.tipo || 'D' 
          });
        } else {
          paisesArray.push({
            code,
            nombre: info.nombre,
            bandera: info.bandera,
            activo: false,
            pctD: 0,
            pctP: 0,
            polaridadSuma: true,
            naturaleza: 'D'
          });
        }
      });

      this.socioConfigEdit = {
        nombre: socioObj.nombre || '',
        roles: socioObj.rol || socioObj.roles || 'SOCIO',
        moneda_socio: String(socioObj.moneda_base || socioObj.moneda_socio || 'USDT').toUpperCase().trim(),
        whatsapp: socioObj.id_grupo || socioObj.whatsapp || '',
        saldo_anterior: parseFloat(socioObj.saldo_inicial ?? socioObj.saldo_anterior ?? 0) || 0,
        activo: mostrarConfig.tasas ?? socioObj.activo ?? true, 
        mostrar_dashboard: mostrarConfig.dashboard ?? socioObj.mostrar_dashboard ?? true,
        herencia: Boolean(socioObj.herencia ?? false), // 👈 Mapeo de herencia
        paises: paisesArray
      };

      this.modalConfigSocioAbierto = true;
    },

    agregarNuevaMoneda() {
      if (!this.socioConfigEdit) return;
      const codeRaw = prompt('Ingresa el código de la moneda (ej: BOB, MXN, CAD, DOP, USD, PAN, ECU):');
      if (!codeRaw) return;

      const codeUpper = codeRaw.trim().toUpperCase();
      if (this.socioConfigEdit.paises.some(p => p.code === codeUpper)) {
        alert(`La moneda ${codeUpper} ya está configurada para este socio.`);
        return;
      }

      const info = this.infoMonedasMaestra[codeUpper] || { nombre: codeUpper, bandera: '🌐' };

      this.socioConfigEdit.paises.push({
        code: codeUpper,
        nombre: info.nombre,
        bandera: info.bandera,
        activo: true,
        pctD: 0,
        pctP: 0,
        polaridadSuma: true,
        naturaleza: 'D'
      });
    },

    quitarMonedaSocio(index) {
      if (!this.socioConfigEdit || !this.socioConfigEdit.paises) return;
      this.socioConfigEdit.paises.splice(index, 1);
    },

    crearNuevoSocio() {
      this.abrirConfigSocio({
        nombre: '', rol: 'SOCIO', moneda_base: 'USDT', id_grupo: '', saldo_inicial: 0, herencia: false, mostrar: {tasas: true, dashboard: true}, monedas: {}
      });
    },

    // 🟢 GUARDADO CORREGIDO: Guarda 'herencia' explícitamente en el payload de perfiles_glaukov
    async guardarConfigSocioModal() {
      if (!this.socioConfigEdit || !this.socioConfigEdit.nombre.trim()) {
        alert('Por favor especifica el nombre del socio.');
        return;
      }

      try {
        const monedasFinales = {};

        this.socioConfigEdit.paises.forEach(p => {
          const code = p.code.toUpperCase();
          const pctD = Math.abs(parseFloat(p.pctD) || 0);
          const pctP = Math.abs(parseFloat(p.pctP) || 0);

          monedasFinales[code] = {
            activo: Boolean(p.activo),
            tipo: p.naturaleza || 'D',
            polaridad: p.polaridadSuma ? '+' : '-',
            porcentaje: {
              deposito: pctD,
              pago: pctP
            }
          };
        });

        const payload = {
          nombre: this.socioConfigEdit.nombre,
          rol: this.socioConfigEdit.roles,
          moneda_base: String(this.socioConfigEdit.moneda_socio || 'USDT').toUpperCase().trim(),
          id_grupo: this.socioConfigEdit.whatsapp,
          saldo_inicial: parseFloat(this.socioConfigEdit.saldo_anterior) || 0,
          herencia: Boolean(this.socioConfigEdit.herencia), // 👈 Se envía al backend
          mostrar: {
            tasas: Boolean(this.socioConfigEdit.activo),
            dashboard: Boolean(this.socioConfigEdit.mostrar_dashboard)
          },
          monedas: monedasFinales
        };

        await window.AteneaAPI.guardarSocioConfig(payload);
        
        this.modalConfigSocioAbierto = false;
        await this.cargarDirectorio();
        await this.cargarSocios();
        await this.cargarComprobantes();
        alert('✅ Configuración del socio guardada con éxito.');
      } catch (err) {
        console.error('Error al guardar socio:', err);
        alert('Error guardando socio: ' + err.message);
      }
    },

    async apagarTodosSocios() {
      if (!confirm('¿Deseas apagar/desactivar todas las carteleras de los socios?')) return;
      try {
        await window.AteneaAPI.desactivarTodosSocios();
        await this.cargarDirectorio();
      } catch (err) {
        console.error(err);
      }
    },

    async guardarVigentes() {
      try {
        await window.AteneaAPI.guardarVigentes();
        alert('Plantilla de socios vigentes memorizada.');
      } catch (err) {
        console.error(err);
      }
    },

    async restaurarVigentes() {
      try {
        await window.AteneaAPI.restaurarVigentes();
        await this.cargarDirectorio();
        alert('Socios vigentes restaurados.');
      } catch (err) {
        console.error(err);
      }
    },

    async eliminarSocioDirectorio(nombre) {
      if (!confirm(`¿Eliminar permanentemente a ${nombre}?`)) return;
      try {
        await window.AteneaAPI.eliminarSocioDirectorio(nombre);
        await this.cargarDirectorio();
      } catch (err) {
        console.error(err);
      }
    },

    getTallaClass(socioObj) {
      let monedasObj = socioObj?.monedas;
      if (typeof monedasObj === 'string') {
        try { monedasObj = JSON.parse(monedasObj); } catch (e) { monedasObj = {}; }
      }
      monedasObj = typeof monedasObj === 'object' && monedasObj !== null ? monedasObj : {};

      const count = Object.keys(monedasObj).filter(k => monedasObj[k]?.activo).length || 3;
      if (count <= 3) return { label: `Talla: S [${count}]`, color: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40' };
      if (count <= 6) return { label: `Talla: M [${count}]`, color: 'border-amber-500/40 text-amber-300 bg-amber-950/40' };
      return { label: `Talla: L [${count}]`, color: 'border-purple-500/40 text-purple-300 bg-purple-950/40' };
    },

    abrirModal(item) {
      if (!item) return;
      let dateInput = '';
      if (item.fecha_hora_comprobante) {
        const d = new Date(item.fecha_hora_comprobante);
        if (!isNaN(d.getTime())) {
          const tzOffset = d.getTimezoneOffset() * 60000;
          dateInput = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
        }
      }

      const tipoOpBruto = (item.tipo_op1 || item.tipo_op_socio || item.tipo_op || item.tipo_manual || 'D').split('-')[0];
      const fallbackSocio1 = item.nombre_socio_1 || item.socio_1 || item.fb_socio_1 || 'GENERAL';
      const fallbackSocio2 = item.nombre_socio_2 || item.socio_2 || item.fb_socio_2 || 'GENERAL';
      const fallbackMonto = Math.abs(parseFloat(item.monto || item.monto_local || item.m1_socio || item.monto_1 || 0));

      this.itemEdicion = { 
        ...item,
        banco: item.banco && item.banco !== '-' ? item.banco : '',
        referencia: item.referencia && item.referencia !== '-' ? item.referencia : '',
        titular: item.titular && item.titular !== '-' ? item.titular : '',
        nombre_socio_1: fallbackSocio1,
        nombre_socio_2: fallbackSocio2,
        tipo_manual: tipoOpBruto,
        moneda: (item.moneda || item.moneda_local || 'COP').toUpperCase(),
        monto: fallbackMonto,
        tasa_1: truncarTasaComercial(item.tasa_1 || 1.0),
        me1: item.me1 !== undefined && item.me1 !== null ? item.me1 : fallbackMonto,
        tasa_2: truncarTasaComercial(item.tasa_2 || 1.0),
        me2: item.me2 || 0,
        lote_tasa_asignado: item.lote_tasa_asignado || item.lote_tasa || this.loteActivo || 'T052',
        fecha_hora_input: dateInput
      };
      this.modalAbierto = true;
    },

    async releerIAModal() {
      if (!this.itemEdicion || !this.itemEdicion.hash_largo) return;
      if (!confirm('¿Deseas enviar este comprobante a re-lectura con Gemini?')) return;
      try {
        await window.AteneaAPI.releerIA(this.itemEdicion.hash_largo);
        alert('⚡ Comprobante encolado para re-lectura IA.');
        this.modalAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        console.error('Error en re-lectura IA:', err);
        alert('Error: ' + err.message);
      }
    },

    async guardarCambios() {
      if (!this.itemEdicion || !this.itemEdicion.hash_largo) return;
      try {
        if (this.itemEdicion.fecha_hora_input) {
          const ts = Math.floor(new Date(this.itemEdicion.fecha_hora_input).getTime() / 1000);
          if (!isNaN(ts) && ts > 0) this.itemEdicion.timestamp = ts;
        }

        const montoEditado = Math.abs(parseFloat(this.itemEdicion.monto || 0));
        const divisaEditada = (this.itemEdicion.moneda || 'USDT').toUpperCase();
        const loteSeleccionado = (this.itemEdicion.lote_tasa_asignado || this.itemEdicion.lote_tasa || this.loteActivo || 'T052').toUpperCase().trim();

        const payload = {
          monto: montoEditado,
          moneda: divisaEditada,
          banco: this.itemEdicion.banco,
          referencia: this.itemEdicion.referencia,
          titular: this.itemEdicion.titular,
          tipo_manual: this.itemEdicion.tipo_manual || 'P',
          nombre_socio_1: this.itemEdicion.nombre_socio_1 || 'GENERAL',
          socio_1: this.itemEdicion.nombre_socio_1 || 'GENERAL',
          nombre_socio_2: this.itemEdicion.nombre_socio_2 || 'GENERAL',
          socio_2: this.itemEdicion.nombre_socio_2 || 'GENERAL',
          lote_tasa_asignado: loteSeleccionado,
          lote_tasa: loteSeleccionado,
          id_tasa: loteSeleccionado
        };

        const res = await window.AteneaAPI.actualizarComprobante(this.itemEdicion.hash_largo, payload);

        if (res && (res.success || res.status === 'SUCCESS')) {
          this.modalAbierto = false;
          await this.cargarComprobantes();
        } else {
          alert('Error al guardar la liquidación');
        }
      } catch (err) {
        console.error('❌ Error en guardarCambios:', err);
        alert('Error al guardar liquidación: ' + (err.message || err));
      }
    },

    async eliminarComprobante(hashLargo) {
      if (!hashLargo || !confirm('¿Deseas eliminar este comprobante?')) return;
      try {
        await window.AteneaAPI.eliminarComprobante(hashLargo);
        this.modalAbierto = false;
        await this.cargarComprobantes();
      } catch (err) {
        console.error('Error eliminando comprobante:', err);
      }
    },

    verDetalleImagen(item) {
      this.itemSeleccionado = item;
      this.modalImagenAbierto = true;
    },

    formatMonto(val) {
      if (val === null || val === undefined || isNaN(val) || val === '') return '0.00';
      const num = parseFloat(val);
      if (num === 0) return '0.00';
      const signoStr = num < 0 ? '-' : '';
      const v = Math.abs(num);
      const vTrunc = Math.trunc((v + 0.0000001) * 100) / 100;
      const parts = vTrunc.toFixed(2).split('.');
      return `${signoStr}${Number(parts[0]).toLocaleString('en-US')}.${parts[1]}`;
    },

    get sujetoAuditado() {
      return this.filtroSocio ? this.filtroSocio.toUpperCase() : 'TODOS LOS SOCIOS';
    },

    get movimientoFiltradoTotal() {
      if (!Array.isArray(this.comprobantes)) return 0;
      const socioTarget = (this.filtroSocio || '').trim().toUpperCase();

      return this.comprobantes.reduce((sum, item) => {
        const s1 = (item.nombre_socio_1 || item.socio_1 || '').trim().toUpperCase();
        const s2 = (item.nombre_socio_2 || item.socio_2 || '').trim().toUpperCase();

        let val = 0;
        if (socioTarget && s2 === socioTarget && s1 !== socioTarget) {
          val = parseFloat(item.monto_2 !== undefined && item.monto_2 !== null ? item.monto_2 : (item.m2_socio !== undefined ? item.m2_socio : 0)) || 0;
        } else {
          val = parseFloat(item.monto_1 !== undefined && item.monto_1 !== null ? item.monto_1 : (item.m1_socio !== undefined ? item.m1_socio : item.monto)) || 0;
        }
        return sum + val;
      }, 0);
    },

    get monedaSocioDominante() {
      return (this.comprobantes && this.comprobantes[0]?.moneda) || 'USDT';
    },

    get saldoActualTotal() {
      return (parseFloat(this.saldoAnterior) || 0) + this.movimientoFiltradoTotal;
    },

    get directorioFiltrado() {
      if (!Array.isArray(this.directorio)) return [];
      if (!this.busquedaDirectorio) return this.directorio;
      const q = this.busquedaDirectorio.toLowerCase();
      return this.directorio.filter(d => 
        (d && d.nombre && d.nombre.toLowerCase().includes(q)) ||
        (d && (d.rol || d.roles) && (d.rol || d.roles).toLowerCase().includes(q)) ||
        (d && (d.id_grupo || d.whatsapp) && (d.id_grupo || d.whatsapp).toLowerCase().includes(q))
      );
    },

    get sociosPendientesConsolidado() {
      if (!Array.isArray(this.directorio)) return [];

      let compFiltrados = Array.isArray(this.comprobantes) ? [...this.comprobantes] : [];

      if (this.filtroFechaInicio) {
        const fInit = new Date(this.filtroFechaInicio + 'T00:00:00').getTime();
        compFiltrados = compFiltrados.filter(c => {
          const t = c.fecha_hora_comprobante ? new Date(c.fecha_hora_comprobante).getTime() : (c.timestamp ? c.timestamp * 1000 : 0);
          return t >= fInit;
        });
      }

      if (this.filtroFechaFin) {
        const fFin = new Date(this.filtroFechaFin + 'T23:59:59').getTime();
        compFiltrados = compFiltrados.filter(c => {
          const t = c.fecha_hora_comprobante ? new Date(c.fecha_hora_comprobante).getTime() : (c.timestamp ? c.timestamp * 1000 : 0);
          return t <= fFin;
        });
      }

      if (this.filtroDesdeHash || this.filtroHastaHash) {
        let idxDesde = 0;
        let idxHasta = compFiltrados.length - 1;
        if (this.filtroDesdeHash) {
          const found = compFiltrados.findIndex(c => c.hash_largo === this.filtroDesdeHash);
          if (found !== -1) idxDesde = found;
        }
        if (this.filtroHastaHash) {
          const found = compFiltrados.findIndex(c => c.hash_largo === this.filtroHastaHash);
          if (found !== -1) idxHasta = found;
        }
        const start = Math.min(idxDesde, idxHasta);
        const end = Math.max(idxDesde, idxHasta);
        compFiltrados = compFiltrados.slice(start, end + 1);
      }

      return this.directorio
        .filter(socio => {
          let mostrarObj = socio.mostrar;
          if (typeof mostrarObj === 'string') {
            try { mostrarObj = JSON.parse(mostrarObj); } catch (e) { mostrarObj = {}; }
          }
          return (mostrarObj?.dashboard ?? true) !== false;
        })
        .map(socio => {
          const nombreUpper = (socio.nombre || '').trim().toUpperCase();
          const saldoBase = parseFloat(socio.saldo_inicial ?? socio.saldo_anterior) || 0;

          const movimientoHistorico = compFiltrados.reduce((acc, item) => {
            const s1 = (item.nombre_socio_1 || item.socio_1 || '').trim().toUpperCase();
            const s2 = (item.nombre_socio_2 || item.socio_2 || '').trim().toUpperCase();

            if (s1 === nombreUpper) {
              const val1 = parseFloat(item.monto_1 !== undefined && item.monto_1 !== null ? item.monto_1 : (item.m1_socio !== undefined ? item.m1_socio : item.monto)) || 0;
              return acc + val1;
            } else if (s2 === nombreUpper) {
              const val2 = parseFloat(item.monto_2 !== undefined && item.monto_2 !== null ? item.monto_2 : (item.m2_socio !== undefined ? item.m2_socio : 0)) || 0;
              return acc + val2;
            }
            return acc;
          }, 0);

          const saldoFinal = Math.trunc((saldoBase + movimientoHistorico + 0.0000001) * 100) / 100;

          return {
            nombre: socio.nombre,
            moneda: (socio.moneda_base || socio.moneda_socio || 'USDT').toUpperCase(),
            saldoBase,
            movimientoHistorico,
            saldoFinal
          };
        })
        .filter(s => Math.abs(s.saldoFinal) >= 0.01);
    },

    get totalSumaAlgebraicaPendientes() {
      return this.sociosPendientesConsolidado.reduce((sum, s) => sum + s.saldoFinal, 0);
    }
  }));
}

if (window.Alpine) {
  registrarAppAlpine();
} else {
  document.addEventListener('alpine:init', registrarAppAlpine);
}
