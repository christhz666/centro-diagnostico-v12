const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    nombreUsuario: String,
    accion: {
        type: String,
        required: true,
        enum: [
            'login', 'logout',
            'crear_factura', 'anular_factura', 'pagar_factura', 'imprimir_factura',
            'crear_paciente', 'editar_paciente',
            'crear_resultado', 'editar_resultado', 'validar_resultado', 'imprimir_resultado',
            'crear_cita', 'editar_cita', 'cancelar_cita',
            'crear_movimiento', 'eliminar_movimiento',
            'firmar_resultado',
            'acceso_paciente',
            'exportar_datos',
            'otro'
        ]
    },
    entidad: {
        type: String,  // 'Factura', 'Paciente', 'Resultado', etc.
    },
    entidadId: {
        type: String
    },
    detalles: {
        type: String
    },
    ip: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

// Índices para búsqueda eficiente
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ usuario: 1, timestamp: -1 });
auditLogSchema.index({ accion: 1, timestamp: -1 });
auditLogSchema.index({ entidad: 1, entidadId: 1 });

// TTL: logs se eliminan después de 1 año
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Helper estático para registrar un log fácilmente
auditLogSchema.statics.registrar = async function (data) {
    try {
        return await this.create(data);
    } catch (e) {
        console.error('Error registrando audit log:', e.message);
    }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
