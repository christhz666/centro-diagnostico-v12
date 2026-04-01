const express = require('express');
const router = express.Router();
const {
    getResultados,
    getResultado,
    getResultadosPorPaciente,
    getResultadosPorCedula,
    getResultadosPorQR,
    accesoQR,
    accesoPaciente,
    createResultado,
    updateResultado,
    validarResultado,
    deleteResultado,
    marcarImpreso
} = require('../controllers/resultadoController');
const { protect } = require('../middleware/auth');
const { requireSucursal } = require('../middleware/sucursal');

// Rutas públicas (para QR)
router.get('/cedula/:cedula', getResultadosPorCedula);
router.get('/qr/:codigoQR', getResultadosPorQR);
router.get('/acceso-qr/:codigoQR', accesoQR);
router.post('/acceso-paciente', accesoPaciente);

// Rutas protegidas
router.use(protect);
router.use(requireSucursal);

router.get('/', getResultados);
router.get('/paciente/:pacienteId', getResultadosPorPaciente);
router.get('/:id', getResultado);
router.post('/', createResultado);
router.put('/:id', updateResultado);
router.put('/:id/validar', validarResultado);
router.put('/:id/imprimir', marcarImpreso);
router.delete('/:id', deleteResultado);

module.exports = router;
