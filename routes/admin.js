const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
    getUsuarios,
    getUsuario,
    createUsuario,
    updateUsuario,
    toggleUsuario,
    resetPassword,
    getMedicos,
    getRoles,
    getUsuariosParaSyncOffline,
    getEstadisticasMedicos
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { registerValidation, idValidation } = require('../middleware/validators');

// Rutas Públicas (Offline Sync)
// Importante: Va ANTES de router.use(protect) para la carga inicial App-Offline
router.get('/usuarios/offline-sync', (req, res, next) => {
    const expected = process.env.OFFLINE_SYNC_KEY;
    const provided = req.headers['x-offline-sync-key'];

    // Si no está configurada la llave en servidor, deshabilitar endpoint por seguridad
    if (!expected) {
        return res.status(503).json({
            success: false,
            message: 'Sincronización offline no configurada en el servidor'
        });
    }

    if (!provided || typeof provided !== 'string') {
        return res.status(401).json({
            success: false,
            message: 'No autorizado para sincronización offline'
        });
    }

    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    const isValid = expectedBuf.length === providedBuf.length
        && crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!isValid) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado para sincronización offline'
        });
    }

    return getUsuariosParaSyncOffline(req, res, next);
});

router.use(protect);
router.use(authorize('admin', 'super-admin'));

router.get('/medicos', getMedicos);
router.get('/estadisticas-medicos', getEstadisticasMedicos);
router.get('/roles', getRoles);


// Rutas de Usuarios
router.route('/usuarios')
    .get(protect, getUsuarios) // Added protect
    .post(protect, authorize('admin', 'super-admin'), createUsuario); // Modified post route

router.route('/usuarios/:id')
    .get(idValidation, getUsuario)
    .put(idValidation, updateUsuario);

router.patch('/usuarios/:id/toggle', idValidation, toggleUsuario);
router.patch('/usuarios/:id/reset-password', idValidation, resetPassword);

module.exports = router;
