/**
 * @file mapperConstants.js
 * @description Mapeos estáticos de banderas, nombres de país y factores de respaldo.
 */

const BANDERAS_MAP = {
  ARS: '🇦🇷',
  VES: '🇻🇪',
  PEN: '🇵🇪',
  COP: '🇨🇴',
  CLP: '🇨🇱',
  USD: '🇺🇸',
  USDT: '🇺🇸',
  BRL: '🇧🇷',
  MXN: '🇲🇽',
  EUR: '🇪🇺'
};

const MAPA_MONEDAS = {
  ARS: 'Argentina',
  VES: 'Venezuela',
  PEN: 'Perú',
  COP: 'Colombia',
  CLP: 'Chile',
  BRL: 'Brasil',
  MXN: 'México',
  EUR: 'Europa'
};

const FACTORES_RESPALDO = {
  ARS: { D: 1.0, P: 0.95 },
  VES: { D: 1.0, P: 0.95 },
  PEN: { D: 1.0, P: 0.95 },
  COP: { D: 1.0, P: 0.95 },
  CLP: { D: 1.0, P: 0.95 }
};

module.exports = {
  BANDERAS_MAP,
  MAPA_MONEDAS,
  FACTORES_RESPALDO
};
