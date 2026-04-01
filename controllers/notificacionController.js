const Cita = require('../models/Cita');
const Resultado = require('../models/Resultado');

const ROLES_SIN_FILTRO_SUCURSAL = new Set(['admin', 'super-admin', 'medico']);
const shouldFilterBySucursal = (req) =>
    Boolean(req?.sucursalId && req?.user && !ROLES_SIN_FILTRO_SUCURSAL.has(req.user.role));

// @desc    Obtener notificaciones del usuario (médico u otro rol)
// @route   GET /api/notificaciones
exports.getNotificaciones = async (req, res, next) => {
    try {
        const notificaciones = [];
        const user = req.user;

        if (user.role === 'medico') {
            const matchSucursal = shouldFilterBySucursal(req)
                ? { sucursal: req.sucursalId }
                : {};

            // 1. Citas / Estudios asignados pendientes por ver/atender
            const citasAsignadas = await Cita.find({ 
                medico: user._id, 
                estado: 'completada', // 'completada' en citas significa facturada y en curso
                ...matchSucursal
            })
            .populate('paciente', 'nombre apellido')
            .populate('estudios.estudio', 'nombre categoria')
            .lean();

            for (const cita of citasAsignadas) {
                // Verificar si falta crear el resultado
                const resultadoExistente = await Resultado.findOne({ cita: cita._id });
                if (!resultadoExistente) {
                    notificaciones.push({
                        id: `cita_${cita._id}`,
                        tipo: 'NUEVO_PACIENTE',
                        titulo: 'Nuevo Paciente Asignado',
                        mensaje: `${cita.paciente?.nombre} ${cita.paciente?.apellido} te espera para estudio(s).`,
                        fecha: cita.createdAt,
                        leido: false,
                        link: '/admin/estudios' // Placeholder
                    });
                }
            }

            // 2. Resultados pendientes de dictado/interpretación
            // Por ejemplo en imagenología cuando suben imágenes pero no hay dictado
            const resultadosAsignados = await Resultado.find({
                medico: user._id,
                estado: { $in: ['pendiente', 'en_proceso'] },
                ...matchSucursal
            })
            .populate('paciente', 'nombre apellido')
            .populate('estudio', 'nombre categoria')
            .lean();

            for (const resItem of resultadosAsignados) {
                // Si es de imagenología y tiene dicomUrls pero no conclusión
                const esImagenologia = resItem.estudio?.categoria?.toLowerCase().includes('imagen') || resItem.estudio?.categoria?.toLowerCase().includes('rayos');
                
                if (esImagenologia && resItem.imagenologia?.dicomUrls?.length > 0 && !resItem.conclusion) {
                    notificaciones.push({
                        id: `res_img_${resItem._id}`,
                        tipo: 'IMAGENES_SUBIDAS',
                        titulo: 'Imágenes Listas para Lectura',
                        mensaje: `Se han subido las imágenes de ${resItem.paciente?.nombre} ${resItem.paciente?.apellido} (${resItem.estudio?.nombre}). Listo para dictamen.`,
                        fecha: resItem.updatedAt,
                        leido: false,
                        link: '/imagenologia'
                    });
                } else if (!esImagenologia) {
                    notificaciones.push({
                        id: `res_lab_${resItem._id}`,
                        tipo: 'LABORATORIO_PENDIENTE',
                        titulo: 'Pruebas Pendientes',
                        mensaje: `Pruebas de ${resItem.estudio?.nombre} para ${resItem.paciente?.nombre} están pendientes de validación.`,
                        fecha: resItem.updatedAt,
                        leido: false,
                        link: '/resultados'
                    });
                }
            }
        }

        // Ordenar por fecha desc
        notificaciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        res.json({
            success: true,
            count: notificaciones.length,
            data: notificaciones
        });
    } catch (error) {
        next(error);
    }
};
