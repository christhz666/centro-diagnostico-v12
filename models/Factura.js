const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const contadorFacturaSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const ContadorFactura = mongoose.models.ContadorFactura || mongoose.model('ContadorFactura', contadorFacturaSchema);

const facturaSchema = new mongoose.Schema({
    numero: {
        type: String
    },
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: false // Temporalmente false para no romper datos viejos en script
    },
    tipo: {
        type: String,
        enum: ['fiscal', 'consumidor_final', 'credito_fiscal', 'nota_credito'],
        default: 'consumidor_final'
    },
    paciente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Paciente',
        required: true
    },
    cita: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cita'
    },
    datosCliente: {
        nombre: String,
        cedula: String,
        rnc: String,
        direccion: String,
        telefono: String,
        email: String
    },
    items: [{
        descripcion: String,
        estudio: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Estudio'
        },
        cantidad: { type: Number, default: 1 },
        precioUnitario: Number,
        descuento: { type: Number, default: 0 },
        subtotal: Number
    }],
    subtotal: { type: Number, required: true, default: 0 },
    descuento: { type: Number, default: 0 },
    itbis: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    metodoPago: {
        type: String,
        enum: ['efectivo', 'tarjeta', 'transferencia', 'cheque', 'seguro', 'mixto'],
        default: 'efectivo'
    },
    pagado: { type: Boolean, default: false },
    montoPagado: { type: Number, default: 0 },
    estado: {
        type: String,
        enum: ['borrador', 'emitida', 'pagada', 'anulada'],
        default: 'emitida'
    },
    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    anuladoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    motivoAnulacion: String,
    fechaAnulacion: Date,
    notas: String,

    registroIdNumerico: {
        type: String
    },
    // ID corto numérico para máquinas de laboratorio
    codigoId: {
        type: Number,
        unique: true,
        sparse: true,
        index: true
    },
    codigoBarras: {
        type: String
    },
    // QR único por factura para acceso a resultados
    codigoQR: {
        type: String,
        unique: true,
        sparse: true
    },
    // Credenciales de acceso del paciente generadas automáticamente
    pacienteUsername: {
        type: String
    },
    pacientePassword: {
        type: String
    },
    pacientePasswordHash: {
        type: String,
        select: false
    }
}, {
    timestamps: true
});

// Auto-generar número de factura ANTES de validar
facturaSchema.pre('validate', async function (next) {
    try {
        if (!this.numero) {
            const contadorId = this.sucursal ? `factura_seq_${this.sucursal}` : 'factura_seq_global';
            const contador = await ContadorFactura.findByIdAndUpdate(
                contadorId,
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            const sequence = String(contador.seq).padStart(6, '0');

            // ID corto y universal para LIS
            this.numero = `FAC-${sequence}`;
        }

        if (!this.codigoBarras) {
            // Generar código de barras único basado en timestamp corto y random
            const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
            this.codigoBarras = `${Date.now().toString().slice(-6)}${randomStr}`;
        }

        // Generar codigoId usando el mismo número de factura
        if (!this.codigoId && this.numero) {
            // Extraer parte numérica del número de factura para usar como ID
            const match = this.numero.match(/(\d+)/);
            if (match) {
                this.codigoId = parseInt(match[1], 10);
            }
        }
        if (!this.codigoId) {
            // Fallback: usar secuencia incremental
            const ultimaFacturaId = await mongoose.model('Factura').findOne({ codigoId: { $exists: true } }).sort({ codigoId: -1 });
            if (ultimaFacturaId && ultimaFacturaId.codigoId) {
                this.codigoId = ultimaFacturaId.codigoId + 1;
                if (this.codigoId > 99999) {
                    this.codigoId = 1000;
                }
            } else {
                this.codigoId = 1000;
            }
        }

        // Guardar ID numérico para referencia
        if (!this.registroIdNumerico && this.numero) {
            const match = this.numero.match(/(\d+)/);
            if (match) this.registroIdNumerico = match[1];
        }

        // Generar código QR único por factura
        if (!this.codigoQR) {
            const crypto = require('crypto');
            this.codigoQR = crypto.randomBytes(8).toString('hex').toUpperCase();
        }

        // Generar credenciales del paciente para ver resultados
        // SOLO para facturas NUEVAS — no regenerar en updates
        // Usuario = nombre del paciente (solo letras, minúsculas)
        // Clave = apellido del paciente (solo letras, minúsculas)
        if (this.isNew && this.paciente) {
            const Paciente = mongoose.model('Paciente');
            const pac = await Paciente.findById(this.paciente);
            if (pac) {
                // Username: SOLO el nombre del paciente
                const nombre = (pac.nombre || '').trim().toLowerCase().replace(/[^a-záéíóúñü]/g, '');
                this.pacienteUsername = nombre || 'paciente';

                // Password: SOLO el apellido del paciente (guardado en texto plano)
                const apellido = (pac.apellido || '').trim().toLowerCase().replace(/[^a-záéíóúñü]/g, '');
                this.pacientePassword = apellido || 'paciente';

                // Guardar hash para autenticación segura (manteniendo texto plano para impresión)
                const salt = await bcrypt.genSalt(12);
                this.pacientePasswordHash = await bcrypt.hash(this.pacientePassword, salt);

                // Guardar texto plano para impresión
                this._plainPassword = this.pacientePassword;
            }
        }
    } catch (e) {
        console.error('Error en pre-validate de Factura:', e.message);
    }
    next();
});

// Método para comparar la contraseña del paciente
// Soporta tanto texto plano (nuevo) como bcrypt hasheado (viejo)
facturaSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.pacientePassword && !this.pacientePasswordHash) return false;
    const candidate = (candidatePassword || '').trim().toLowerCase().replace(/[^a-záéíóúñü]/g, '');

    // Nuevo formato (preferido): hash dedicado
    if (this.pacientePasswordHash) {
        return bcrypt.compare(candidate, this.pacientePasswordHash);
    }

    // Formato legacy en texto plano: convertir a hash de forma transparente
    if (this.pacientePassword && !this.pacientePassword.startsWith('$2')) {
        const salt = await bcrypt.genSalt(12);
        const legacyHash = await bcrypt.hash(this.pacientePassword, salt);

        // Persistir hash para futuras autenticaciones
        this.pacientePasswordHash = legacyHash;
        try {
            await this.save({ validateBeforeSave: false });
        } catch (_) {
            // Si falla persistencia, al menos validar en memoria para no romper login
        }

        return bcrypt.compare(candidate, legacyHash);
    }

    // Si es un hash bcrypt (formato viejo), usar bcrypt.compare
    return bcrypt.compare(candidate, this.pacientePassword);
};

// Migración transparente: si existe pacientePassword en texto plano, crear hash en save
facturaSchema.pre('save', async function (next) {
    if (!this.pacientePasswordHash && this.pacientePassword) {
        const salt = await bcrypt.genSalt(12);
        this.pacientePasswordHash = await bcrypt.hash(this.pacientePassword, salt);
    }
    next();
});

facturaSchema.index({ numero: 1, sucursal: 1 }, { unique: true });
facturaSchema.index({ paciente: 1 });
facturaSchema.index({ createdAt: -1 });
facturaSchema.index({ registroIdNumerico: 1 });
facturaSchema.index({ codigoBarras: 1 });

module.exports = mongoose.model('Factura', facturaSchema);
