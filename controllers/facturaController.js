const Factura = require('../models/Factura');
const Cita = require('../models/Cita');
const Paciente = require('../models/Paciente');
const Estudio = require('../models/Estudio');
const Resultado = require('../models/Resultado');
const equipoService = require('../services/equipoService');

const ROLES_SIN_FILTRO_SUCURSAL = new Set(['admin', 'super-admin', 'medico']);
const shouldFilterBySucursal = (req) =>
    Boolean(req?.sucursalId && req?.user && !ROLES_SIN_FILTRO_SUCURSAL.has(req.user.role));

// @desc    Obtener facturas
// @route   GET /api/facturas
exports.getFacturas = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        let filter = {};

        if (shouldFilterBySucursal(req)) {
            filter.sucursal = req.sucursalId;
        }

        if (req.query.estado) filter.estado = req.query.estado;
        if (req.query.paciente) filter.paciente = req.query.paciente;
        if (req.query.tipo) filter.tipo = req.query.tipo;

        if (req.query.fechaInicio && req.query.fechaFin) {
            filter.createdAt = {
                $gte: new Date(req.query.fechaInicio),
                $lte: new Date(req.query.fechaFin)
            };
        }

        // Búsqueda
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            filter.$or = [
                { numero: searchRegex },
                { registroIdNumerico: searchRegex },
                { codigoBarras: searchRegex },
                { 'datosCliente.nombre': searchRegex },
                { 'datosCliente.cedula': searchRegex }
            ];
        }

        const [facturas, total] = await Promise.all([
            Factura.find(filter)
                .populate('paciente', 'nombre apellido cedula')
                .populate('creadoPor', 'nombre apellido')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Factura.countDocuments(filter)
        ]);

        res.json({
            success: true,
            count: facturas.length,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data: facturas
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener una factura
// @route   GET /api/facturas/:id
exports.getFactura = async (req, res, next) => {
    try {
        const query = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) {
            query.sucursal = req.sucursalId;
        }

        const factura = await Factura.findOne(query)
            .populate('paciente')
            .populate('items.estudio', 'nombre codigo')
            .populate('cita')
            .populate('creadoPor', 'nombre apellido');

        if (!factura) {
            return res.status(404).json({
                success: false,
                message: 'Factura no encontrada'
            });
        }

        res.json({ success: true, data: factura });
    } catch (error) {
        next(error);
    }
};

// @desc    Crear factura
// @route   POST /api/facturas
exports.createFactura = async (req, res, next) => {
    try {
        // Obtener datos del paciente
        const paciente = await Paciente.findById(req.body.paciente);
        if (!paciente) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado'
            });
        }

        if (shouldFilterBySucursal(req)) {
            const pacienteSucursal = paciente.sucursal ? paciente.sucursal.toString() : null;
            if (pacienteSucursal && pacienteSucursal !== req.sucursalId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No puede facturar un paciente de otra sucursal'
                });
            }

            if (!pacienteSucursal) {
                paciente.sucursal = req.sucursalId;
                await paciente.save({ validateBeforeSave: false });
            }

            req.body.sucursal = req.sucursalId;
        }

        if (req.body.cita) {
            const cita = await Cita.findById(req.body.cita).select('registroId codigoBarras sucursal');
            if (cita) {
                if (shouldFilterBySucursal(req)) {
                    const citaSucursal = cita.sucursal ? cita.sucursal.toString() : null;
                    if (citaSucursal && citaSucursal !== req.sucursalId.toString()) {
                        return res.status(403).json({
                            success: false,
                            message: 'No puede facturar una cita de otra sucursal'
                        });
                    }

                    if (!citaSucursal) {
                        cita.sucursal = req.sucursalId;
                        await cita.save({ validateBeforeSave: false });
                    }

                    req.body.sucursal = req.sucursalId;
                }

                req.body.registroIdNumerico = cita.registroId;
                req.body.codigoBarras = cita.codigoBarras;
            }
        }

        // Snapshot de datos del cliente
        req.body.datosCliente = {
            nombre: `${paciente.nombre} ${paciente.apellido}`,
            cedula: paciente.cedula,
            direccion: paciente.direccion ?
                [paciente.direccion.calle, paciente.direccion.sector].filter(Boolean).join(', ') : '',
            telefono: paciente.telefono,
            email: paciente.email
        };

        // Calcular totales
        if (req.body.items) {
            req.body.subtotal = req.body.items.reduce((sum, item) => {
                item.subtotal = (item.precioUnitario * item.cantidad) - (item.descuento || 0);
                return sum + item.subtotal;
            }, 0);

            req.body.itbis = req.body.aplicarItbis ? req.body.subtotal * 0.18 : 0;
            req.body.total = req.body.subtotal - (req.body.descuento || 0) + req.body.itbis;
        }

        req.body.creadoPor = req.user._id;

        const factura = await Factura.create(req.body);

        // Si tiene cita asociada, marcar como pagada
        if (req.body.cita) {
            await Cita.findByIdAndUpdate(req.body.cita, {
                pagado: true,
                metodoPago: req.body.metodoPago
            });
        }

        // Auto-crear registros de resultado solo cuando la factura está asociada a una cita real.
        // Evita guardar referencias inválidas (ej. usar factura._id en el campo cita).
        if (req.body.cita && req.body.items && req.body.items.length > 0 && req.body.paciente) {
            const resultadosPromises = req.body.items
                .filter(item => item.estudio) // solo items con estudio asignado
                .map(item => {
                    return Resultado.create({
                        paciente: req.body.paciente,
                        cita: req.body.cita,
                        factura: factura._id,
                        estudio: item.estudio,
                        estado: 'pendiente',
                        valores: [],
                        observaciones: 'Placeholder para captura desde equipo',
                        realizadoPor: req.user?._id
                    }).catch(err => null); // ignorar errores individuales
                });
            await Promise.all(resultadosPromises);
        }

        await factura.populate([
            { path: 'paciente', select: 'nombre apellido cedula' },
            { path: 'items.estudio', select: 'nombre codigo categoria' }
        ]);

        // Disparar sincronización con Orthanc (si aplica, en background)
        const orthancService = require('../services/orthancService');
        orthancService.enviarPacienteARayosX(factura.paciente, factura, req.body.cita, factura.items);

        // Encolar de forma persistente las pruebas con código LIS/ID para equipos bidireccionales
        equipoService.encolarOrdenesFactura(factura._id)
            .catch(err => console.error('Error encolando órdenes de equipo:', err.message));

        // Preserve _plainPassword for the response (set during pre-validate hook)
        const plainPassword = factura._plainPassword;

        res.status(201).json({
            success: true,
            message: `Factura ${factura.numero} creada exitosamente`,
            data: {
                ...factura.toObject(),
                _plainPassword: plainPassword
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Anular factura
// @route   PATCH /api/facturas/:id/anular
exports.anularFactura = async (req, res, next) => {
    try {
        const query = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) {
            query.sucursal = req.sucursalId;
        }

        const factura = await Factura.findOneAndUpdate(
            query,
            {
                estado: 'anulada',
                anuladoPor: req.user._id,
                motivoAnulacion: req.body.motivo || 'Sin motivo',
                fechaAnulacion: new Date()
            },
            { new: true }
        );

        if (!factura) {
            return res.status(404).json({
                success: false,
                message: 'Factura no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Factura anulada',
            data: factura
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Resumen financiero
// @route   GET /api/facturas/resumen
exports.getResumen = async (req, res, next) => {
    try {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay());

        const matchSucursal = shouldFilterBySucursal(req)
            ? { sucursal: req.sucursalId }
            : {};

        const [resumenMes, resumenHoy, porMetodo] = await Promise.all([
            Factura.aggregate([
                { $match: { estado: { $ne: 'anulada' }, createdAt: { $gte: inicioMes }, ...matchSucursal } },
                {
                    $group: {
                        _id: null,
                        totalFacturado: { $sum: '$total' },
                        totalCobrado: { $sum: '$montoPagado' },
                        cantidadFacturas: { $sum: 1 }
                    }
                }
            ]),
            Factura.aggregate([
                {
                    $match: {
                        estado: { $ne: 'anulada' },
                        createdAt: {
                            $gte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()),
                            $lte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
                        },
                        ...matchSucursal
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$total' },
                        cantidad: { $sum: 1 }
                    }
                }
            ]),
            Factura.aggregate([
                { $match: { estado: { $ne: 'anulada' }, createdAt: { $gte: inicioMes }, ...matchSucursal } },
                {
                    $group: {
                        _id: '$metodoPago',
                        total: { $sum: '$total' },
                        cantidad: { $sum: 1 }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            data: {
                mes: resumenMes[0] || { totalFacturado: 0, totalCobrado: 0, cantidadFacturas: 0 },
                hoy: resumenHoy[0] || { total: 0, cantidad: 0 },
                porMetodoPago: porMetodo
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Crear factura desde orden/cita
// @route   POST /api/facturas/crear-desde-orden/:ordenId
exports.crearDesdeOrden = async (req, res, next) => {
    try {
        const cita = await Cita.findById(req.params.ordenId)
            .populate('paciente')
            .populate('estudios.estudio', 'nombre codigo precio');

        if (!cita) {
            return res.status(404).json({
                success: false,
                message: 'Orden/Cita no encontrada'
            });
        }

        if (shouldFilterBySucursal(req)) {
            const citaSucursal = cita.sucursal ? cita.sucursal.toString() : null;
            if (citaSucursal && citaSucursal !== req.sucursalId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No puede crear facturas desde órdenes de otra sucursal'
                });
            }

            if (!citaSucursal) {
                cita.sucursal = req.sucursalId;
                await cita.save({ validateBeforeSave: false });
            }
        }

        const paciente = cita.paciente;
        if (!paciente) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado en la orden'
            });
        }

        if (shouldFilterBySucursal(req)) {
            const pacienteSucursal = paciente.sucursal ? paciente.sucursal.toString() : null;
            if (pacienteSucursal && pacienteSucursal !== req.sucursalId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No puede facturar pacientes de otra sucursal'
                });
            }

            if (!pacienteSucursal) {
                paciente.sucursal = req.sucursalId;
                await paciente.save({ validateBeforeSave: false });
            }
        }

        // Build invoice items from the order's studies
        const items = (cita.estudios || []).map(e => {
            const estudio = e.estudio;
            const precio = e.precio || (estudio && estudio.precio) || 0;
            const descuento = e.descuento || 0;
            return {
                descripcion: estudio ? estudio.nombre : 'Estudio',
                estudio: estudio ? estudio._id : undefined,
                cantidad: 1,
                precioUnitario: precio,
                descuento: descuento,
                subtotal: precio - descuento
            };
        });

        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const descuentoGlobal = req.body.descuento_global || 0;
        const incluirItbis = req.body.incluir_itbis || false;
        const itbis = incluirItbis ? subtotal * 0.18 : 0;
        const total = subtotal - descuentoGlobal + itbis;

        const facturaData = {
            paciente: paciente._id,
            cita: cita._id,
            datosCliente: {
                nombre: `${paciente.nombre} ${paciente.apellido}`,
                cedula: paciente.cedula,
                direccion: paciente.direccion ?
                    [paciente.direccion.calle, paciente.direccion.sector].filter(Boolean).join(', ') : '',
                telefono: paciente.telefono,
                email: paciente.email
            },
            items,
            subtotal,
            descuento: descuentoGlobal,
            itbis,
            total,
            metodoPago: req.body.forma_pago || 'efectivo',
            tipo: req.body.tipo_comprobante === 'B01' ? 'fiscal' : 'consumidor_final',
            estado: 'emitida',
            creadoPor: req.user._id,
            registroIdNumerico: cita.registroId,
            codigoBarras: cita.codigoBarras
        };

        if (shouldFilterBySucursal(req)) {
            facturaData.sucursal = req.sucursalId;
        }

        const factura = await Factura.create(facturaData);

        // Mark the order as paid
        await Cita.findByIdAndUpdate(cita._id, {
            pagado: true,
            metodoPago: facturaData.metodoPago
        });

        await factura.populate('paciente', 'nombre apellido cedula');

        // Encolar de forma persistente las pruebas con código LIS/ID para equipos bidireccionales
        equipoService.encolarOrdenesFactura(factura._id)
            .catch(err => console.error('Error encolando órdenes de equipo:', err.message));

        // Preserve _plainPassword for the response
        const plainPassword = factura._plainPassword;

        res.status(201).json({
            success: true,
            message: `Factura ${factura.numero} creada desde orden`,
            factura: {
                id: factura._id,
                numero: factura.numero,
                total: factura.total,
                estado: factura.estado
            },
            data: {
                ...factura.toObject(),
                _plainPassword: plainPassword
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Registrar pago en factura
// @route   POST /api/facturas/:id/pagar
exports.pagarFactura = async (req, res, next) => {
    try {
        const { monto, metodo_pago } = req.body;

        const montoPago = parseFloat(monto);
        if (isNaN(montoPago) || montoPago <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El monto debe ser un número positivo'
            });
        }

        const factura = await Factura.findById(req.params.id);
        if (!factura) {
            return res.status(404).json({
                success: false,
                message: 'Factura no encontrada'
            });
        }

        if (shouldFilterBySucursal(req)) {
            const facturaSucursal = factura.sucursal ? factura.sucursal.toString() : null;
            if (facturaSucursal && facturaSucursal !== req.sucursalId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No puede registrar pagos de otra sucursal'
                });
            }

            if (!facturaSucursal) {
                factura.sucursal = req.sucursalId;
            }
        }

        factura.montoPagado = (factura.montoPagado || 0) + montoPago;
        factura.metodoPago = metodo_pago || factura.metodoPago;

        if (factura.montoPagado >= factura.total) {
            factura.pagado = true;
            factura.estado = 'pagada';
        }

        await factura.save();

        res.json({
            success: true,
            message: 'Pago registrado exitosamente',
            data: factura
        });
    } catch (error) {
        next(error);
    }
};
