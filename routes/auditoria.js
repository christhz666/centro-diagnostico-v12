const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// GET /api/auditoria — Listar logs con filtros
router.get('/', authorize('admin'), async (req, res) => {
    try {
        const { accion, usuario, entidad, desde, hasta, limit = 100 } = req.query;

        const filter = {};
        if (accion) filter.accion = accion;
        if (usuario) filter.usuario = usuario;
        if (entidad) filter.entidad = entidad;
        if (desde || hasta) {
            filter.timestamp = {};
            if (desde) filter.timestamp.$gte = new Date(desde);
            if (hasta) filter.timestamp.$lte = new Date(hasta);
        }

        const logs = await AuditLog.find(filter)
            .populate('usuario', 'nombre email role')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, data: logs, total: logs.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/auditoria/resumen — Resumen de actividad
router.get('/resumen', authorize('admin'), async (req, res) => {
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const [loginsHoy, accionesHoy, ultimasAcciones] = await Promise.all([
            AuditLog.countDocuments({ accion: 'login', timestamp: { $gte: hoy } }),
            AuditLog.countDocuments({ timestamp: { $gte: hoy } }),
            AuditLog.find({}).populate('usuario', 'nombre').sort({ timestamp: -1 }).limit(20)
        ]);

        res.json({
            success: true,
            data: { loginsHoy, accionesHoy, ultimasAcciones }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
