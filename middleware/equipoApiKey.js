const Equipo = require('../models/Equipo');

const validarEquipoApiKey = async (req, res, next) => {
  try {
    const headerApiKey = req.headers['x-equipo-api-key'] || req.headers['x-api-key'];
    const apiKey = typeof headerApiKey === 'string' ? headerApiKey.trim() : '';
    const equipoId = req.params.id;

    if (!equipoId) {
      return res.status(400).json({ success: false, message: 'Equipo ID requerido' });
    }

    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key requerida' });
    }

    const equipo = await Equipo.findById(equipoId).select('+integracion.apiKeyHash');
    if (!equipo) {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    }

    const valido = equipo.validarApiKeyIntegracion(apiKey);
    if (!valido) {
      return res.status(401).json({ success: false, message: 'API key inválida' });
    }

    req.equipoAutenticado = equipo;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { validarEquipoApiKey };
