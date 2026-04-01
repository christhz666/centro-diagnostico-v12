const mongoose = require('mongoose');
const User = require('../models/User');

const ALLOWED_PERMISSION_KEYS = [
    'dashboard', 'registro', 'consulta', 'facturas', 'medico', 'resultados', 'imagenologia',
    'perfil', 'adminPanel', 'adminUsuarios', 'adminMedicos', 'adminEquipos', 'adminEstudios',
    'contabilidad', 'campanaWhatsapp', 'descargarApp', 'deploy'
];

const normalizePermissions = (input) => {
    const src = (input && typeof input === 'object') ? input : {};
    return ALLOWED_PERMISSION_KEYS.reduce((acc, key) => {
        if (src[key] !== undefined) acc[key] = Boolean(src[key]);
        return acc;
    }, {});
};

// @desc    Obtener roles disponibles
// @route   GET /api/admin/roles
exports.getRoles = async (req, res, next) => {
    res.json([
        { value: 'super-admin', label: 'Super Administrador' },
        { value: 'admin', label: 'Administrador' },
        { value: 'medico', label: 'Médico' },
        { value: 'bioanalista', label: 'Bioanalista' },
        { value: 'recepcionista', label: 'Recepcionista' },
        { value: 'recepcion', label: 'Recepcionista' },
        { value: 'laboratorio', label: 'Laboratorista' },
        { value: 'paciente', label: 'Paciente' }
    ]);
};

// @desc    Obtener todos los usuarios
// @route   GET /api/admin/usuarios
exports.getUsuarios = async (req, res, next) => {
    try {
        let filter = {};

        if (req.query.role) filter.role = req.query.role;
        if (req.query.activo !== undefined) filter.activo = req.query.activo === 'true';

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            filter.$or = [
                { nombre: searchRegex },
                { apellido: searchRegex },
                { email: searchRegex }
            ];
        }

        const usuarios = await User.find(filter)
            .select('-password')
            .populate('sucursal', 'nombre codigo')
            .sort('-createdAt');

        res.json({
            success: true,
            count: usuarios.length,
            data: usuarios
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener un usuario
// @route   GET /api/admin/usuarios/:id
exports.getUsuario = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.params.id).select('-password');

        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({ success: true, data: usuario });
    } catch (error) {
        next(error);
    }
};

// @desc    Crear usuario (admin)
// @route   POST /api/admin/usuarios
exports.createUsuario = async (req, res, next) => {
    try {
        const body = req.body;
        // Construir objeto solo con campos válidos (evitar email/username "null" o vacíos)
        // Username: solo incluir si es válido
        const userVal = body.username;
        const usernameClean = (userVal && userVal !== 'null' && typeof userVal === 'string' && userVal.trim())
            ? userVal.trim().toLowerCase()
            : null;

        // Nombre: si no se proporciona, derivar del username o usar 'Usuario' como fallback
        const nombreClean = (body.nombre && typeof body.nombre === 'string' && body.nombre.trim())
            ? body.nombre.trim()
            : (usernameClean || 'Usuario');

        // Apellido: opcional, usar cadena vacía si no se proporciona
        const apellidoClean = (body.apellido && typeof body.apellido === 'string' && body.apellido.trim())
            ? body.apellido.trim()
            : undefined;

        const data = {
            nombre: nombreClean,
            apellido: apellidoClean,
            password: body.password,
            role: body.role || body.rol || 'recepcion',
            telefono: body.telefono || undefined,
            especialidad: body.especialidad || undefined
        };
        if (body.permissions !== undefined) {
            data.permissions = normalizePermissions(body.permissions);
        }
        // Email: solo incluir si es válido (no vacío, no "null")
        const emailVal = body.email;
        if (emailVal && emailVal !== 'null' && typeof emailVal === 'string' && emailVal.trim()) {
            data.email = emailVal.trim().toLowerCase();
        }
        // Username
        if (usernameClean) {
            data.username = usernameClean;
        }
        // Auto-generar username si no se proporcionó ni username ni email
        if (!data.username && !data.email) {
            let base = ((data.nombre || '') + (data.apellido || '')).toLowerCase().replace(/[^a-záéíóúñü]/g, '');
            if (!base) base = 'usuario';
            // Buscar usernames existentes con el mismo prefijo para determinar sufijo
            const existentes = await User.find({ username: new RegExp(`^${base}\\d*$`) }).select('username').lean();
            const usados = new Set(existentes.map(u => u.username));
            let candidate = base;
            let suffix = 1;
            while (usados.has(candidate)) {
                candidate = base + suffix;
                suffix++;
            }
            data.username = candidate;
        }
        // Sucursal: solo si es ObjectId válido
        if (body.sucursal && body.sucursal !== '' && body.sucursal !== 'null' && mongoose.Types.ObjectId.isValid(body.sucursal)) {
            data.sucursal = body.sucursal;
        }

        const usuario = await User.create(data);

        res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente',
            data: {
                id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                role: usuario.role,
                activo: usuario.activo
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Actualizar usuario
// @route   PUT /api/admin/usuarios/:id
exports.updateUsuario = async (req, res, next) => {
    try {
        // No permitir cambiar password desde aquí
        delete req.body.password;
        // Normalizar rol/role
        if (req.body.rol && !req.body.role) {
            req.body.role = req.body.rol;
        }
        delete req.body.rol;

        // Evitar que Mongoose registre strings vacíos o "null" en índices Unique Sparse
        if (req.body.email === undefined || req.body.email === null || req.body.email === 'null' ||
            (typeof req.body.email === 'string' && req.body.email.trim() === '')) {
            delete req.body.email;
        } else {
            req.body.email = req.body.email.trim();
        }
        if (req.body.username === undefined || req.body.username === null || req.body.username === 'null' ||
            (typeof req.body.username === 'string' && req.body.username.trim() === '')) {
            delete req.body.username;
        } else if (typeof req.body.username === 'string') {
            req.body.username = req.body.username.trim();
        }
        if (req.body.sucursal === '' || req.body.sucursal === 'null') {
            req.body.sucursal = null;
        }
        if (req.body.permissions !== undefined) {
            req.body.permissions = normalizePermissions(req.body.permissions);
        }

        const usuario = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).select('-password');

        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Usuario actualizado',
            data: usuario
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Activar/Desactivar usuario
// @route   PATCH /api/admin/usuarios/:id/toggle
exports.toggleUsuario = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.params.id);

        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // No permitir desactivarse a sí mismo
        if (usuario._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'No puede desactivar su propia cuenta'
            });
        }

        usuario.activo = !usuario.activo;
        await usuario.save({ validateBeforeSave: false });

        res.json({
            success: true,
            message: `Usuario ${usuario.activo ? 'activado' : 'desactivado'}`,
            data: { activo: usuario.activo }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reset password de usuario
// @route   PATCH /api/admin/usuarios/:id/reset-password
exports.resetPassword = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.params.id);

        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword.trim() : '';
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Debe enviar una nueva contraseña de al menos 6 caracteres'
            });
        }

        usuario.password = newPassword;
        await usuario.save();

        res.json({
            success: true,
            message: 'Contraseña reseteada exitosamente'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener médicos
// @route   GET /api/admin/medicos
exports.getMedicos = async (req, res, next) => {
    try {
        const medicos = await User.find({ role: 'medico', activo: true })
            .select('nombre apellido especialidad licenciaMedica email telefono horarios')
            .sort('apellido nombre');

        res.json({
            success: true,
            count: medicos.length,
            data: medicos
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener usuarios para Sync Offline (solo activos, sin passwords)
// @route   GET /api/admin/usuarios/offline-sync
exports.getUsuariosParaSyncOffline = async (req, res, next) => {
    try {
        const usuarios = await User.find({ activo: true })
            .select('nombre apellido cedula username hash_offline role sucursal');

        res.json({
            success: true,
            count: usuarios.length,
            data: usuarios
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener estadísticas de productividad de médicos
// @route   GET /api/admin/estadisticas-medicos
exports.getEstadisticasMedicos = async (req, res, next) => {
    try {
        const Cita = require('../models/Cita');
        const Estudio = require('../models/Estudio');
        
        let matchStage = { medico: { $exists: true, $ne: null } };
        if (req.query.fechaInicio && req.query.fechaFin) {
            matchStage.fecha = { 
                $gte: new Date(req.query.fechaInicio),
                $lte: new Date(req.query.fechaFin)
            };
        }

        const stats = await Cita.aggregate([
            { $match: matchStage },
            { $unwind: "$estudios" },
            { 
               $group: { 
                  _id: { medico: "$medico", estudio: "$estudios.estudio" },
                  pacientes: { $addToSet: "$paciente" },
                  totalEstudios: { $sum: 1 }
               } 
            },
            {
               $group: {
                  _id: "$_id.medico",
                  estudiosRealizados: {
                      $push: {
                          estudioId: "$_id.estudio",
                          cantidad: "$totalEstudios"
                      }
                  },
                  totalPacientes: { $sum: { $size: "$pacientes" } },
                  totalEstudiosGlobal: { $sum: "$totalEstudios" }
               }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "medicoInfo"
                }
            },
            { $unwind: "$medicoInfo" },
            {
                $project: {
                    medicoId: "$_id",
                    nombre: "$medicoInfo.nombre",
                    apellido: "$medicoInfo.apellido",
                    especialidad: "$medicoInfo.especialidad",
                    totalPacientes: 1,
                    totalEstudios: "$totalEstudiosGlobal",
                    estudiosRealizados: 1
                }
            }
        ]);
        
        // Populando estudios
        const statsConEstudios = await Promise.all(stats.map(async (stat) => {
            const estudiosDetails = await Promise.all(stat.estudiosRealizados.map(async (e) => {
                const est = await Estudio.findById(e.estudioId).select('nombre');
                return {
                    nombre: est ? est.nombre : 'Estudio Desconocido',
                    cantidad: e.cantidad
                };
            }));
            return {
                _id: stat.medicoId,
                nombre: stat.nombre,
                apellido: stat.apellido,
                especialidad: stat.especialidad,
                totalPacientes: stat.totalPacientes,
                totalEstudios: stat.totalEstudios,
                estudios: estudiosDetails
            };
        }));

        res.json({ success: true, count: statsConEstudios.length, data: statsConEstudios });
    } catch (error) {
        next(error);
    }
};
