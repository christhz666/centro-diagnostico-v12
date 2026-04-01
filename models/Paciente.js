const mongoose = require('mongoose');

const pacienteSchema = new mongoose.Schema({
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: false
    },
    // Datos personales
    nombre: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true
    },
    apellido: {
        type: String,
        required: [true, 'El apellido es requerido'],
        trim: true
    },
    cedula: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        trim: true
    },
    esMenor: {
        type: Boolean,
        default: false
    },
    fechaNacimiento: {
        type: Date,
        required: [true, 'La fecha de nacimiento es requerida']
    },
    sexo: {
        type: String,
        enum: ['M', 'F'],
        required: [true, 'El sexo es requerido']
    },
    nacionalidad: {
        type: String,
        enum: ['Dominicano', 'Haitiano', 'Otro', ''],
        default: 'Dominicano'
    },

    // Contacto
    telefono: {
        type: String,
        required: [true, 'El teléfono es requerido'],
        trim: true
    },
    telefonoSecundario: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    direccion: {
        calle: String,
        sector: String,
        ciudad: String,
        provincia: String
    },

    // Datos médicos
    tipoSangre: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
        default: ''
    },
    alergias: [{
        type: String,
        trim: true
    }],
    condicionesPreexistentes: [{
        type: String,
        trim: true
    }],
    medicamentosActuales: [{
        nombre: String,
        dosis: String
    }],

    // Seguro médico
    seguro: {
        nombre: String,
        numeroPoliza: String,
        numeroAfiliado: String,
        tipo: {
            type: String,
            enum: ['privado', 'ARS', 'SENASA', 'ninguno', ''],
            default: ''
        }
    },

    // Contacto de emergencia
    contactoEmergencia: {
        nombre: String,
        telefono: String,
        relacion: String
    },

    // Control
    activo: {
        type: Boolean,
        default: true
    },
    notas: {
        type: String,
        trim: true
    },
    registradoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});


pacienteSchema.pre('validate', function (next) {
    // Generar cedula única para menores usando ObjectId
    // Tratar 'MENOR DE EDAD' y cadenas vacías como sin cédula
    const cedulaEsMenor = !this.cedula ||
        this.cedula === 'MENOR DE EDAD' ||
        (typeof this.cedula === 'string' && this.cedula.trim() === '');
    if (this.esMenor && cedulaEsMenor) {
        // Menor de edad con cédula vacía o placeholder: generar cédula única
        this.cedula = `MENOR-${new mongoose.Types.ObjectId()}`;
    } else if (!this.esMenor && this.cedula === 'MENOR DE EDAD') {
        // Cedula es 'MENOR DE EDAD' pero esMenor no fue marcado: auto-marcar y generar cédula
        this.esMenor = true;
        this.cedula = `MENOR-${new mongoose.Types.ObjectId()}`;
    }
    // Limpiar email vacío para evitar problemas con índices
    if (this.email !== undefined && (!this.email || (typeof this.email === 'string' && this.email.trim() === '') || this.email === 'null')) {
        this.email = undefined;
    }
    next();
});

// Virtual: nombre completo
pacienteSchema.virtual('nombreCompleto').get(function () {
    return `${this.nombre} ${this.apellido}`;
});

// Virtual: edad
pacienteSchema.virtual('edad').get(function () {
    if (!this.fechaNacimiento) return null;
    const hoy = new Date();
    const nacimiento = new Date(this.fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    return edad;
});

// Virtual: citas del paciente
pacienteSchema.virtual('citas', {
    ref: 'Cita',
    localField: '_id',
    foreignField: 'paciente'
});

// Índices para búsqueda rápida
pacienteSchema.index({ nombre: 'text', apellido: 'text' });
pacienteSchema.index({ 'seguro.nombre': 1 });

module.exports = mongoose.model('Paciente', pacienteSchema);
