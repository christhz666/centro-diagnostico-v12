const express = require('express');
const router = express.Router();
const { getStats, citasGrafica, topEstudios } = require('../controllers/dashboardController');
const { getNotificaciones } = require('../controllers/notificacionController');
const { protect, authorize } = require('../middleware/auth');
const { requireSucursal } = require('../middleware/sucursal');

router.use(protect);
router.use(requireSucursal);

router.get('/stats', getStats);
router.get('/dashboard', getStats);
router.get('/notificaciones', getNotificaciones);
router.get('/citas-grafica', citasGrafica);
router.get('/top-estudios', topEstudios);

module.exports = router;
