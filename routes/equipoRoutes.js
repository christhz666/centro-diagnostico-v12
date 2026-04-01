const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');
const { protect, authorize } = require('../middleware/auth');
const { validarEquipoApiKey } = require('../middleware/equipoApiKey');

const buscarFacturaPorCodigoId = async (Factura, codigoRaw) => {
  const codigoNumerico = parseInt(codigoRaw, 10);
  if (Number.isNaN(codigoNumerico)) return null;
  return Factura.findOne({ codigoId: codigoNumerico }).populate('paciente');
};

console.log('? Cargando rutas de equipos...');

// Endpoint para agente/equipo con API Key (sin JWT)
router.post('/:id/heartbeat', validarEquipoApiKey, equipoController.registrarHeartbeatEquipo);
router.get('/:id/ordenes-pull', validarEquipoApiKey, async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const equipo = req.equipoAutenticado;
    const limit = req.query.limit || 200;

    if ((equipo.integracion?.modoEntrega || 'manual_pull') !== 'manual_pull') {
      return res.status(400).json({
        success: false,
        message: 'Este equipo no está configurado en modo manual_pull'
      });
    }

    const ordenes = await equipoService.obtenerOrdenesParaAgente(equipo._id, limit);

    return res.json({
      success: true,
      data: {
        equipoId: equipo._id,
        equipo: equipo.nombre,
        modoEntrega: equipo.integracion?.modoEntrega || 'manual_pull',
        count: ordenes.length,
        ordenes
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/ordenes-ack', validarEquipoApiKey, async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const equipo = req.equipoAutenticado;
    const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];

    const data = await equipoService.ackOrdenesAgente(equipo._id, orderIds);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/resultados-submit', validarEquipoApiKey, async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const equipo = req.equipoAutenticado;

    const data = await equipoService.registrarResultadosDesdeAgente(equipo, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/logs', validarEquipoApiKey, async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const equipo = req.equipoAutenticado;
    const logs = Array.isArray(req.body?.logs) ? req.body.logs : [];

    if (logs.length === 0) {
      return res.status(400).json({ success: false, message: 'logs[] es requerido' });
    }

    await Promise.all(logs.slice(0, 200).map((l) => equipoService.registrarLogAgente({
      equipoId: equipo._id,
      source: 'agente',
      level: l.level || 'info',
      event: l.event || 'agente.log',
      message: l.message || '',
      payload: l.payload || null
    })));

    return res.json({ success: true, data: { accepted: Math.min(logs.length, 200) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const AgenteLog = require('../models/AgenteLog');
    const limit = Math.max(1, Math.min(Number(req.query.limit || 200), 1000));

    const logs = await AgenteLog.find({ equipo: req.params.id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.use(protect);

router.post('/sincronizar-lista-manual', async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const { facturaId } = req.body || {};

    if (!facturaId) {
      return res.status(400).json({ success: false, message: 'facturaId es requerido' });
    }

    const data = await equipoService.sincronizarResultadosPendientesAFila(facturaId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET - Listar equipos
router.get('/', equipoController.getEquipos);
router.get('/estados', equipoController.getEstadoConexiones);

// GET - Últimos resultados recibidos de equipos (para el dashboard de equipos)
router.get('/resultados-recientes', async (req, res) => {
  try {
    const Resultado = require('../models/Resultado');
    const equipoService = require('../services/equipoService');

    const resultados = await Resultado.find({
      observaciones: { $regex: /Recibido/i }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('paciente', 'nombre apellido cedula')
      .populate('factura', 'numero codigoId')
      .populate('estudio', 'nombre');

    const data = resultados.map(r => ({
      id: r._id,
      equipo: (r.observaciones || '').replace(/Recibido (automáticamente )?desde /, '').split(' (')[0].split(' -')[0],
      paciente: r.paciente ? `${r.paciente.nombre} ${r.paciente.apellido}` : '—',
      codigoId: r.factura?.codigoId || null,
      facturaNumero: r.factura?.numero || null,
      parametros: r.valores?.length || 0,
      estado: r.estado,
      fecha: r.createdAt
    }));

    res.json({
      success: true,
      data,
      colaPendiente: equipoService.colas ? equipoService.colas.size : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Reprocesar cola de resultados pendientes
router.post('/procesar-cola', async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const tamañoAntes = equipoService.colas ? equipoService.colas.size : 0;
    await equipoService.procesarCola();
    const tamañoDespues = equipoService.colas ? equipoService.colas.size : 0;

    res.json({
      success: true,
      message: `Cola procesada. ${tamañoAntes - tamañoDespues} resultado(s) vinculados. ${tamañoDespues} pendiente(s) restantes.`,
      procesados: tamañoAntes - tamañoDespues,
      pendientes: tamañoDespues
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET - Resumen de órdenes persistentes pendientes (equipos bidireccionales)
router.get('/ordenes-pendientes/resumen', async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const data = await equipoService.obtenerResumenOrdenesPendientes();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET - Detalle de órdenes persistentes pendientes
router.get('/ordenes-pendientes', async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    const limit = req.query.limit || 1000;
    const equipoId = req.query.equipoId || null;
    const estados = req.query.estados
      ? String(req.query.estados).split(',').map(v => v.trim()).filter(Boolean)
      : null;

    const data = await equipoService.obtenerOrdenesPendientesDetalladas({
      limit,
      equipoId,
      estados
    });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Reprocesar inmediatamente órdenes persistentes
router.post('/ordenes-pendientes/reprocesar', async (req, res) => {
  try {
    const equipoService = require('../services/equipoService');
    await equipoService.procesarOrdenesPendientes();
    const resumen = await equipoService.obtenerResumenOrdenesPendientes();
    res.json({
      success: true,
      message: 'Reproceso de órdenes persistentes ejecutado',
      data: resumen
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Reprocesar una orden persistente puntual
router.post('/ordenes-pendientes/:ordenId/reprocesar', async (req, res) => {
  try {
    const OrdenEquipo = require('../models/OrdenEquipo');
    const equipoService = require('../services/equipoService');

    const orden = await OrdenEquipo.findById(req.params.ordenId);
    if (!orden) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    orden.proximoIntento = new Date();
    if (orden.estado === 'error') {
      orden.estado = 'pendiente';
      orden.ultimoError = null;
    }
    await orden.save();

    await equipoService.procesarOrdenesPendientes();

    return res.json({
      success: true,
      message: 'Orden enviada a reproceso',
      data: { ordenId: orden._id }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET - Generar Modality Worklist (MWL) para Agente DICOM
router.get('/worklist/:tipo', async (req, res) => {
  try {
    const Cita = require('../models/Cita');
    const Estudio = require('../models/Estudio');
    const tipo = req.params.tipo; // e.g., 'dicom'

    // Buscar estudios que clasifiquen como Rayos X / Imagenología
    const estudiosRX = await Estudio.find({
      $or: [
        { categoria: { $in: ['Imagenología', 'Rayos X', 'CR', 'Sonografía', 'Tomografía', 'Mamografía', 'Ecografía', 'RX'] } },
        { categoria: { $regex: /imagen|rayo|radio|rx|sonograf|tomograf|mamograf/i } },
        { nombre: { $regex: /\brayo|radiograf|\brx\b|sonograf|tomograf|mamograf/i } }
      ]
    }).select('_id');
    const estudiosIds = estudiosRX.map(e => e._id);

    // Obtener fecha de hoy (inicio y fin)
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const finHoy = new Date();
    finHoy.setHours(23, 59, 59, 999);

    // Buscar citas confirmadas de hoy que contengan esos estudios
    const citas = await Cita.find({
      fecha: { $gte: inicioHoy, $lte: finHoy },
      estado: { $in: ['confirmada', 'en_proceso'] },
      'estudios.estudio': { $in: estudiosIds }
    }).populate('paciente')
      .populate('estudios.estudio');

    const worklist = citas.map(cita => {
      // Tomamos el primer estudio de RX aplicable
      const estudioDicom = cita.estudios.find(e => estudiosIds.some(id => id.equals(e.estudio._id)));

      return {
        PatientID: cita.paciente.cedula || cita.paciente._id.toString(),
        PatientName: `${cita.paciente.nombre}^${cita.paciente.apellido}`.toUpperCase().replace(/\s+/g, '^'),
        AccessionNumber: cita._id.toString().slice(-8).toUpperCase(),
        StudyInstanceUID: '', // Se genera temporalmente en el agente si viene vacío
        RequestedProcedureID: estudioDicom ? estudioDicom.estudio.codigo : '',
        ScheduledProcedureStepStartDate: cita.fecha.toISOString().slice(0, 10).replace(/-/g, '')
      };
    });

    res.json({ success: true, data: worklist });
  } catch (err) {
    console.error('Error generando Worklist:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Recibir imagen desde agente de rayos X
router.post('/recibir-imagen', async (req, res) => {
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');

  const uploadDir = path.join(__dirname, '..', 'uploads', 'dicom');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ts = Date.now();
      cb(null, `${ts}_${file.originalname}`);
    }
  });

  const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }).single('archivo');

  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });

    try {
      const Factura = require('../models/Factura');
      const Resultado = require('../models/Resultado');
      const Cita = require('../models/Cita');
      const Estudio = require('../models/Estudio');

      const codigoId = req.body.codigoId;
      const stationName = req.body.station_name || 'Agente Rayos X';
      const tipo = req.body.tipo || 'imagen';

      let pacienteId = null;
      let facturaId = null;
      let citaId = null;

      // Buscar factura por codigoId
      if (codigoId) {
        const factura = await buscarFacturaPorCodigoId(Factura, codigoId);
        if (factura && factura.paciente) {
          pacienteId = factura.paciente._id;
          facturaId = factura._id;
          citaId = factura.cita;
          console.log(`🔗 Imagen vinculada por ID ${codigoId} → ${factura.paciente.nombre}`);
        }
      }

      // Buscar estudio de imagenología
      let estudio = await Estudio.findOne({ categoria: { $in: ['Imagenología', 'Rayos X', 'CR'] } });
      if (!estudio) {
        estudio = await Estudio.create({
          nombre: 'Rayos X General',
          codigo: 'AUTO-RX',
          categoria: 'Rayos X',
          precio: 0
        });
      }

      const archivoUrl = `/uploads/dicom/${req.file.filename}`;

      // Crear resultado si tenemos paciente
      let resultadoId = null;
      if (pacienteId) {
        if (!citaId) {
          const cita = await Cita.findOne({ paciente: pacienteId }).sort({ createdAt: -1 });
          citaId = cita ? cita._id : null;
        }

        if (!citaId) {
          const ahora = new Date();
          const nuevaCita = await Cita.create({
            paciente: pacienteId, fecha: ahora,
            horaInicio: ahora.toTimeString().slice(0, 5),
            estudios: [{ estudio: estudio._id, precio: 0 }],
            estado: 'completada', motivo: `Auto - ${stationName}`
          });
          citaId = nuevaCita._id;
        }

        const resultado = await Resultado.create({
          paciente: pacienteId,
          cita: citaId,
          factura: facturaId,
          estudio: estudio._id,
          archivos: [{ nombre: req.file.originalname, url: archivoUrl, tipo: tipo, tamaño: req.file.size }],
          estado: 'en_proceso',
          observaciones: `Imagen recibida desde ${stationName}${codigoId ? ` (ID: ${codigoId})` : ''}`
        });
        resultadoId = resultado._id;
      }

      res.json({
        success: true,
        message: `Imagen recibida: ${req.file.originalname}`,
        data: {
          archivo: archivoUrl,
          tamaño: req.file.size,
          codigoId: codigoId || null,
          resultadoId,
          pacienteVinculado: !!pacienteId
        }
      });
    } catch (error) {
      console.error('Error procesando imagen:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
});

// CRUD
router.post('/', equipoController.createEquipo);
router.put('/:id', equipoController.updateEquipo);
router.delete('/:id', equipoController.deleteEquipo);

// Integración de equipos (panel)
router.put('/:id/integracion', authorize('admin', 'super-admin'), equipoController.actualizarIntegracionEquipo);
router.post('/:id/generar-api-key', authorize('admin', 'super-admin'), equipoController.generarApiKeyIntegracion);

// Conexiones
router.post('/:id/conectar', equipoController.conectarEquipo);
router.post('/:id/desconectar', equipoController.desconectarEquipo);
router.post('/:id/probar', equipoController.probarConexion);

// ? SIMULACIÓN DE RESULTADO
router.post('/:id/simular-resultado', async (req, res) => {
  console.log('?? Simulación de resultado iniciada');

  const Equipo = require('../models/Equipo');
  const Resultado = require('../models/Resultado');
  const Paciente = require('../models/Paciente');
  const Estudio = require('../models/Estudio');
  const Cita = require('../models/Cita');

  try {
    // 1. Buscar equipo
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    }
    console.log('? Equipo:', equipo.nombre);

    // 2. Buscar paciente
    const paciente = await Paciente.findOne({ cedula: req.body.cedula });
    if (!paciente) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado con cédula: ' + req.body.cedula });
    }
    console.log('? Paciente:', paciente.nombre);

    // 3. Buscar estudio
    const estudio = await Estudio.findOne();
    if (!estudio) {
      return res.status(404).json({ success: false, message: 'No hay estudios registrados' });
    }
    console.log('? Estudio:', estudio.nombre);

    // 4. Buscar o crear cita
    let cita = await Cita.findOne({
      paciente: paciente._id,
      estado: { $in: ['confirmada', 'completada'] }
    });

    if (!cita) {
      console.log('?? Creando cita automática...');
      const ahora = new Date();
      cita = await Cita.create({
        paciente: paciente._id,
        fecha: ahora,
        hora: ahora.toTimeString().slice(0, 5),
        horaInicio: ahora.toTimeString().slice(0, 5), // ? Campo requerido
        estudios: [{
          estudio: estudio._id, // ? Estructura correcta
          precio: estudio.precio || 0,
          estado: 'completado'
        }],
        estado: 'completada',
        motivo: 'Resultado automático - ' + equipo.nombre,
        tipoConsulta: 'laboratorio'
      });
      console.log('? Cita creada');
    } else {
      console.log('? Cita existente encontrada');
    }

    // 5. Generar valores según tipo de equipo
    let valores = [];

    if (equipo.tipo === 'hematologia') {
      valores = [
        {
          parametro: 'Leucocitos (WBC)',
          valor: (Math.random() * 5 + 5).toFixed(1),
          unidad: '10³/µL',
          valorReferencia: '4.0-10.0',
          estado: 'normal'
        },
        {
          parametro: 'Eritrocitos (RBC)',
          valor: (Math.random() * 1 + 4.5).toFixed(1),
          unidad: '106/µL',
          valorReferencia: '4.5-5.5',
          estado: 'normal'
        },
        {
          parametro: 'Hemoglobina (HGB)',
          valor: (Math.random() * 3 + 13).toFixed(1),
          unidad: 'g/dL',
          valorReferencia: '13.0-17.0',
          estado: 'normal'
        },
        {
          parametro: 'Plaquetas (PLT)',
          valor: (Math.random() * 200 + 200).toFixed(0),
          unidad: '10³/µL',
          valorReferencia: '150-400',
          estado: 'normal'
        }
      ];
    } else if (equipo.tipo === 'quimica') {
      valores = [
        { parametro: 'Glucosa', valor: (Math.random() * 20 + 80).toFixed(0), unidad: 'mg/dL', valorReferencia: '70-100', estado: 'normal' },
        { parametro: 'Urea', valor: (Math.random() * 15 + 20).toFixed(0), unidad: 'mg/dL', valorReferencia: '15-40', estado: 'normal' },
        { parametro: 'Creatinina', valor: (Math.random() * 0.5 + 0.7).toFixed(1), unidad: 'mg/dL', valorReferencia: '0.6-1.2', estado: 'normal' }
      ];
    } else {
      valores = [
        { parametro: 'Parámetro Test', valor: (Math.random() * 100).toFixed(1), unidad: 'U/L', valorReferencia: 'Normal', estado: 'normal' }
      ];
    }

    console.log('? Valores generados:', valores.length);

    // 6. Crear resultado
    const resultado = await Resultado.create({
      paciente: paciente._id,
      cita: cita._id,
      estudio: estudio._id,
      valores,
      estado: 'en_proceso',
      observaciones: `Resultado automático de ${equipo.nombre} - ${new Date().toLocaleString('es-DO')}`
    });

    console.log('? Resultado creado:', resultado._id);

    // 7. Actualizar estadísticas del equipo
    await Equipo.findByIdAndUpdate(equipo._id, {
      ultimaConexion: new Date(),
      $inc: { 'estadisticas.resultadosRecibidos': 1 },
      'estadisticas.ultimoResultado': new Date()
    });

    res.json({
      success: true,
      message: `? Resultado creado exitosamente desde ${equipo.nombre}`,
      data: {
        resultadoId: resultado._id,
        paciente: `${paciente.nombre} ${paciente.apellido}`,
        cedula: paciente.cedula,
        equipo: equipo.nombre,
        valores: valores.length,
        estado: 'en_proceso'
      }
    });

  } catch (error) {
    console.error('? Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.toString()
    });
  }
});

// GET individual - debe ir AL FINAL
router.get('/:id', equipoController.getEquipo);

// -----------------------------------------------------------
// ?? RECEPCIÓN DESDE AGENTE REMOTO
// -----------------------------------------------------------

// Endpoint genérico para agentes remotos (sin requerir equipment ID)
router.post('/recibir-json', async (req, res) => {
  console.log('?? Recibiendo resultado desde agente remoto (genérico)');
  console.log('Datos:', JSON.stringify(req.body, null, 2));

  try {
    const Resultado = require('../models/Resultado');
    const Paciente = require('../models/Paciente');
    const Estudio = require('../models/Estudio');
    const Cita = require('../models/Cita');
    const Equipo = require('../models/Equipo');
    const equipoService = require('../services/equipoService');

    const {
      station_name,
      equipment_type,
      equipment_name,
      cedula,
      paciente_id,
      orden_id,
      tipo_estudio,
      valores,
      timestamp
    } = req.body;

    // Buscar paciente por cédula o ID
    let paciente;
    let facturaVinculada = null;
    let citaVinculada = null;

    if (cedula) {
      // 1. Intentar buscar por cédula exacta
      paciente = await Paciente.findOne({ cedula });
      
      // 2. Si no es cédula, intentar buscar por ID de factura (codigoId)
      if (!paciente && !isNaN(cedula)) {
        const Factura = require('../models/Factura');
        const factura = await buscarFacturaPorCodigoId(Factura, cedula);
        if (factura && factura.paciente) {
          paciente = factura.paciente;
          facturaVinculada = factura._id;
          citaVinculada = factura.cita;
          console.log(`🔗 Paciente encontrado por ID ${cedula} → Factura: ${factura.numero}`);
        }
      }
    } else if (paciente_id) {
      paciente = await Paciente.findById(paciente_id).catch(() => null);
      if (!paciente) {
        paciente = await Paciente.findOne({ cedula: paciente_id });
      }
    }

    if (!paciente) {
      console.log('❌ Paciente no encontrado ni por cédula ni por ID:', cedula || paciente_id);
      return res.status(404).json({
        success: false,
        message: `Paciente no encontrado. Verifique la Cédula o el Código ID.`
      });
    }

    console.log('✅ Paciente encontrado:', paciente.nombre, paciente.apellido);

    // Buscar estudio por tipo
    let estudio = await Estudio.findOne({
      $or: [
        { codigo: { $regex: tipo_estudio, $options: 'i' } },
        { nombre: { $regex: tipo_estudio, $options: 'i' } },
        { categoria: { $regex: equipment_type, $options: 'i' } }
      ]
    });

    if (!estudio) {
      // Mapear equipment_type a categorías válidas del schema
      const catMap = {
        'hematologia': 'Laboratorio Clínico',
        'quimica': 'Laboratorio Clínico',
        'orina': 'Laboratorio Clínico',
        'coagulacion': 'Laboratorio Clínico',
        'inmunologia': 'Laboratorio Clínico',
        'microbiologia': 'Laboratorio Clínico',
        'radiologia': 'Imagenología',
        'rayos_x': 'Rayos X',
        'sonografia': 'Sonografía',
        'tomografia': 'Tomografía',
        'resonancia': 'Resonancia'
      };
      const catValida = catMap[(equipment_type || '').toLowerCase()] || 'Laboratorio Clínico';

      estudio = await Estudio.create({
        nombre: `${equipment_type} - ${equipment_name}`,
        codigo: `AUTO-${(equipment_type || 'LIS').toUpperCase().replace(/\s+/g, '-')}`,
        categoria: catValida,
        precio: 0
      });
      console.log('🆕 Estudio creado automáticamente:', estudio.nombre, '→', catValida);
    }

    // Buscar cita reciente del paciente
    let cita = await Cita.findOne({
      paciente: paciente._id,
      estado: { $in: ['completada', 'en_proceso', 'programada'] }
    }).sort({ createdAt: -1 });

    if (!cita) {
      const ahora = new Date();
      cita = await Cita.create({
        paciente: paciente._id,
        fecha: ahora,
        hora: ahora.toTimeString().slice(0, 5),
        horaInicio: ahora.toTimeString().slice(0, 5),
        estudios: [{
          estudio: estudio._id,
          precio: 0,
          estado: 'completado'
        }],
        estado: 'completada',
        motivo: `Auto - ${equipment_name}`
      });
      console.log('? Cita creada automáticamente');
    }

    // Convertir valores al formato interno
    const valoresFormateados = [];
    if (valores && typeof valores === 'object') {
      for (const [key, value] of Object.entries(valores)) {
        if (typeof value === 'object' && value !== null) {
          valoresFormateados.push({
            parametro: key,
            valor: String(value.valor || ''),
            unidad: value.unidad || '',
            valorReferencia: value.referencia || '',
            estado: value.estado || 'normal'
          });
        } else {
          valoresFormateados.push({
            parametro: key,
            valor: String(value),
            unidad: '',
            valorReferencia: '',
            estado: 'normal'
          });
        }
      }
    }

    console.log('? Valores formateados:', valoresFormateados.length);

    const citaIdFinal = cita ? cita._id : citaVinculada;
    
    const busquedaFiltro = [];
    if (citaIdFinal) busquedaFiltro.push({ cita: citaIdFinal });
    if (facturaVinculada) busquedaFiltro.push({ factura: facturaVinculada });
    
    // Buscar si ya existe un resultado previo para esta cita/factura y este estudio específico
    let resultado = null;
    if (busquedaFiltro.length > 0) {
      resultado = await Resultado.findOne({ 
        $or: busquedaFiltro, 
        estudio: estudio._id 
      });
    }

    if (!resultado && busquedaFiltro.length > 0) {
      // Búsqueda inteligente: si el usuario creó la orden con otro nombre de estudio (ej: "Hemograma" en vez de "AUTO-HEMATOLOGIA")
      const queryParams = { $or: busquedaFiltro };
      const resultadosDeCita = await Resultado.find(queryParams).populate('estudio');
      
      resultado = resultadosDeCita.find(r => {
        if (!r.estudio || r.estado === 'entregado' || r.estado === 'anulado') return false;
        
        const n = (r.estudio.nombre || '').toLowerCase();
        const cat = (r.estudio.categoria || '').toLowerCase();
        const te = (tipo_estudio || '').toLowerCase();
        const eqt = (equipment_type || '').toLowerCase();
        
        if (te === 'hematologia' && (n.includes('hemo') || n.includes('hema') || n.includes('bhc') || n.includes('biometria'))) return true;
        if (te === 'quimica' && (n.includes('quimica') || n.includes('gluc') || n.includes('colest') || n.includes('perfil'))) return true;
        
        return n.includes(te) || n.includes(eqt) || cat.includes(te) || cat.includes(eqt);
      });
    }

    if (resultado) {
      // Si la secretaria o el médico ya habían creado el "cascarón" del resultado, lo rellenamos
      resultado.valores = valoresFormateados;
      resultado.estado = 'completado';
      
      const notaAñadida = `Actualizado automáticamente desde ${equipment_name} (${station_name}) - ${timestamp || new Date().toISOString()}`;
      resultado.observaciones = resultado.observaciones 
        ? `${resultado.observaciones}\n${notaAñadida}`
        : notaAñadida;
        
      if (facturaVinculada && !resultado.factura) {
        resultado.factura = facturaVinculada;
      }
      
      await resultado.save();
      console.log('🔄 Resultado existente actualizado:', resultado._id);
    } else {
      // Crear resultado nuevo desde cero
      const resultadoData = {
        paciente: paciente._id,
        cita: citaIdFinal,
        estudio: estudio._id,
        valores: valoresFormateados,
        estado: 'completado',
        observaciones: `Recibido automáticamente desde ${equipment_name} (${station_name}) - ${timestamp || new Date().toISOString()}`
      };

      if (facturaVinculada) {
        resultadoData.factura = facturaVinculada;
      }

      resultado = await Resultado.create(resultadoData);
      console.log('🆕 Resultado nuevo creado:', resultado._id);
    }

    if (facturaVinculada) {
      const equipoRegistrado = await Equipo.findOne({ nombre: equipment_name });
      if (equipoRegistrado) {
        const codigos = Object.keys(valores || {}).map(c => ({ codigoEquipo: c }));
        await equipoService.marcarOrdenesComoCompletadas(equipoRegistrado, { _id: facturaVinculada }, codigos);
      }
    }

    console.log('📍 Código de muestra final:', resultado.codigoMuestra);

    res.json({
      success: true,
      message: `Resultado recibido desde ${equipment_name}`,
      data: {
        resultadoId: resultado._id,
        codigoMuestra: resultado.codigoMuestra,
        paciente: `${paciente.nombre} ${paciente.apellido}`,
        valores: valoresFormateados.length
      },
      // Devolver también en el nivel superior para compatibilidad
      codigoMuestra: resultado.codigoMuestra
    });

  } catch (error) {
    console.error('? Error procesando resultado:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:id/recibir-resultado', async (req, res) => {
  console.log('?? Recibiendo resultado desde agente remoto');
  console.log('Equipo ID:', req.params.id);
  console.log('Datos:', JSON.stringify(req.body, null, 2));

  try {
    const Equipo = require('../models/Equipo');
    const Resultado = require('../models/Resultado');
    const Paciente = require('../models/Paciente');
    const Estudio = require('../models/Estudio');
    const Cita = require('../models/Cita');
    const equipoService = require('../services/equipoService');

    // Buscar equipo
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) {
      console.log('? Equipo no encontrado');
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    console.log('? Equipo encontrado:', equipo.nombre);

    const { cedula, valores, timestamp } = req.body;

    // Buscar paciente por cédula o por código ID de factura
    let paciente = await Paciente.findOne({ cedula });
    let facturaVinculada = null;
    let citaVinculada = null;

    if (!paciente && !isNaN(cedula)) {
      const Factura = require('../models/Factura');
      const factura = await buscarFacturaPorCodigoId(Factura, cedula);
      if (factura?.paciente) {
        paciente = factura.paciente;
        facturaVinculada = factura._id;
        citaVinculada = factura.cita;
      }
    }

    if (!paciente) {
      console.log('? Paciente no encontrado:', cedula);
      return res.status(404).json({
        success: false,
        message: `Paciente no encontrado con cédula/código ${cedula}`
      });
    }

    console.log('? Paciente encontrado:', paciente.nombre, paciente.apellido);

    // Buscar o crear estudio
    let estudio = await Estudio.findOne();
    if (!estudio) {
      estudio = await Estudio.create({
        nombre: 'Examen General',
        codigo: 'GEN-001',
        categoria: 'Laboratorio Clínico',
        precio: 0
      });
    }

    // Buscar o crear cita
    let cita = null;
    if (citaVinculada) {
      cita = await Cita.findById(citaVinculada);
    }
    if (!cita) {
      cita = await Cita.findOne({
        paciente: paciente._id,
        estado: 'completada'
      }).sort({ createdAt: -1 });
    }

    if (!cita) {
      const ahora = new Date();
      cita = await Cita.create({
        paciente: paciente._id,
        fecha: ahora,
        hora: ahora.toTimeString().slice(0, 5),
        horaInicio: ahora.toTimeString().slice(0, 5),
        estudios: [{
          estudio: estudio._id,
          precio: 0,
          estado: 'completado'
        }],
        estado: 'completada',
        motivo: `Auto - ${equipo.nombre}`
      });
      console.log('? Cita creada automáticamente');
    }

    // Mapear valores recibidos a parámetros del sistema
    const valoresMapeados = valores.map(v => {
      // Buscar mapeo en el equipo
      const mapeo = equipo.mapeoParametros.find(m =>
        m.codigoEquipo === v.codigo ||
        v.codigo.includes(m.codigoEquipo)
      );

      return {
        parametro: mapeo?.nombreParametro || v.codigo,
        valor: v.valor,
        unidad: mapeo?.unidad || v.unidad || '',
        valorReferencia: mapeo?.valorReferencia || '',
        estado: v.estado === 'N' ? 'normal' :
          v.estado === 'H' ? 'alto' :
            v.estado === 'L' ? 'bajo' : 'normal'
      };
    });

    console.log('? Valores mapeados:', valoresMapeados.length);

    // Crear resultado
    const resultado = await Resultado.create({
      paciente: paciente._id,
      cita: cita._id,
      factura: facturaVinculada || undefined,
      estudio: estudio._id,
      valores: valoresMapeados,
      estado: 'en_proceso',
      observaciones: `Recibido desde ${equipo.nombre} - Agente remoto - ${timestamp || new Date().toISOString()}`
    });

    if (facturaVinculada) {
      const codigos = (valores || []).map(v => ({ codigoEquipo: v.codigo }));
      await equipoService.marcarOrdenesComoCompletadas(equipo, { _id: facturaVinculada }, codigos);
    }

    console.log('? Resultado creado:', resultado._id);

    // Actualizar estadísticas del equipo
    await Equipo.findByIdAndUpdate(equipo._id, {
      ultimaConexion: new Date(),
      $inc: { 'estadisticas.resultadosRecibidos': 1 }
    });

    res.json({
      success: true,
      message: `Resultado recibido desde ${equipo.nombre}`,
      data: {
        resultadoId: resultado._id,
        codigoMuestra: resultado.codigoMuestra,
        paciente: `${paciente.nombre} ${paciente.apellido}`,
        valores: valoresMapeados.length
      },
      codigoMuestra: resultado.codigoMuestra
    });

  } catch (error) {
    console.error('? Error procesando resultado:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
