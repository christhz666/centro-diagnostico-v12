const Resultado = require('../models/Resultado');
const Cita = require('../models/Cita');
const Paciente = require('../models/Paciente');
const Factura = require('../models/Factura');
const bcrypt = require('bcryptjs');

// Estados de pago constantes
const ESTADOS_PAGO_PENDIENTE = ['borrador', 'emitida'];

const ROLES_SIN_FILTRO_SUCURSAL = new Set(['admin', 'super-admin', 'medico']);
const shouldFilterBySucursal = (req) =>
    Boolean(req?.sucursalId && req?.user && !ROLES_SIN_FILTRO_SUCURSAL.has(req.user.role));


const PLANTILLAS_REPORTE_IMAGEN = {
    radiografia_general: {
        id: 'radiografia_general',
        nombre: 'Radiografía General',
        secciones: ['Tecnica', 'Hallazgos', 'Impresion diagnostica', 'Recomendaciones']
    },
    torax: {
        id: 'torax',
        nombre: 'Radiografía de Tórax',
        secciones: ['Tecnica', 'Hallazgos pulmonares', 'Cardiomediastino', 'Impresion diagnostica']
    },
    extremidades: {
        id: 'extremidades',
        nombre: 'Radiografía de Extremidades',
        secciones: ['Proyecciones', 'Hallazgos oseos', 'Partes blandas', 'Impresion diagnostica']
    },
    mamografia: {
        id: 'mamografia',
        nombre: 'Mamografía',
        secciones: ['Composicion mamaria', 'Hallazgos', 'Clasificacion BI-RADS', 'Recomendaciones']
    }
};

// @desc    Obtener resultados (con filtros)
// @route   GET /api/resultados
exports.getResultados = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        let filter = {};

        if (shouldFilterBySucursal(req)) {
            filter.sucursal = req.sucursalId;
        }

        if (req.query.paciente || req.query.pacienteId) filter.paciente = req.query.paciente || req.query.pacienteId;
        if (req.query.cita) filter.cita = req.query.cita;
        if (req.query.estado) filter.estado = req.query.estado;
        if (req.query.estudio) filter.estudio = req.query.estudio;
        if (req.query.codigoMuestra) filter.codigoMuestra = req.query.codigoMuestra;

        if (req.query.tipo === 'laboratorio') {
            const Estudio = require('../models/Estudio');
            const estudiosLab = await Estudio.find({
                $or: [
                    { categoria: /laboratorio|hematolog|quimica|orina|coagulacion|inmunolog|microbiolog/i },
                    { codigo: /^LAB/i }
                ]
            }).select('_id');
            const idsLab = estudiosLab.map(e => e._id);
            if (!filter.estudio) {
                filter.estudio = { $in: idsLab };
            }
        }

        const [resultados, total] = await Promise.all([
            Resultado.find(filter)
                .populate('paciente', 'nombre apellido cedula')
                .populate('estudio', 'nombre codigo categoria')
                .populate('medico', 'nombre apellido especialidad')
                .populate('realizadoPor', 'nombre apellido')
                .populate('validadoPor', 'nombre apellido')
                .populate('firmadoPor', 'nombre apellido')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Resultado.countDocuments(filter)
        ]);

        res.json({
            success: true,
            count: resultados.length,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data: resultados
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener resultados por paciente
// @route   GET /api/resultados/paciente/:pacienteId
exports.getResultadosPorPaciente = async (req, res, next) => {
    try {
        const resultados = await Resultado.find({
            paciente: req.params.pacienteId,
            estado: { $ne: 'anulado' },
            ...(shouldFilterBySucursal(req) ? { sucursal: req.sucursalId } : {})
        })
            .populate('estudio', 'nombre codigo categoria')
            .populate('medico', 'nombre apellido especialidad')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido')
            .sort('-createdAt');

        res.json({
            success: true,
            count: resultados.length,
            data: resultados
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener resultados por cédula (para QR)
// @route   GET /api/resultados/cedula/:cedula
exports.getResultadosPorCedula = async (req, res, next) => {
    try {
        const paciente = await Paciente.findOne({ cedula: req.params.cedula });

        if (!paciente) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado'
            });
        }

        const resultados = await Resultado.find({
            paciente: paciente._id,
            estado: { $in: ['completado', 'entregado'] }
        })
            .populate('estudio', 'nombre codigo categoria')
            .populate('medico', 'nombre apellido especialidad')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido')
            .sort('-createdAt');

        res.json({
            success: true,
            paciente: {
                _id: paciente._id,
                nombre: paciente.nombre,
                apellido: paciente.apellido,
                cedula: paciente.cedula,
                fechaNacimiento: paciente.fechaNacimiento,
                sexo: paciente.sexo,
                nacionalidad: paciente.nacionalidad
            },
            count: resultados.length,
            data: resultados
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener un resultado por código de muestra
// @route   GET /api/resultados/muestra/:codigoMuestra
exports.getResultadoPorCodigo = async (req, res, next) => {
    try {
        let codigoMuestra = req.params.codigoMuestra;

        // Si el código es solo números, intentar buscar con L primero (para laboratorio)
        if (/^\d+$/.test(codigoMuestra)) {
            const codigoConL = `L${codigoMuestra}`;
            const resultadoLabFilter = { codigoMuestra: codigoConL };
            if (shouldFilterBySucursal(req)) resultadoLabFilter.sucursal = req.sucursalId;

            const resultadoLab = await Resultado.findOne(resultadoLabFilter)
                .populate('paciente')
                .populate('estudio')
                .populate('medico', 'nombre apellido especialidad licenciaMedica')
                .populate('realizadoPor', 'nombre apellido')
                .populate('validadoPor', 'nombre apellido')
                .populate('firmadoPor', 'nombre apellido');

            if (resultadoLab) {
                return res.json({ success: true, data: resultadoLab });
            }
        }

        // Buscar con el código tal cual
        const resultadoFilter = { codigoMuestra: codigoMuestra };
        if (shouldFilterBySucursal(req)) resultadoFilter.sucursal = req.sucursalId;

        const resultado = await Resultado.findOne(resultadoFilter)
            .populate('paciente')
            .populate('estudio')
            .populate('medico', 'nombre apellido especialidad licenciaMedica')
            .populate('realizadoPor', 'nombre apellido')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido');

        if (!resultado) {
            return res.status(404).json({
                success: false,
                message: 'Resultado no encontrado con código: ' + req.params.codigoMuestra
            });
        }

        res.json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener un resultado
// @route   GET /api/resultados/:id
exports.getResultado = async (req, res, next) => {
    try {
        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultado = await Resultado.findOne(queryResultado)
            .populate('paciente')
            .populate('estudio')
            .populate('medico', 'nombre apellido especialidad licenciaMedica')
            .populate('realizadoPor', 'nombre apellido')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido');

        if (!resultado) {
            return res.status(404).json({
                success: false,
                message: 'Resultado no encontrado'
            });
        }

        res.json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
};

// @desc    Crear resultado
// @route   POST /api/resultados
exports.createResultado = async (req, res, next) => {
    try {
        req.body.realizadoPor = req.user?._id;
        if (shouldFilterBySucursal(req)) {
            req.body.sucursal = req.sucursalId;
        }
        if (req.body.valores !== undefined) {
            req.body.valores = normalizarValoresResultado(req.body.valores);
        }

        if (req.body.estado === 'completado') {
            if (!req.user?.firmaDigital) {
                return res.status(400).json({
                    success: false,
                    message: MENSAJE_FIRMA_REQUERIDA
                });
            }

            req.body.validadoPor = req.user?._id;
            req.body.fechaValidacion = new Date();
            req.body.firmaDigital = req.user.firmaDigital;
            req.body.firmadoPor = req.user?._id;
            req.body.fechaFirma = new Date();
        }

        const resultado = await Resultado.create(req.body);

        await resultado.populate('paciente', 'nombre apellido');
        await resultado.populate('estudio', 'nombre codigo');

        res.status(201).json({
            success: true,
            message: 'Resultado creado exitosamente',
            data: resultado
        });
    } catch (error) {
        next(error);
    }
};

// ─── Helper: verificar deuda pendiente de una factura ────────────────────────
const _getMontoPendiente = async (facturaId) => {
    if (!facturaId) return 0;
    const factura = await Factura.findById(facturaId).select('total montoPagado pagado estado');
    if (!factura || factura.estado === 'anulada') return 0;
    if (factura.pagado || factura.estado === 'pagada') return 0;
    return Math.max(0, (factura.total || 0) - (factura.montoPagado || 0));
};

const MENSAJE_FIRMA_REQUERIDA = 'Debe registrar su firma en Mi Perfil antes de completar o validar resultados.';

const normalizarTexto = (valor = '') =>
    String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const normalizarEstadoValor = (estadoRaw = '') => {
    const estado = normalizarTexto(estadoRaw);
    if (!estado) return '';
    if (estado.includes('normal')) return 'normal';
    if (estado.includes('alto')) return estado.includes('crit') ? 'critico' : 'alto';
    if (estado.includes('bajo')) return estado.includes('crit') ? 'critico' : 'bajo';
    if (estado.includes('crit')) return 'critico';
    return '';
};

const normalizarValoresResultado = (valores = []) => {
    if (!Array.isArray(valores)) return [];
    return valores.map((valor = {}) => ({
        ...valor,
        estado: normalizarEstadoValor(valor.estado)
    }));
};

// @desc    Actualizar resultado
// @route   PUT /api/resultados/:id
exports.updateResultado = async (req, res, next) => {
    try {
        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultadoActual = await Resultado.findOne(queryResultado).select('firmaDigital');

        if (!resultadoActual) {
            return res.status(404).json({
                success: false,
                message: 'Resultado no encontrado'
            });
        }

        // Whitelist de campos permitidos — médicos/lab pueden editar, pero no campos de auditoría
        const allowedFields = [
            'valores', 'interpretacion', 'conclusion', 'estado',
            'codigoMuestra', 'notas', 'medico', 'imagenologia'
        ];
        const update = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) update[field] = req.body[field];
        });

        if (update.valores !== undefined) {
            update.valores = normalizarValoresResultado(update.valores);
        }

        if (update.estado === 'completado') {
            if (!req.user?.firmaDigital) {
                return res.status(400).json({
                    success: false,
                    message: MENSAJE_FIRMA_REQUERIDA
                });
            }

            update.validadoPor = req.user._id;
            update.fechaValidacion = new Date();
            update.firmaDigital = req.user.firmaDigital;
            update.firmadoPor = req.user._id;
            update.fechaFirma = new Date();
        } else if (!resultadoActual.firmaDigital && req.user?.firmaDigital && update.estado === 'entregado') {
            update.firmaDigital = req.user.firmaDigital;
            update.firmadoPor = req.user._id;
            update.fechaFirma = new Date();
        }

        const resultado = await Resultado.findOneAndUpdate(
            queryResultado,
            update,
            { new: true, runValidators: true }
        )
            .populate('paciente', 'nombre apellido')
            .populate('estudio', 'nombre codigo')
            .populate('validadoPor', 'nombre apellido especialidad')
            .populate('firmadoPor', 'nombre apellido especialidad');

        res.json({
            success: true,
            message: 'Resultado actualizado',
            data: resultado
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Validar resultado
// @route   PUT /api/resultados/:id/validar
exports.validarResultado = async (req, res, next) => {
    try {
        if (!req.user?.firmaDigital) {
            return res.status(400).json({
                success: false,
                message: MENSAJE_FIRMA_REQUERIDA
            });
        }

        const update = {
            estado: 'completado',
            validadoPor: req.user?._id,
            fechaValidacion: new Date(),
            interpretacion: req.body.interpretacion,
            conclusion: req.body.conclusion
        };

        if (req.user?.firmaDigital) {
            update.firmaDigital = req.user.firmaDigital;
            update.firmadoPor = req.user._id;
            update.fechaFirma = new Date();
        }

        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultado = await Resultado.findOneAndUpdate(
            queryResultado,
            update,
            { new: true }
        )
            .populate('paciente')
            .populate('estudio')
            .populate('validadoPor', 'nombre apellido especialidad')
            .populate('firmadoPor', 'nombre apellido especialidad');

        if (!resultado) {
            return res.status(404).json({
                success: false,
                message: 'Resultado no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Resultado validado exitosamente',
            data: resultado
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Eliminar resultado
// @route   DELETE /api/resultados/:id
exports.deleteResultado = async (req, res, next) => {
    try {
        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultado = await Resultado.findOneAndDelete(queryResultado);

        if (!resultado) {
            return res.status(404).json({
                success: false,
                message: 'Resultado no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Resultado eliminado'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Marcar como impreso
// @route   PUT /api/resultados/:id/imprimir
exports.marcarImpreso = async (req, res, next) => {
    try {
        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultado = await Resultado.findOneAndUpdate(
            queryResultado,
            {
                impreso: true,
                $inc: { vecesImpreso: 1 }
            },
            { new: true }
        );

        res.json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
};

// @desc    Verificar estado de pago antes de imprimir
// @route   GET /api/resultados/:id/verificar-pago
// LÓGICA: La deuda está asociada a la FACTURA específica de este resultado,
// NO a todas las facturas del paciente. Si el paciente tiene 3 facturas y debe 1,
// solo se bloquea esa factura, no las otras.
exports.verificarPago = async (req, res, next) => {
    try {
        // Obtener el resultado con la cita y paciente poblados
        const resultado = await Resultado.findById(req.params.id)
            .populate('cita')
            .populate('paciente', 'nombre apellido');

        if (resultado && shouldFilterBySucursal(req)) {
            const suc = resultado.sucursal ? resultado.sucursal.toString() : null;
            if (suc && suc !== req.sucursalId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No autorizado para resultados de otra sucursal'
                });
            }
        }

        if (!resultado) {
            return res.status(404).json({
                success: false,
                message: 'Resultado no encontrado'
            });
        }

        // Buscar la factura asociada a ESTE resultado específico:
        // 1. Por resultado.factura (campo directo)
        // 2. Por la cita del resultado (si tiene cita)
        let facturaAsociada = null;

        if (resultado.factura) {
            facturaAsociada = await Factura.findById(resultado.factura)
                .select('numero total montoPagado pagado estado');
        }

        if (!facturaAsociada && resultado.cita) {
            // Buscar factura cuya cita coincide con la cita del resultado
            const citaId = resultado.cita._id || resultado.cita;
            facturaAsociada = await Factura.findOne({ cita: citaId })
                .select('numero total montoPagado pagado estado');
        }

        // Si no hay factura asociada directamente, permite imprimir (sin restricción de pago)
        if (!facturaAsociada) {
            return res.json({
                success: true,
                puede_imprimir: true,
                monto_pendiente: 0,
                facturas_pendientes: [],
                paciente: {
                    nombre: resultado.paciente.nombre,
                    apellido: resultado.paciente.apellido
                }
            });
        }

        // Calcular pendiente SOLO de esa factura
        const montoPendiente = Math.max(
            0,
            (facturaAsociada.total || 0) - (facturaAsociada.montoPagado || 0)
        );
        const facturaPagada = facturaAsociada.pagado ||
            facturaAsociada.estado === 'pagada' ||
            montoPendiente === 0;

        const puedeImprimir = facturaPagada;

        res.json({
            success: true,
            puede_imprimir: puedeImprimir,
            monto_pendiente: montoPendiente,
            facturas_pendientes: !facturaPagada ? [{
                id: facturaAsociada._id,
                numero: facturaAsociada.numero,
                total: facturaAsociada.total,
                pagado: facturaAsociada.montoPagado || 0,
                pendiente: montoPendiente,
                estado: facturaAsociada.estado
            }] : [],
            paciente: {
                nombre: resultado.paciente.nombre,
                apellido: resultado.paciente.apellido
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener resultados por código QR de factura (SOLO los de esa factura)
// @route   GET /api/resultados/qr/:codigoQR
exports.getResultadosPorQR = async (req, res, next) => {
    try {
        const factura = await Factura.findOne({ codigoQR: req.params.codigoQR })
            .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo');

        if (!factura) {
            return res.status(404).json({
                success: false,
                message: 'Código QR inválido o factura no encontrada'
            });
        }

        // Obtener SOLO los resultados de la cita asociada a esta factura
        let filter = { paciente: factura.paciente._id };
        // Buscar por factura directa, o por cita si existe
        if (factura.cita) {
            filter = {
                $or: [
                    { factura: factura._id },
                    { cita: factura.cita, paciente: factura.paciente._id }
                ]
            };
        } else {
            filter.factura = factura._id;
        }

        const resultados = await Resultado.find(filter)
            .where(shouldFilterBySucursal(req) ? { sucursal: req.sucursalId } : {})
            .populate('estudio', 'nombre codigo categoria')
            .populate('medico', 'nombre apellido especialidad')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido')
            .sort('-createdAt');

        res.json({
            success: true,
            factura: {
                numero: factura.numero,
                fecha: factura.createdAt,
                total: factura.total,
                estado: factura.estado
            },
            paciente: factura.paciente,
            count: resultados.length,
            data: resultados
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Acceso del paciente con usuario y contraseña (desde factura)
// @route   POST /api/resultados/acceso-paciente
// Usuario = nombre del paciente (minúsculas), Clave = apellido (minúsculas)
exports.accesoPaciente = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos'
            });
        }

        // Normalizar input (permitir tildes y ñ como en el modelo)
        const userNorm = username.trim().toLowerCase().replace(/[^a-záéíóúñü]/g, '');
        const passNorm = password.trim().toLowerCase().replace(/[^a-záéíóúñü]/g, '');

        let factura;

        if (req.body.qrCode) {
            // MODO ESTRICTO: Si viene de un QR, buscar exactamente y únicamente esa factura
            factura = await Factura.findOne({ codigoQR: req.body.qrCode })
                .select('+pacientePasswordHash')
                .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo');

            if (!factura) {
                return res.status(401).json({
                    success: false,
                    message: 'Código QR no encontrado en el sistema'
                });
            }

            // Validar que el usuario ingresado corresponda al paciente de ESTA factura específica
            const nombrePacienteNorm = factura.paciente.nombre ? factura.paciente.nombre.toLowerCase().replace(/[^a-záéíóúñü]/g, '') : '';
            const cedulaNorm = username.trim().replace(/[^0-9]/g, '');
            const cedulaPacienteNorm = factura.paciente.cedula ? factura.paciente.cedula.replace(/[^0-9]/g, '') : '';

            const isUsernameMatch = 
                factura.pacienteUsername === userNorm || 
                (nombrePacienteNorm && nombrePacienteNorm.startsWith(userNorm)) ||
                (cedulaNorm && cedulaPacienteNorm && cedulaPacienteNorm === cedulaNorm);

            if (!isUsernameMatch) {
                return res.status(403).json({
                    success: false,
                    message: 'El usuario ingresado no corresponde a la factura de este código QR.'
                });
            }

        } else {
            // MODO GENÉRICO (Sin QR): Buscar la factura más reciente del paciente
            // 1) Buscar factura por pacienteUsername exacto
            factura = await Factura.findOne({
                pacienteUsername: userNorm
            })
                .select('+pacientePasswordHash')
                .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo')
                .sort('-createdAt');

            // 2) Si no se encontró, buscar por nombre del paciente directamente
            if (!factura) {
                const pacientes = await Paciente.find({
                    nombre: { $regex: new RegExp('^' + userNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
                }).select('_id');

                if (pacientes.length > 0) {
                    const pacienteIds = pacientes.map(p => p._id);
                    factura = await Factura.findOne({
                        paciente: { $in: pacienteIds },
                        $or: [
                            { pacientePassword: { $exists: true, $ne: null } },
                            { pacientePasswordHash: { $exists: true, $ne: null } }
                        ]
                    })
                        .select('+pacientePasswordHash')
                        .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo')
                        .sort('-createdAt');
                }
            }

            // 3) Si aún no se encontró, buscar por cédula del paciente
            if (!factura) {
                const pacByCedula = await Paciente.findOne({
                    cedula: { $regex: new RegExp(username.trim().replace(/[^0-9]/g, ''), 'i') }
                }).select('_id');

                if (pacByCedula) {
                    factura = await Factura.findOne({
                        paciente: pacByCedula._id,
                        $or: [
                            { pacientePassword: { $exists: true, $ne: null } },
                            { pacientePasswordHash: { $exists: true, $ne: null } }
                        ]
                    })
                        .select('+pacientePasswordHash')
                        .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo')
                        .sort('-createdAt');
                }
            }
        }

        if (!factura) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado o credenciales incorrectas'
            });
        }

        // Ya sea en modo estricto o genérico, autenticar contra la contraseña de esa factura
        const isMatch = await factura.comparePassword(passNorm);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Contraseña incorrecta'
            });
        }

        // Verificar si hay monto pendiente
        const montoPendiente = Math.max(0, (factura.total || 0) - (factura.montoPagado || 0));
        const facturaPagada = factura.pagado || factura.estado === 'pagada' || montoPendiente === 0;

        if (!facturaPagada) {
            return res.status(402).json({
                success: false,
                blocked: true,
                montoPendiente,
                totalFactura: factura.total || 0,
                montoPagado: factura.montoPagado || 0,
                mensaje: `Tiene un saldo pendiente de RD$ ${montoPendiente.toFixed(2)}. Por favor, liquide su factura para acceder a sus resultados.`,
                factura: { numero: factura.numero, total: factura.total, estado: factura.estado }
            });
        }

        // Obtener resultados de esa factura específica (filtro por factura._id + cita)
        let filter;
        if (factura.cita) {
            filter = {
                $or: [
                    { factura: factura._id },
                    { cita: factura.cita }
                ]
            };
        } else {
            const fechaInicio = new Date(factura.createdAt);
            fechaInicio.setHours(0, 0, 0, 0);
            const fechaFin = new Date(factura.createdAt);
            fechaFin.setDate(fechaFin.getDate() + 2);
            filter = {
                $or: [
                    { factura: factura._id },
                    { paciente: factura.paciente._id, createdAt: { $gte: fechaInicio, $lte: fechaFin } }
                ]
            };
        }

        const resultados = await Resultado.find(filter)
            .where(shouldFilterBySucursal(req) ? { sucursal: req.sucursalId } : {})
            .populate('estudio', 'nombre codigo categoria')
            .populate('medico', 'nombre apellido especialidad')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido')
            .sort('-createdAt');

        res.json({
            success: true,
            blocked: false,
            factura: {
                numero: factura.numero,
                fecha: factura.createdAt,
                total: factura.total,
                estado: factura.estado
            },
            paciente: factura.paciente,
            count: resultados.length,
            data: resultados
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener resultados por número de factura (para búsqueda interna)
// @route   GET /api/resultados/factura/:facturaNumero
exports.getResultadosPorFactura = async (req, res, next) => {
    try {
        const param = req.params.facturaNumero;
        const cleanParam = param ? param.trim() : '';
        const paramSinPrefix = cleanParam.replace(/^FAC-/i, '');
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(cleanParam);
        
        const factura = await Factura.findOne({
            $or: [
                { numero: new RegExp('^' + cleanParam + '$', 'i') },
                { numero: new RegExp('^' + paramSinPrefix + '$', 'i') },
                { codigoBarras: new RegExp('^' + cleanParam + '$', 'i') },
                { codigoBarras: new RegExp('^' + paramSinPrefix + '$', 'i') },
                { codigoQR: new RegExp('^' + cleanParam + '$', 'i') },
                { codigoId: parseInt(cleanParam, 10) || parseInt(paramSinPrefix, 10) || -1 },
                { registroIdNumerico: cleanParam },
                { registroIdNumerico: paramSinPrefix },
                ...(isObjectId ? [{ _id: cleanParam }] : [])
            ]
        }).populate('paciente', 'nombre apellido cedula');

        if (!factura) {
            return res.status(404).json({
                success: false,
                message: 'Factura no encontrada'
            });
        }

        // ESTRATEGIA DE FILTRO ESTRICTO:
        // 1. Primero buscar resultados que tengan factura._id directamente (más preciso)
        // 2. Si no hay ninguno, buscar por cita de esa factura (para resultados
        //    creados antes de que se implementara el campo factura)
        // NUNCA mezclar resultados de otras facturas del mismo paciente.

        // Intento 1: por factura._id
        let resultados = await Resultado.find({ factura: factura._id })
            .where(shouldFilterBySucursal(req) ? { sucursal: req.sucursalId } : {})
            .populate('estudio', 'nombre codigo categoria')
            .populate('medico', 'nombre apellido especialidad')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido')
            .sort('-createdAt');

        // Intento 2: por cita (si tiene cita y no encontró resultados por factura._id)
        if (resultados.length === 0 && factura.cita) {
            resultados = await Resultado.find({
                cita: factura.cita,
                paciente: factura.paciente._id
            })
                .where(shouldFilterBySucursal(req) ? { sucursal: req.sucursalId } : {})
                .populate('estudio', 'nombre codigo categoria')
                .populate('medico', 'nombre apellido especialidad')
                .populate('validadoPor', 'nombre apellido')
                .populate('firmadoPor', 'nombre apellido')
                .sort('-createdAt');
        }

        // Intento 3 (fallback final): por paciente + misma fecha de la factura
        // Solo si realmente no hay resultados de los intentos anteriores
        if (resultados.length === 0) {
            const fechaInicio = new Date(factura.createdAt);
            fechaInicio.setHours(0, 0, 0, 0);
            const fechaFin = new Date(factura.createdAt);
            fechaFin.setDate(fechaFin.getDate() + 1);
            fechaFin.setHours(23, 59, 59, 999);

            resultados = await Resultado.find({
                paciente: factura.paciente._id,
                createdAt: { $gte: fechaInicio, $lte: fechaFin }
            })
                .where(shouldFilterBySucursal(req) ? { sucursal: req.sucursalId } : {})
                .populate('estudio', 'nombre codigo categoria')
                .populate('medico', 'nombre apellido especialidad')
                .populate('validadoPor', 'nombre apellido')
                .populate('firmadoPor', 'nombre apellido')
                .sort('-createdAt');
        }


        // NO exponer credenciales del paciente en esta respuesta
        res.json({
            success: true,
            factura: {
                _id: factura._id,
                numero: factura.numero,
                codigoId: factura.codigoId || null,
                fecha: factura.createdAt,
                total: factura.total,
                montoPagado: factura.montoPagado || 0,
                pagado: factura.pagado,
                estado: factura.estado,
                codigoQR: factura.codigoQR
            },
            paciente: factura.paciente,
            count: resultados.length,
            data: resultados
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Acceso público por código QR (sin contraseña) — sólo si factura pagada
// @route   GET /api/resultados/acceso-qr/:codigoQR
exports.accesoQR = async (req, res, next) => {
    try {
        const factura = await Factura.findOne({ codigoQR: req.params.codigoQR })
            .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo');

        if (!factura) {
            return res.status(404).json({
                success: false,
                message: 'Código QR inválido o factura no encontrada'
            });
        }

        // Calcular monto pendiente
        const montoPendiente = Math.max(0, (factura.total || 0) - (factura.montoPagado || 0));
        const facturaPagada = factura.pagado || factura.estado === 'pagada' || montoPendiente === 0;

        // Si hay deuda, bloquear acceso a resultados
        if (!facturaPagada) {
            return res.status(402).json({
                success: false,
                blocked: true,
                montoPendiente,
                totalFactura: factura.total || 0,
                montoPagado: factura.montoPagado || 0,
                mensaje: `Tiene un saldo pendiente de RD$ ${montoPendiente.toFixed(2)}. Por favor, liquide su factura para acceder a sus resultados.`,
                factura: {
                    numero: factura.numero,
                    total: factura.total,
                    estado: factura.estado
                }
            });
        }

        // Factura pagada — retornar resultados
        let filter = { paciente: factura.paciente._id };
        if (factura.cita) {
            filter = {
                $or: [
                    { factura: factura._id },
                    { cita: factura.cita, paciente: factura.paciente._id }
                ]
            };
        } else {
            filter.factura = factura._id;
        }

        const resultados = await Resultado.find(filter)
            .populate('estudio', 'nombre codigo categoria')
            .populate('medico', 'nombre apellido especialidad')
            .populate('validadoPor', 'nombre apellido')
            .populate('firmadoPor', 'nombre apellido')
            .sort('-createdAt');

        res.json({
            success: true,
            blocked: false,
            factura: {
                numero: factura.numero,
                fecha: factura.createdAt,
                total: factura.total,
                estado: factura.estado
            },
            paciente: factura.paciente,
            count: resultados.length,
            data: resultados
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Obtener plantillas de reportes para imagenología
// @route   GET /api/resultados/imagenologia/plantillas
exports.getPlantillasImagenologia = async (req, res, next) => {
    try {
        res.json({ success: true, data: Object.values(PLANTILLAS_REPORTE_IMAGEN) });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener área de trabajo de imagenología (visor + reporte)
// @route   GET /api/resultados/:id/imagenologia
exports.getWorkspaceImagenologia = async (req, res, next) => {
    try {
        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultado = await Resultado.findOne(queryResultado)
            .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo')
            .populate('estudio', 'nombre codigo categoria');

        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        const imagenologia = resultado.imagenologia || {};
        const reporte = imagenologia.reporte || {};

        res.json({
            success: true,
            data: {
                resultadoId: resultado._id,
                paciente: resultado.paciente,
                estudio: resultado.estudio,
                visor: {
                    archivos: resultado.archivos || [],
                    dicom: imagenologia.dicom || {},
                    ajustes: imagenologia.ajustesVisor || { brillo: 1, contraste: 1, zoom: 1, invertido: false }
                },
                reporte: {
                    ...reporte,
                    plantillaDisponible: PLANTILLAS_REPORTE_IMAGEN[reporte.plantilla || 'radiografia_general']
                },
                impresion: {
                    permitido: resultado.estado !== 'anulado',
                    vecesImpreso: resultado.vecesImpreso || 0
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Guardar ajustes del visor y reporte de imagenología
// @route   PUT /api/resultados/:id/imagenologia
exports.updateWorkspaceImagenologia = async (req, res, next) => {
    try {
        const payload = req.body || {};
        const imagenologia = payload.imagenologia || {};

        const update = {};
        if (imagenologia.ajustesVisor) update['imagenologia.ajustesVisor'] = imagenologia.ajustesVisor;
        if (imagenologia.reporte) {
            if (!imagenologia.reporte.fecha_reporte) {
                imagenologia.reporte.fecha_reporte = new Date();
            }
            update['imagenologia.reporte'] = imagenologia.reporte;
        }
        if (imagenologia.dicom) update['imagenologia.dicom'] = imagenologia.dicom;

        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultado = await Resultado.findOneAndUpdate(queryResultado, { $set: update }, { new: true })
            .populate('paciente', 'nombre apellido cedula')
            .populate('estudio', 'nombre codigo');

        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        res.json({ success: true, message: 'Workspace de imagenología actualizado', data: resultado.imagenologia || {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener payload para integración de registro en equipos (Konica Minolta)
// @route   GET /api/resultados/integraciones/konica/:citaId
exports.getPayloadKonica = async (req, res, next) => {
    try {
        const cita = await Cita.findById(req.params.citaId)
            .populate('paciente', 'nombre apellido cedula sexo fechaNacimiento telefono')
            .populate('estudios.estudio', 'nombre codigo categoria');

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada' });
        }

        const estudiosRx = (cita.estudios || []).filter(item => {
            const e = item.estudio;
            if (!e) return false;
            const texto = `${e.nombre || ''} ${e.categoria || ''} ${e.codigo || ''}`.toLowerCase();
            return texto.includes('rayo') || texto.includes('radiograf') || texto.includes('rx');
        });

        if (!estudiosRx.length) {
            return res.status(400).json({ success: false, message: 'La cita no contiene estudios de rayos X/radiografía' });
        }

        const pac = cita.paciente;
        const fechaNacimiento = pac?.fechaNacimiento ? new Date(pac.fechaNacimiento).toISOString().slice(0, 10) : null;

        res.json({
            success: true,
            data: {
                tipoIntegracion: 'konica_minolta_autofill',
                registro: {
                    accessionNumber: cita.registroId,
                    patientId: pac?._id,
                    patientName: `${pac?.apellido || ''}, ${pac?.nombre || ''}`.trim(),
                    patientSex: pac?.sexo || '',
                    patientBirthDate: fechaNacimiento,
                    patientCedula: pac?.cedula || '',
                    patientPhone: pac?.telefono || '',
                    scheduledProcedureStepDescription: estudiosRx.map(e => e.estudio?.nombre).join(' | '),
                    referringPhysicianName: '',
                    modality: 'CR',
                    stationName: 'KONICA_MINOLTA'
                },
                instrucciones: 'Enviar este payload al conector local de la PC de radiografía para autocompletar el formulario del equipo.'
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Diagnóstico rápido de carpeta DICOM y Orthanc
// @route   GET /api/resultados/integraciones/dicom-diagnostico
exports.diagnosticoDicom = async (req, res, next) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const candidatos = [
            process.env.DICOM_FOLDER,
            path.join(process.cwd(), 'uploads', 'dicom'),
            '/home/opc/centro-diagnostico/uploads/dicom',
            '/var/lib/orthanc/db'
        ].filter(Boolean);

        const carpetas = candidatos.map((dir) => {
            let existe = false;
            let archivosDicom = 0;
            try {
                existe = fs.existsSync(dir);
                if (existe) {
                    const entries = fs.readdirSync(dir);
                    archivosDicom = entries.filter((n) => n.toLowerCase().endsWith('.dcm')).length;
                }
            } catch (e) {
                return { ruta: dir, existe: false, error: e.message };
            }
            return { ruta: dir, existe, archivosDicom };
        });

        res.json({
            success: true,
            orthanc: {
                url: process.env.ORTHANC_URL || 'http://localhost:8042',
                aet: process.env.ORTHANC_AET || 'ORTHANC'
            },
            carpetas
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Firmar resultado digitalmente
// @route   PUT /api/resultados/:id/firma
exports.firmarResultado = async (req, res, next) => {
    try {
        const firmaSesion = req.user?.firmaDigital;
        const firmaPayload = req.body?.firmaDigital;
        const firmaFinal = firmaPayload || firmaSesion;

        if (!req.user?._id) {
            return res.status(401).json({ success: false, message: 'Debe iniciar sesión para firmar resultados' });
        }

        if (!firmaFinal) {
            return res.status(400).json({ success: false, message: 'El médico no tiene una firma guardada' });
        }

        const queryResultado = { _id: req.params.id };
        if (shouldFilterBySucursal(req)) queryResultado.sucursal = req.sucursalId;

        const resultado = await Resultado.findOne(queryResultado);

        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        resultado.firmaDigital = firmaFinal;
        resultado.firmadoPor = req.user._id;
        resultado.fechaFirma = new Date();

        if (!resultado.validadoPor) {
            resultado.validadoPor = req.user._id;
        }

        if (!resultado.fechaValidacion) {
            resultado.fechaValidacion = new Date();
        }

        await resultado.save();
        await resultado.populate('firmadoPor', 'nombre apellido especialidad');
        await resultado.populate('validadoPor', 'nombre apellido especialidad');

        // Registrar auditoría
        try {
            const AuditLog = require('../models/AuditLog');
            AuditLog.registrar({
                usuario: req.user?.id,
                nombreUsuario: req.user?.nombre,
                accion: 'firmar_resultado',
                entidad: 'Resultado',
                entidadId: resultado._id.toString(),
                detalles: `Firmó resultado ${resultado.codigoMuestra}`,
                ip: req.ip
            });
        } catch (e) { }

        res.json({ success: true, message: 'Resultado firmado correctamente', data: resultado });
    } catch (error) {
        next(error);
    }
};
