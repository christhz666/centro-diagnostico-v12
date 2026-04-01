const express = require('express');
const router = express.Router();
const {
    getFacturas, getFactura, createFactura,
    anularFactura, getResumen, crearDesdeOrden, pagarFactura
} = require('../controllers/facturaController');
const { protect, authorize } = require('../middleware/auth');
const { requireSucursal } = require('../middleware/sucursal');
const { idValidation } = require('../middleware/validators');

router.use(protect);
router.use(requireSucursal);

router.get('/resumen', authorize('admin'), getResumen);

router.post('/crear-desde-orden/:ordenId', authorize('admin', 'recepcion', 'recepcionista'), crearDesdeOrden);

router.route('/')
    .get(getFacturas)
    .post(authorize('admin', 'recepcion', 'recepcionista'), createFactura);

router.route('/:id')
    .get(idValidation, getFactura);

router.post('/:id/pagar', idValidation, authorize('admin', 'recepcion', 'recepcionista'), pagarFactura);
router.patch('/:id/anular', idValidation, authorize('admin'), anularFactura);

module.exports = router;
