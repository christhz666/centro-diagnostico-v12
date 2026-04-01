const express = require('express');
const router = express.Router();
const {
    getMovimientos, createMovimiento, getResumenContable,
    getFlujoCaja, deleteMovimiento, getFacturacionDia
} = require('../controllers/contabilidadController');
const { protect, authorize } = require('../middleware/auth');
const { requireSucursal } = require('../middleware/sucursal');
const { idValidation } = require('../middleware/validators');

router.use(protect);
router.use(requireSucursal);
router.use(authorize('admin', 'recepcion', 'recepcionista'));

router.get('/resumen', getResumenContable);
router.get('/flujo-caja', getFlujoCaja);
router.get('/facturacion-dia', getFacturacionDia);

router.route('/')
    .get(getMovimientos)
    .post(createMovimiento);

router.route('/:id')
    .delete(idValidation, deleteMovimiento);

module.exports = router;
