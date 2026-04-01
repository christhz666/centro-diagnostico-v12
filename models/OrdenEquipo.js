const mongoose = require('mongoose');

const ordenEquipoSchema = new mongoose.Schema({
  equipo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipo',
    required: true,
    index: true
  },
  factura: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Factura',
    index: true
  },
  cita: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cita'
  },
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente',
    index: true
  },
  pacienteNombre: {
    type: String,
    trim: true
  },
  codigoId: {
    type: Number,
    index: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'enviada', 'en_proceso', 'completada', 'error', 'cancelada'],
    default: 'pendiente',
    index: true
  },
  pruebas: [{
    estudio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Estudio'
    },
    codigo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    nombre: {
      type: String,
      trim: true
    },
    codigoEquipo: {
      type: String,
      trim: true,
      uppercase: true
    },
    completada: {
      type: Boolean,
      default: false
    },
    fechaCompletada: Date
  }],
  intentos: {
    type: Number,
    default: 0
  },
  ultimoIntento: Date,
  proximoIntento: {
    type: Date,
    default: Date.now,
    index: true
  },
  ultimoError: String,
  fechaCompletado: Date
}, {
  timestamps: true
});

ordenEquipoSchema.index({ equipo: 1, factura: 1, estado: 1 });
ordenEquipoSchema.index({ codigoId: 1, estado: 1 });

module.exports = mongoose.model('OrdenEquipo', ordenEquipoSchema);
