const Equipo = require('../models/Equipo');
const equipoService = require('../services/equipoService');

const sanitizarEquipo = (equipo) => {
  const obj = equipo.toObject ? equipo.toObject() : equipo;
  if (obj?.integracion) {
    delete obj.integracion.apiKeyHash;
  }
  return obj;
};

// Obtener todos los equipos (SIN servicio)
exports.getEquipos = async (req, res) => {
  try {
    console.log('?? GET /api/equipos - Consultando...');
    
    const equipos = await Equipo.find().sort({ nombre: 1 });
    
    console.log(`? Encontrados: ${equipos.length} equipos`);
    
    // Devolver directamente sin verificar estado de conexión
    res.json(equipos.map(sanitizarEquipo));
  } catch (error) {
    console.error('? Error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// Obtener estado de conexiones
exports.getEstadoConexiones = async (req, res) => {
  try {
    const estados = equipoService.obtenerEstados();
    res.json(estados);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener un equipo por ID
exports.getEquipo = async (req, res) => {
  try {
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    res.json(sanitizarEquipo(equipo));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear equipo
exports.createEquipo = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.integracion && typeof payload.integracion === 'object') {
      delete payload.integracion.apiKeyHash;
      delete payload.integracion.apiKeyUltimos4;
      delete payload.integracion.apiKeyGeneradaEn;
    }

    const equipo = new Equipo(payload);
    await equipo.save();
    res.status(201).json(sanitizarEquipo(equipo));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar equipo
exports.updateEquipo = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.integracion && typeof payload.integracion === 'object') {
      delete payload.integracion.apiKeyHash;
      delete payload.integracion.apiKeyUltimos4;
      delete payload.integracion.apiKeyGeneradaEn;
    }

    const equipo = await Equipo.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!equipo) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    res.json(sanitizarEquipo(equipo));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar equipo
exports.deleteEquipo = async (req, res) => {
  try {
    const equipo = await Equipo.findByIdAndDelete(req.params.id);
    if (!equipo) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    res.json({ message: 'Equipo eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Funciones de conexión (stubs por ahora)
exports.conectarEquipo = async (req, res) => {
  try {
    const equipo = await Equipo.findByIdAndUpdate(
      req.params.id,
      { estado: 'activo', ultimaConexion: new Date() },
      { new: true }
    );
    if (!equipo) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    await equipoService.iniciarEquipo(equipo._id);

    res.json({ message: 'Equipo marcado como activo', equipo: sanitizarEquipo(equipo) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.desconectarEquipo = async (req, res) => {
  try {
    const equipo = await Equipo.findByIdAndUpdate(
      req.params.id,
      { estado: 'inactivo' },
      { new: true }
    );
    if (!equipo) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    await equipoService.detenerEquipo(equipo._id);

    res.json({ message: 'Equipo desconectado', equipo: sanitizarEquipo(equipo) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.generarApiKeyIntegracion = async (req, res) => {
  try {
    const equipo = await Equipo.findById(req.params.id).select('+integracion.apiKeyHash');
    if (!equipo) {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    }

    const apiKeyPlano = equipo.generarApiKeyIntegracion();
    await equipo.save();

    return res.json({
      success: true,
      message: 'API key generada. Guárdala, no se mostrará nuevamente completa.',
      data: {
        equipoId: equipo._id,
        apiKey: apiKeyPlano,
        ultimos4: equipo.integracion?.apiKeyUltimos4 || apiKeyPlano.slice(-4),
        generadaEn: equipo.integracion?.apiKeyGeneradaEn || new Date(),
        apiBaseUrl: equipo.integracion?.apiBaseUrl || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.actualizarIntegracionEquipo = async (req, res) => {
  try {
    const { equipoIpMindray, apiBaseUrl, agenteVersion, modoEntrega } = req.body || {};
    const update = {
      'integracion.equipoIpMindray': equipoIpMindray || '',
      'integracion.apiBaseUrl': apiBaseUrl || '',
      'integracion.agenteVersion': agenteVersion || '',
      'integracion.modoEntrega': modoEntrega || 'manual_pull'
    };

    const equipo = await Equipo.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!equipo) {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    }

    return res.json({ success: true, data: sanitizarEquipo(equipo) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.registrarHeartbeatEquipo = async (req, res) => {
  try {
    const equipo = req.equipoAutenticado;
    const { equipoIpMindray, agenteVersion } = req.body || {};

    if (equipoIpMindray) {
      equipo.integracion = equipo.integracion || {};
      equipo.integracion.equipoIpMindray = equipoIpMindray;
    }
    if (agenteVersion) {
      equipo.integracion = equipo.integracion || {};
      equipo.integracion.agenteVersion = agenteVersion;
    }
    equipo.integracion = equipo.integracion || {};
    equipo.integracion.ultimoHeartbeat = new Date();
    await equipo.save();

    return res.json({
      success: true,
      message: 'Heartbeat recibido',
      data: {
        equipoId: equipo._id,
        nombre: equipo.nombre,
        timestamp: equipo.integracion.ultimoHeartbeat
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.probarConexion = async (req, res) => {
  res.json({ 
    success: true, 
    message: 'Prueba de conexión simulada',
    timestamp: new Date()
  });
};

exports.enviarOrden = async (req, res) => {
  res.json({ 
    success: true, 
    message: 'Función de envío de orden no implementada aún' 
  });
};

module.exports = exports;
