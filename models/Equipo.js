const mongoose = require('mongoose');
const crypto = require('crypto');

const equipoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  marca: {
    type: String,
    required: true
  },
  modelo: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['hematologia', 'quimica', 'orina', 'coagulacion', 'inmunologia', 'microbiologia', 'otro'],
    required: true
  },
  protocolo: {
    type: String,
    enum: ['ASTM', 'HL7', 'SERIAL', 'TCP', 'FILE'],
    default: 'ASTM'
  },
  configuracion: {
    // Para conexión serial
    puerto: String,           // COM1, /dev/ttyUSB0
    baudRate: { type: Number, default: 9600 },
    dataBits: { type: Number, default: 8 },
    stopBits: { type: Number, default: 1 },
    parity: { type: String, default: 'none' },
    
    // Para conexión TCP/IP
    ip: String,
    puertoTcp: Number,
    
    // Para lectura de archivos
    rutaArchivos: String,
    patron: String,           // Patrón de nombre de archivo
    
    // Configuración general
    tiempoEspera: { type: Number, default: 30000 },
    reintentos: { type: Number, default: 3 }
  },
  integracion: {
    modoEntrega: {
      type: String,
      enum: ['manual_pull', 'push_socket'],
      default: 'manual_pull'
    },
    equipoIpMindray: {
      type: String,
      trim: true
    },
    apiBaseUrl: {
      type: String,
      trim: true
    },
    apiKeyHash: {
      type: String,
      select: false
    },
    apiKeyUltimos4: {
      type: String,
      trim: true
    },
    apiKeyGeneradaEn: Date,
    agenteVersion: {
      type: String,
      trim: true
    },
    ultimoHeartbeat: Date
  },
  mapeoParametros: [{
    codigoEquipo: String,     // Código que envía el equipo
    parametroSistema: String, // ID del parámetro en nuestro sistema
    nombreParametro: String,
    unidad: String,
    factor: { type: Number, default: 1 },  // Factor de conversión
    decimales: { type: Number, default: 2 }
  }],
  mapeoEstudios: [{
    codigoEquipo: String,
    estudioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudio' },
    nombreEstudio: String
  }],
  estado: {
    type: String,
    enum: ['activo', 'inactivo', 'mantenimiento', 'error'],
    default: 'activo'
  },
  ultimaConexion: Date,
  ultimoError: String,
  estadisticas: {
    resultadosRecibidos: { type: Number, default: 0 },
    errores: { type: Number, default: 0 },
    ultimoResultado: Date
  }
}, {
  timestamps: true
});

equipoSchema.methods.setApiKeyIntegracion = function setApiKeyIntegracion(apiKey) {
  const hash = crypto.createHash('sha256').update(String(apiKey)).digest('hex');
  this.integracion = this.integracion || {};
  this.integracion.apiKeyHash = hash;
  this.integracion.apiKeyUltimos4 = String(apiKey).slice(-4);
  this.integracion.apiKeyGeneradaEn = new Date();
};

equipoSchema.methods.generarApiKeyIntegracion = function generarApiKeyIntegracion() {
  const apiKey = `eq_${this._id.toString().slice(-6)}_${crypto.randomBytes(24).toString('hex')}`;
  this.setApiKeyIntegracion(apiKey);
  return apiKey;
};

equipoSchema.methods.validarApiKeyIntegracion = function validarApiKeyIntegracion(apiKey) {
  const hashActual = this.integracion?.apiKeyHash;
  if (!hashActual || !apiKey) return false;

  const hashRecibido = crypto.createHash('sha256').update(String(apiKey)).digest('hex');
  const a = Buffer.from(hashActual, 'hex');
  const b = Buffer.from(hashRecibido, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

module.exports = mongoose.model('Equipo', equipoSchema);
