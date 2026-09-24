// Banderas Unicode por código de país/moneda
const BANDERAS_MAP = {
  'COP': '🇨🇴',
  'PEN': '🇵🇪',
  'ARS': '🇦🇷',
  'BRL': '🇧🇷',
  'MXN': '🇲🇽',
  'EUR': '🇪🇺',
  'USD': '🇺🇸',
  'USDT': '₮',
  'PYG': '🇵🇾',
  'VES': '🇻🇪',
  'CLP': '🇨🇱',
  'DOP': '🇩🇴',
  'CRC': '🇨🇷',
  'BOB': '🇧🇴',
  'ECU': '🇪🇨',
  'PAN': '🇵🇦',
  'CAD': '🇨🇦'
};

const MAPA_MONEDAS = {
  'Brazil': 'BRL', 'Colombia': 'COP', 'Chile': 'CLP', 'Peru': 'PEN', 'Argentina': 'ARS',
  'Paraguay': 'PYG', 'Venezuela': 'VES', 'EEUU-Zelle': 'USD', 'Panama': 'PAN',
  'Ecuador': 'ECU', 'Mexico': 'MXN', 'Bolivia': 'BOB', 'Europa': 'EUR',
  'Costa Rica': 'CRC', 'Dominicana': 'DOP', 'Canada': 'CAD'
};

const FACTORES_RESPALDO = {
  "PEN": { "D": 1.026, "P": 0.976 },
  "COP": { "D": 1.030, "P": 0.976 },
  "CLP": { "D": 1.042, "P": 0.962 },
  "ARS": { "D": 1.042, "P": 0.962 },
  "VES": { "D": 1.026, "P": 0.976 },
  "BRL": { "D": 1.053, "P": 0.952 },
  "MXN": { "D": 1.064, "P": 0.943 },
  "PYG": { "D": 1.042, "P": 0.962 },
  "ECU": { "D": 1.064, "P": 0.940 },
  "EUR": { "D": 1.087, "P": 0.926 },
  "USD": { "D": 1.087, "P": 0.930 },
  "USDT": { "D": 1.0,  "P": 1.0 },
  "PYUSD": { "D": 1.2, "P": 0.8 },
  "DOP": { "D": 1.064, "P": 0.943 },
  "CRC": { "D": 1.064, "P": 0.943 },
  "CAD": { "D": 1.042, "P": 0.962 },
  "PAN": { "D": 1.064, "P": 0.940 },
  "BOB": { "D": 1.087, "P": 0.926 }
};

const T_FACTOR_MAP = {
  "USDT":  {"USDT": 1.0, "PYUSD": 1.2, "PEN": 0.9, "COP": 0.9, "CLP": 0.9, "ARS": 0.9, "USD": 0.9, "ECU": 0.9, "PAN": 0.9, "MXN": 0.9, "BRL": 0.9, "VES": 0.9, "PYG": 0.9, "EUR": 0.9, "DOP": 0.9, "BOB": 0.9, "CRC": 0.9, "UYU": 0.9, "OXX": 0.9},
  "PYUSD": {"USDT": 1.2, "PYUSD": 1.0, "PEN": 1.2, "COP": 1.2, "CLP": 1.2, "ARS": 1.2, "USD": 1.2, "ECU": 1.2, "PAN": 1.2, "MXN": 1.2, "BRL": 1.2, "VES": 1.2, "PYG": 1.2, "EUR": 1.2, "DOP": 1.2, "BOB": 1.2, "CRC": 1.2, "UYU": 1.2, "OXX": 1.2},
  "PEN":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 1.0, "COP": 0.9, "CLP": 0.9, "ARS": 0.9, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.9, "VES": 0.93, "PYG": 0.9, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "COP":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.9, "COP": 1.0, "CLP": 0.9, "ARS": 0.9, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.9, "VES": 0.92, "PYG": 0.9, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "CLP":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.9, "COP": 0.9, "CLP": 1.0, "ARS": 0.9, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.9, "VES": 0.92, "PYG": 0.9, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "ARS":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.9, "COP": 0.9, "CLP": 0.9, "ARS": 1.0, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.9, "VES": 0.92, "PYG": 0.9, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "USD":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 1.0, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "ECU":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 1.0, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "PAN":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 1.0, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "MXN":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 1.0, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "BRL":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.9, "COP": 0.9, "CLP": 0.9, "ARS": 0.9, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 1.0, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.9},
  "VES":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.9, "COP": 0.9, "CLP": 0.9, "ARS": 0.9, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 1.0, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.9},
  "PYG":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.9, "COP": 0.9, "CLP": 0.9, "ARS": 0.9, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 1.0, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "EUR":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 1.0, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "DOP":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 1.0, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "BOB":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 1.0, "CRC": 0.85, "UYU": 0.85, "OXX": 0.85},
  "CRC":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 1.0, "UYU": 0.85, "OXX": 0.85},
  "UYU":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 1.0, "OXX": 0.85},
  "OXX":   {"USDT": 0.9, "PYUSD": 1.2, "PEN": 0.85, "COP": 0.85, "CLP": 0.85, "ARS": 0.85, "USD": 0.85, "ECU": 0.85, "PAN": 0.85, "MXN": 0.85, "BRL": 0.85, "VES": 0.85, "PYG": 0.85, "EUR": 0.85, "DOP": 0.85, "BOB": 0.85, "CRC": 0.85, "UYU": 0.85, "OXX": 1.0}
};

module.exports = {
  BANDERAS_MAP,
  MAPA_MONEDAS,
  FACTORES_RESPALDO,
  T_FACTOR_MAP
};
