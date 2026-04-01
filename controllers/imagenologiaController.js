/**
 * CONTROLADOR DE IMAGENOLOGÍA
 * Maneja: visor de imágenes, ajustes (brillo/contraste/zoom/invertir),
 * subida de imágenes, plantillas de reporte y guardado del reporte médico.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Resultado = require('../models/Resultado');
const Paciente = require('../models/Paciente');
const Cita = require('../models/Cita');

const MENSAJE_FIRMA_REQUERIDA = 'Debe registrar su firma en Mi Perfil antes de finalizar un reporte de imagenología.';

// ─── Multer: almacenamiento de imágenes ──────────────────────────────────────

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'imagenes');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|bmp|tiff|dcm|dicom|webp/i;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) || allowed.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de imagen no soportado'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB por imagen
});

exports.uploadMiddleware = upload.array('imagenes', 20);

// ─── Plantillas de reporte ────────────────────────────────────────────────────

const PLANTILLAS = {
    radiografia_general: {
        id: 'radiografia_general',
        nombre: 'Radiografía General',
        icono: '🦴',
        campos: ['tecnica', 'hallazgos', 'impresion_diagnostica', 'recomendaciones'],
        textoBase: {
            tecnica: 'Proyecciones estándar realizadas con técnica adecuada.',
            hallazgos: '',
            impresion_diagnostica: '',
            recomendaciones: 'Correlacionar con clínica del paciente.'
        }
    },
    torax: {
        id: 'torax',
        nombre: 'Radiografía de Tórax',
        icono: '🫁',
        campos: ['tecnica', 'campos_pulmonares', 'silueta_cardiaca', 'mediastino', 'estructuras_oseas', 'hallazgos', 'impresion_diagnostica', 'recomendaciones'],
        textoBase: {
            tecnica: 'PA y lateral de tórax en bipedestación, en inspiración adecuada.',
            campos_pulmonares: 'Campos pulmonares bien expandidos, sin lesiones focales evidentes.',
            silueta_cardiaca: 'Silueta cardiaca de tamaño y morfología normal. Índice cardiotorácico < 0.5.',
            mediastino: 'Mediastino centrado de anchura normal.',
            estructuras_oseas: 'Estructuras óseas sin lesiones traumáticas ni líticas evidentes.',
            hallazgos: '',
            impresion_diagnostica: '',
            recomendaciones: ''
        }
    },
    columna: {
        id: 'columna',
        nombre: 'Columna Vertebral',
        icono: '🦴',
        campos: ['tecnica', 'alineacion', 'cuerpos_vertebrales', 'espacios_discales', 'partes_blandas', 'hallazgos', 'impresion_diagnostica', 'recomendaciones'],
        textoBase: {
            tecnica: 'Proyecciones AP y lateral.',
            alineacion: 'Alineación vertebral conservada.',
            cuerpos_vertebrales: 'Cuerpos vertebrales de altura conservada, sin evidencia de fractura ni lesión lítica.',
            espacios_discales: 'Espacios discales conservados.',
            partes_blandas: 'Partes blandas sin alteraciones.',
            hallazgos: '',
            impresion_diagnostica: '',
            recomendaciones: ''
        }
    },
    extremidades: {
        id: 'extremidades',
        nombre: 'Extremidades',
        icono: '💪',
        campos: ['tecnica', 'estructuras_oseas', 'articulaciones', 'partes_blandas', 'hallazgos', 'impresion_diagnostica', 'recomendaciones'],
        textoBase: {
            tecnica: 'Proyecciones AP y lateral.',
            estructuras_oseas: 'Estructuras óseas sin evidencia de fractura ni lesiones líticas.',
            articulaciones: 'Espacios articulares conservados, sin signos de derrame.',
            partes_blandas: 'Partes blandas sin calcificaciones anómalas.',
            hallazgos: '',
            impresion_diagnostica: '',
            recomendaciones: ''
        }
    },
    abdomen: {
        id: 'abdomen',
        nombre: 'Abdomen',
        icono: '🫃',
        campos: ['tecnica', 'distribucion_gaseosa', 'solidificaciones', 'estructuras_oseas', 'hallazgos', 'impresion_diagnostica', 'recomendaciones'],
        textoBase: {
            tecnica: 'Radiografía simple de abdomen en decúbito.',
            distribucion_gaseosa: 'Distribución gaseosa intestinal normal sin signos de obstrucción.',
            solidificaciones: 'Sin opacidades anómalas en proyección de órganos sólidos.',
            estructuras_oseas: 'Estructuras óseas sin alteraciones.',
            hallazgos: '',
            impresion_diagnostica: '',
            recomendaciones: ''
        }
    },
    mamografia: {
        id: 'mamografia',
        nombre: 'Mamografía',
        icono: '🩺',
        campos: ['tecnica', 'densidad_mamaria', 'masas', 'calcificaciones', 'estructuras_axilares', 'hallazgos', 'impresion_diagnostica', 'birads', 'recomendaciones'],
        textoBase: {
            tecnica: 'Proyecciones CC y MLO bilaterales.',
            densidad_mamaria: 'Patrón de densidad mamaria tipo B (densidad media dispersa).',
            masas: 'No se identifican masas con características de malignidad.',
            calcificaciones: 'No se observan microcalcificaciones sospechosas.',
            estructuras_axilares: 'Estructuras axilares sin adenopatías evidentes.',
            hallazgos: '',
            impresion_diagnostica: '',
            birads: 'BIRADS 1 - Negativo. Sin hallazgos.',
            recomendaciones: 'Control anual recomendado.'
        }
    },
    personalizada: {
        id: 'personalizada',
        nombre: 'Reporte Personalizado',
        icono: '📝',
        campos: ['tecnica', 'hallazgos', 'impresion_diagnostica', 'recomendaciones'],
        textoBase: {
            tecnica: '',
            hallazgos: '',
            impresion_diagnostica: '',
            recomendaciones: ''
        }
    }
};

// ─── GET /api/imagenologia/plantillas ────────────────────────────────────────

exports.getPlantillas = (req, res) => {
    res.json({ success: true, data: Object.values(PLANTILLAS) });
};

// ─── GET /api/imagenologia/workspace/:resultadoId ────────────────────────────

exports.getWorkspace = async (req, res, next) => {
    try {
        const resultado = await Resultado.findById(req.params.resultadoId)
            .populate('paciente', 'nombre apellido cedula fechaNacimiento sexo edad telefono')
            .populate('estudio', 'nombre codigo categoria descripcion')
            .populate('cita', 'fecha registroId')
            .populate('medico', 'nombre apellido especialidad firma')
            .populate('validadoPor', 'nombre apellido especialidad')
            .populate('firmadoPor', 'nombre apellido especialidad');

        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        const img = resultado.imagenologia || {};
        const reporte = img.reporte || {};
        const plantillaId = reporte.plantilla || 'radiografia_general';
        const plantilla = PLANTILLAS[plantillaId] || PLANTILLAS.radiografia_general;

        // Armar datos del reporte con defaults de la plantilla
        const reporteConDefaults = {
            plantilla: plantillaId,
            ...plantilla.textoBase,
            ...reporte,
            fecha_reporte: reporte.fecha_reporte || null
        };

        let orthancImagenes = [];
        if (resultado.orthancStudyId) {
            const orthancService = require('../services/orthancService');
            const instances = await orthancService.getStudyInstances(resultado.orthancStudyId);
            orthancImagenes = instances.map((inst, index) => ({
                id: inst.ID,
                nombre: `Radiografía ${index + 1} (DICOM)`,
                url: `/api/orthanc/visor/${inst.ID}`,
                tipo: 'dicom/jpeg',
                tamaño: inst.FileSize || 0
            }));
        }

        const archivosLocales = (resultado.archivos || []).map(a => ({
            id: a._id,
            nombre: a.nombre,
            url: a.url,
            tipo: a.tipo,
            tamaño: a.tamaño
        }));

        res.json({
            success: true,
            data: {
                resultadoId: resultado._id,
                codigoMuestra: resultado.codigoMuestra,
                estado: resultado.estado,
                firmaDigital: resultado.firmaDigital || '',
                firmadoPor: resultado.firmadoPor || null,
                validadoPor: resultado.validadoPor || null,
                fechaFirma: resultado.fechaFirma || null,
                paciente: resultado.paciente,
                estudio: resultado.estudio,
                cita: resultado.cita,
                medico: resultado.medico,
                visor: {
                    imagenes: [...archivosLocales, ...orthancImagenes],
                    ajustes: img.ajustesVisor || {
                        brillo: 0,
                        contraste: 0,
                        saturacion: 0,
                        zoom: 1,
                        rotacion: 0,
                        invertido: false,
                        flipH: false,
                        flipV: false
                    },
                    dicom: img.dicom || {}
                },
                reporte: reporteConDefaults,
                plantillaInfo: plantilla,
                plantillasDisponibles: Object.values(PLANTILLAS).map(p => ({
                    id: p.id,
                    nombre: p.nombre,
                    icono: p.icono
                })),
                impresion: {
                    permitido: resultado.estado !== 'anulado',
                    vecesImpreso: resultado.vecesImpreso || 0
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

// ─── PUT /api/imagenologia/workspace/:resultadoId ────────────────────────────

exports.updateWorkspace = async (req, res, next) => {
    try {
        const { ajustes, reporte, dicom } = req.body;
        const update = {};

        if (ajustes) update['imagenologia.ajustesVisor'] = ajustes;

        if (reporte) {
            if (!reporte.fecha_reporte) reporte.fecha_reporte = new Date();
            update['imagenologia.reporte'] = reporte;
        }

        if (dicom) update['imagenologia.dicom'] = dicom;

        const resultado = await Resultado.findByIdAndUpdate(
            req.params.resultadoId,
            { $set: update },
            { new: true }
        ).populate('paciente', 'nombre apellido cedula');

        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        res.json({
            success: true,
            message: 'Workspace guardado correctamente',
            data: resultado.imagenologia
        });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/imagenologia/upload/:resultadoId ──────────────────────────────

exports.uploadImagenes = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No se recibieron imágenes' });
        }

        const resultado = await Resultado.findById(req.params.resultadoId);
        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        const nuevasImagenes = req.files.map(f => ({
            nombre: f.originalname,
            url: `/uploads/imagenes/${f.filename}`,
            tipo: f.mimetype,
            tamaño: f.size
        }));

        resultado.archivos = [...(resultado.archivos || []), ...nuevasImagenes];
        await resultado.save();

        res.json({
            success: true,
            message: `${nuevasImagenes.length} imagen(es) subida(s) correctamente`,
            data: nuevasImagenes
        });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/imagenologia/imagen/:resultadoId/:imagenId ──────────────────

exports.deleteImagen = async (req, res, next) => {
    try {
        const resultado = await Resultado.findById(req.params.resultadoId);
        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        const imagen = (resultado.archivos || []).find(a => a._id?.toString() === req.params.imagenId);
        if (imagen) {
            // Eliminar archivo físico
            const rutaFisica = path.join(__dirname, '..', imagen.url.replace(/^\//, ''));
            if (fs.existsSync(rutaFisica)) {
                fs.unlinkSync(rutaFisica);
            }
        }

        resultado.archivos = (resultado.archivos || []).filter(
            a => a._id?.toString() !== req.params.imagenId
        );
        await resultado.save();

        res.json({ success: true, message: 'Imagen eliminada' });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/imagenologia/lista ─────────────────────────────────────────────
// Lista estudios de imagenología (para panel del doctor)

exports.listaEstudios = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const filtro = {};
        if (req.query.estado) filtro.estado = req.query.estado;
        if (req.query.fecha) {
            const d = new Date(req.query.fecha);
            const d2 = new Date(d); d2.setDate(d2.getDate() + 1);
            filtro.createdAt = { $gte: d, $lt: d2 };
        }

        // Solo traer resultados que sean de imagenología (no laboratorio)
        const Estudio = require('../models/Estudio');
        const estudiosImg = await Estudio.find({
            $or: [
                { categoria: /radiolog|imagen|rayos|rx|mamog|tomog|ultrason|ecog|sonograf|resonancia|cr/i },
                { codigo: /^RX|^IMG|^RAD|^SON|^TOM|^RES|^CR/i }
            ]
        }).select('_id');

        const idsEstudios = estudiosImg.map(e => e._id);
        // Siempre aplicar el filtro para evitar listar todos los resultados si está vacío
        filtro.estudio = { $in: idsEstudios };

        const [resultados, total] = await Promise.all([
            Resultado.find(filtro)
                .sort('-createdAt')
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('paciente', 'nombre apellido cedula sexo')
                .populate('estudio', 'nombre codigo')
                .populate('medico', 'nombre apellido'),
            Resultado.countDocuments(filtro)
        ]);

        res.json({
            success: true,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data: resultados
        });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/imagenologia/reporte/:resultadoId/finalizar ───────────────────

exports.finalizarReporte = async (req, res, next) => {
    try {
        if (!req.user?.firmaDigital) {
            return res.status(400).json({ success: false, message: MENSAJE_FIRMA_REQUERIDA });
        }

        const firmaSesion = req.user?.firmaDigital || '';
        const resultado = await Resultado.findByIdAndUpdate(
            req.params.resultadoId,
            {
                $set: {
                    'imagenologia.reporte': {
                        ...req.body.reporte,
                        fecha_reporte: new Date(),
                        medico_firmante: req.body.reporte?.medico_firmante || req.user?.nombre + ' ' + (req.user?.apellido || '')
                    },
                    estado: 'completado',
                    fechaRealizacion: new Date(),
                    realizadoPor: req.user?._id,
                    validadoPor: req.user?._id,
                    fechaValidacion: new Date(),
                    ...(firmaSesion ? {
                        firmaDigital: firmaSesion,
                        firmadoPor: req.user?._id,
                        fechaFirma: new Date()
                    } : {})
                }
            },
            { new: true }
        )
            .populate('paciente', 'nombre apellido cedula')
            .populate('validadoPor', 'nombre apellido especialidad')
            .populate('firmadoPor', 'nombre apellido especialidad');

        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        res.json({
            success: true,
            message: 'Reporte finalizado y firmado',
            data: resultado
        });
    } catch (err) {
        next(err);
    }
};

// ─── Integración con equipo de rayos X (Konica / DICOM Worklist) ─────────────

/**
 * Cuando se registra un paciente y se crea una cita con estudios de imágenes,
 * este endpoint genera el payload HL7 / DICOM Worklist para enviar al equipo.
 * El equipo de rayos X (Konica Minolta, Carestream, etc.) recibe este dato
 * y auto-rellena los campos del paciente → NO hay doble registro.
 */
exports.generarWorklistDICOM = async (req, res, next) => {
    try {
        const cita = await Cita.findById(req.params.citaId)
            .populate('paciente', 'nombre apellido cedula sexo fechaNacimiento telefono')
            .populate('estudios.estudio', 'nombre codigo categoria');

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada' });
        }

        const pac = cita.paciente;
        const estudiosImg = (cita.estudios || []).filter(item => {
            const e = item.estudio;
            if (!e) return false;
            const txt = `${e.nombre || ''} ${e.categoria || ''} ${e.codigo || ''}`.toLowerCase();
            return txt.includes('rayo') || txt.includes('radiograf') ||
                txt.includes('rx') || txt.includes('imagen') ||
                txt.includes('tomog') || txt.includes('mamog');
        });

        if (!estudiosImg.length) {
            return res.status(400).json({
                success: false,
                message: 'La cita no contiene estudios de imagenología'
            });
        }

        const fechaNac = pac?.fechaNacimiento
            ? new Date(pac.fechaNacimiento).toISOString().slice(0, 10).replace(/-/g, '')
            : '';
        const fechaEstudio = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const horaEstudio = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
        const accessionNumber = cita.registroId || `ACC${Date.now()}`;

        // ── Payload DICOM Worklist (MWL) ──
        const dicomWorklist = {
            '00100010': { vr: 'PN', Value: [{ Alphabetic: `${pac?.apellido || ''}^${pac?.nombre || ''}` }] },
            '00100020': { vr: 'LO', Value: [pac?.cedula || pac?._id?.toString()] },
            '00100030': { vr: 'DA', Value: [fechaNac] },
            '00100040': { vr: 'CS', Value: [pac?.sexo === 'M' ? 'M' : 'F'] },
            '00080050': { vr: 'SH', Value: [accessionNumber] },
            '00400275': {
                vr: 'SQ', Value: [{ // Scheduled Procedure Step Sequence
                    '00400007': { vr: 'LO', Value: [estudiosImg.map(e => e.estudio?.nombre).join(' | ')] },
                    '00400001': { vr: 'AE', Value: ['RAYOSX'] },
                    '00400002': { vr: 'DA', Value: [fechaEstudio] },
                    '00400003': { vr: 'TM', Value: [horaEstudio] },
                    '00080060': { vr: 'CS', Value: ['CR'] } // Computed Radiography
                }]
            }
        };

        // ── Payload HL7 ORM (Order Message) ──
        const hl7 = [
            `MSH|^~\\&|CENTRODIAG|CENTRODIAG|RAYOSX|RAYOSX|${fechaEstudio + horaEstudio}||ORM^O01|${accessionNumber}|P|2.5`,
            `PID|1||${pac?.cedula || pac?._id}^^^CENTRODIAG||${pac?.apellido || ''}^${pac?.nombre || ''}||${fechaNac}|${pac?.sexo === 'M' ? 'M' : 'F'}|||${pac?.telefono || ''}`,
            `ORC|NW|${accessionNumber}|||CM`,
            `OBR|1|${accessionNumber}||${estudiosImg.map(e => e.estudio?.codigo || 'RX').join('^')}^${estudiosImg.map(e => e.estudio?.nombre).join(' | ')}||||${fechaEstudio + horaEstudio}`
        ].join('\r\n');

        // ── Payload CSV para equipos más simples ──
        const csv = [
            'AccessionNumber,PatientID,PatientName,BirthDate,Sex,StudyDescription,ScheduledDate',
            `${accessionNumber},${pac?.cedula || pac?._id},"${pac?.apellido || ''}, ${pac?.nombre || ''}",${fechaNac},${pac?.sexo === 'M' ? 'M' : 'F'},"${estudiosImg.map(e => e.estudio?.nombre).join(' | ')}",${fechaEstudio}`
        ].join('\n');

        res.json({
            success: true,
            message: 'Payload generado. Use el formato apropiado para su equipo.',
            data: {
                accessionNumber,
                paciente: {
                    nombre: `${pac?.nombre} ${pac?.apellido}`,
                    cedula: pac?.cedula,
                    sexo: pac?.sexo,
                    fechaNacimiento: pac?.fechaNacimiento
                },
                estudios: estudiosImg.map(e => e.estudio?.nombre),
                formatos: {
                    dicom_mwl: dicomWorklist,
                    hl7_orm: hl7,
                    csv: csv,
                    json_simple: {
                        accessionNumber,
                        patientId: pac?.cedula || pac?._id,
                        patientName: `${pac?.apellido}, ${pac?.nombre}`,
                        patientSex: pac?.sexo === 'M' ? 'M' : 'F',
                        patientBirthDate: fechaNac,
                        studyDescription: estudiosImg.map(e => e.estudio?.nombre).join(' | '),
                        scheduledDate: fechaEstudio,
                        modality: 'CR',
                        stationAET: process.env.RAYOSX_AET || 'RAYOSX'
                    }
                },
                instrucciones: {
                    dicom_mwl: 'Enviar a Orthanc o al servidor DICOM del equipo de rayos X via C-FIND MWL',
                    hl7: 'Enviar mensaje HL7 ORM al RIS/PACS o al middleware del equipo',
                    json: 'Para equipos con API REST propia (Konica Minolta AeroDR, Carestream, etc.)'
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

// ─── Webhook: el equipo de rayos X avisa que terminó el estudio ──────────────

exports.webhookEquipoListo = async (req, res, next) => {
    try {
        const { accessionNumber, imagenes, studyInstanceUID } = req.body;

        // Buscar la cita por accessionNumber (registroId)
        const cita = await Cita.findOne({ registroId: accessionNumber })
            .populate('estudios.estudio');

        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada por accessionNumber' });
        }

        // Buscar resultado asociado
        const resultado = await Resultado.findOne({ cita: cita._id });
        if (!resultado) {
            return res.status(404).json({ success: false, message: 'Resultado no encontrado' });
        }

        // Actualizar con las imágenes recibidas
        const archivosNuevos = (imagenes || []).map(img => ({
            nombre: img.filename || img.nombre || `imagen_${Date.now()}`,
            url: img.url || img.ruta,
            tipo: img.tipo || 'image/jpeg',
            tamaño: img.tamaño || 0
        }));

        resultado.archivos = [...(resultado.archivos || []), ...archivosNuevos];

        if (studyInstanceUID) {
            resultado.imagenologia = resultado.imagenologia || {};
            resultado.imagenologia.dicom = {
                ...((resultado.imagenologia || {}).dicom || {}),
                studyInstanceUID,
                orthancStudyId: req.body.orthancStudyId
            };
        }

        resultado.estado = 'en_proceso';
        await resultado.save();

        res.json({
            success: true,
            message: 'Imágenes registradas desde el equipo de rayos X',
            resultadoId: resultado._id
        });
    } catch (err) {
        next(err);
    }
};
