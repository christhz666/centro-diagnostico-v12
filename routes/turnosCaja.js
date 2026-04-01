const express = require('express');
const { getTurnoActivo, abrirTurno, cerrarTurno, getHistorialTurnos } = require('../controllers/turnoCajaController');
const { protect, authorize } = require('../middleware/auth');
const { requireSucursal } = require('../middleware/sucursal');

const router = express.Router();

router.use(protect);
router.use(requireSucursal);

router.get('/activa', getTurnoActivo);
router.post('/abrir', abrirTurno);
router.post('/cerrar', cerrarTurno);
router.get('/historial', authorize('admin', 'recepcion', 'recepcionista'), getHistorialTurnos);

module.exports = router;
