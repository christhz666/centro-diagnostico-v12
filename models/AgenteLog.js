const mongoose = require('mongoose');

const agenteLogSchema = new mongoose.Schema({
  equipo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipo',
    index: true
  },
  source: {
    type: String,
    enum: ['agente', 'server'],
    default: 'agente',
    index: true
  },
  level: {
    type: String,
    enum: ['trace', 'debug', 'info', 'warn', 'error'],
    default: 'info',
    index: true
  },
  event: {
    type: String,
    trim: true,
    index: true
  },
  message: {
    type: String,
    trim: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

agenteLogSchema.index({ equipo: 1, timestamp: -1 });

module.exports = mongoose.model('AgenteLog', agenteLogSchema);
