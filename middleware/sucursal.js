const mongoose = require('mongoose');
const Sucursal = require('../models/Sucursal');

const ROLES_SIN_RESTRICCION_SUCURSAL = new Set(['admin', 'super-admin', 'medico']);

const hasBypassRole = (req) => {
    const role = req?.user?.role;
    return ROLES_SIN_RESTRICCION_SUCURSAL.has(role);
};

// Middleware para inyectar sucursalId en la petición
exports.requireSucursal = async (req, res, next) => {
    try {
        // 1. Obtener la sucursal ligada estrictamente al perfil
        let sucursalId = req.user && req.user.sucursal ? req.user.sucursal.toString() : null;

        // 2. Solo si el usuario no tiene sucursal, permitir header x-sucursal-id
        if (!sucursalId && req.headers['x-sucursal-id']) {
            sucursalId = req.headers['x-sucursal-id'];
        }

        // 3. Exonerar a Administradores y Médicos
        if (!sucursalId && hasBypassRole(req)) {
            return next();
        }

        // 4. Fallback: si no hay sucursal pero existe solo una en el sistema, usarla
        if (!sucursalId) {
            const sucursales = await Sucursal.find().limit(2).lean();
            if (sucursales.length === 1) {
                sucursalId = sucursales[0]._id.toString();
            }
        }

        // 5. Si sigue sin sucursal, rechazar
        if (!sucursalId) {
            return res.status(400).json({
                success: false,
                message: 'No tienes una sucursal física asignada en tu perfil de usuario. Contacta al administrador.'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(sucursalId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de Sucursal inválido'
            });
        }

        // Inyectar sucursal en req
        req.sucursalId = sucursalId;
        if (req.method === 'POST' || req.method === 'PUT') {
            req.body.sucursal = sucursalId;
        }

        next();
    } catch (err) {
        next(err);
    }
};

const guardByModel = (modelGetter) => async (req, res, next) => {
    try {
        if (hasBypassRole(req)) return next();

        const id = req.params?.id;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return next();

        const sucursalId = req.sucursalId;
        if (!sucursalId) {
            return res.status(400).json({
                success: false,
                message: 'Sucursal no definida en la solicitud'
            });
        }

        const Model = modelGetter();
        const doc = await Model.findById(id).select('sucursal');
        if (!doc) return next(); // el controlador devolverá 404

        if (doc.sucursal && doc.sucursal.toString() !== sucursalId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para acceder a un registro de otra sucursal'
            });
        }

        // Compatibilidad legacy: si el documento viejo no tiene sucursal,
        // permitir lectura y auto-asignar en operaciones de escritura.
        if (!doc.sucursal && ['PUT', 'PATCH', 'POST', 'DELETE'].includes(req.method)) {
            doc.sucursal = sucursalId;
            await doc.save({ validateBeforeSave: false });
        }

        return next();
    } catch (err) {
        return next(err);
    }
};

exports.guardCitaSucursal = guardByModel(() => require('../models/Cita'));
exports.guardFacturaSucursal = guardByModel(() => require('../models/Factura'));
exports.guardResultadoSucursal = guardByModel(() => require('../models/Resultado'));
