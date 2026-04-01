const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: false
    },
    nombre: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true,
        maxlength: [50, 'El nombre no puede exceder 50 caracteres']
    },
    apellido: {
        type: String,
        required: false,
        trim: true,
        maxlength: [50, 'El apellido no puede exceder 50 caracteres']
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                // Permitir string vacío o null si no se proporciona
                if (!v || v.trim() === '') return true;
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: 'Email inválido'
        }
    },
    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
        select: false // No incluir en queries por defecto
    },
    role: {
        type: String,
        enum: ['admin', 'super-admin', 'medico', 'recepcion', 'recepcionista', 'laboratorio', 'bioanalista', 'paciente'],
        default: 'recepcion'
    },
    permissions: {
        dashboard: { type: Boolean, default: undefined },
        registro: { type: Boolean, default: undefined },
        consulta: { type: Boolean, default: undefined },
        facturas: { type: Boolean, default: undefined },
        medico: { type: Boolean, default: undefined },
        resultados: { type: Boolean, default: undefined },
        imagenologia: { type: Boolean, default: undefined },
        perfil: { type: Boolean, default: undefined },
        adminPanel: { type: Boolean, default: undefined },
        adminUsuarios: { type: Boolean, default: undefined },
        adminMedicos: { type: Boolean, default: undefined },
        adminEquipos: { type: Boolean, default: undefined },
        adminEstudios: { type: Boolean, default: undefined },
        contabilidad: { type: Boolean, default: undefined },
        campanaWhatsapp: { type: Boolean, default: undefined },
        descargarApp: { type: Boolean, default: undefined },
        deploy: { type: Boolean, default: undefined }
    },
    telefono: {
        type: String,
        trim: true
    },
    activo: {
        type: Boolean,
        default: true
    },
    especialidad: {
        type: String,
        trim: true
    },
    horarios: [{
        dia: { 
            type: String, 
            enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] 
        },
        horaInicio: String,
        horaFin: String,
        area: String
    }],
    licenciaMedica: {
        type: String,
        trim: true
    },
    firmaDigital: {
        type: String
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },
    ultimoAcceso: {
        type: Date
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual: nombre completo
userSchema.virtual('nombreCompleto').get(function () {
    return `${this.nombre} ${this.apellido}`;
});

// Pre-validate: limpiar email/username vacíos para que sparse index funcione
// Se elimina la clave directamente de _doc para asegurar que Mongoose no la serialice como null en MongoDB
// Nota: 'null' como string puede llegar de clientes antiguos o campos no sanitizados en el frontend
userSchema.pre('validate', function (next) {
    if (this.email !== undefined && (!this.email || this.email === 'null' || (typeof this.email === 'string' && this.email.trim() === ''))) {
        delete this._doc.email;
    }
    if (this.username !== undefined && (!this.username || this.username === 'null' || (typeof this.username === 'string' && this.username.trim() === ''))) {
        delete this._doc.username;
    }
    next();
});

// Pre-save: encriptar contraseña
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    if (!this.isNew) {
        this.passwordChangedAt = Date.now() - 1000;
    }

    next();
});

// Método: comparar contraseña
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Método: generar JWT
userSchema.methods.generateToken = function () {
    // Aceptar JWT_EXPIRES_IN o JWT_EXPIRE (ambas variantes del .env)
    const expiresIn = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '24h';
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET no está configurado en el servidor');
    }
    return jwt.sign(
        { id: this._id, role: this.role },
        secret,
        { expiresIn }
    );
};

// Método: verificar si cambió password después del token
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

module.exports = mongoose.model('User', userSchema);
