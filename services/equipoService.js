const Equipo = require('../models/Equipo');
const Resultado = require('../models/Resultado');
const OrdenEquipo = require('../models/OrdenEquipo');
const AgenteLog = require('../models/AgenteLog');
const EventEmitter = require('events');
const net = require('net');
const fs = require('fs');
const path = require('path');

class EquipoService extends EventEmitter {
  constructor() {
    super();
    this.conexiones = new Map();
    this.colas = new Map();
    this.intervaloProcesadorOrdenes = null;
    this.procesandoOrdenes = false;
  }

  async registrarLogAgente({ equipoId = null, source = 'server', level = 'info', event = '', message = '', payload = null }) {
    try {
      await AgenteLog.create({
        equipo: equipoId || undefined,
        source,
        level,
        event,
        message,
        payload,
        timestamp: new Date()
      });
    } catch (_) {
      // no-op para no bloquear flujo operativo
    }
  }

  // Iniciar monitoreo de todos los equipos activos
  async iniciarTodos() {
    const equipos = await Equipo.find({ estado: 'activo' });
    console.log(`🏥 Iniciando ${equipos.length} equipos...`);

    for (const equipo of equipos) {
      try {
        await this.iniciarEquipo(equipo._id);
      } catch (err) {
        console.error(`⚠️ Error iniciando equipo ${equipo.nombre} [ID:${equipo._id}]:`, err.message);
      }
    }

    this.iniciarProcesadorOrdenes();
  }

  iniciarProcesadorOrdenes() {
    if (this.intervaloProcesadorOrdenes) return;
    this.intervaloProcesadorOrdenes = setInterval(() => {
      this.procesarOrdenesPendientes().catch(err => {
        console.error('❌ Error en procesador de órdenes:', err.message);
      });
    }, 15000);
  }

  async obtenerResumenOrdenesPendientes() {
    const [pendientes, porEstadoRaw, porEquipoRaw, conErrores] = await Promise.all([
      OrdenEquipo.countDocuments({
        estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error'] }
      }),
      OrdenEquipo.aggregate([
        {
          $match: {
            estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error', 'completada', 'cancelada'] }
          }
        },
        {
          $group: {
            _id: '$estado',
            total: { $sum: 1 }
          }
        }
      ]),
      OrdenEquipo.aggregate([
        {
          $match: {
            estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error'] }
          }
        },
        {
          $group: {
            _id: '$equipo',
            total: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        },
        {
          $limit: 10
        },
        {
          $lookup: {
            from: 'equipos',
            localField: '_id',
            foreignField: '_id',
            as: 'equipo'
          }
        },
        {
          $project: {
            _id: 0,
            equipoId: '$_id',
            nombre: {
              $ifNull: [{ $arrayElemAt: ['$equipo.nombre', 0] }, 'Equipo']
            },
            total: 1
          }
        }
      ]),
      OrdenEquipo.find({ estado: 'error' })
        .sort({ updatedAt: -1 })
        .limit(20)
        .populate('equipo', 'nombre')
        .populate('factura', 'numero codigoId')
        .select('equipo factura ultimoError intentos ultimoIntento proximoIntento estado')
    ]);

    const porEstado = porEstadoRaw.reduce((acc, item) => {
      acc[item._id] = item.total;
      return acc;
    }, {});

    return {
      pendientes,
      porEstado,
      porEquipo: porEquipoRaw,
      erroresRecientes: conErrores.map(item => ({
        id: item._id,
        equipo: item.equipo?.nombre || 'Equipo',
        facturaNumero: item.factura?.numero || null,
        codigoId: item.factura?.codigoId || null,
        estado: item.estado,
        intentos: item.intentos || 0,
        ultimoError: item.ultimoError || null,
        ultimoIntento: item.ultimoIntento || null,
        proximoIntento: item.proximoIntento || null
      }))
    };
  }

  async obtenerOrdenesPendientesDetalladas(options = {}) {
    const limit = Number(options.limit || 1000);
    const safeLimit = Math.max(1, Math.min(limit, 5000));

    const estados = options.estados && Array.isArray(options.estados) && options.estados.length > 0
      ? options.estados
      : ['pendiente', 'enviada', 'en_proceso', 'error'];

    const query = {
      estado: { $in: estados }
    };

    if (options.equipoId) {
      query.equipo = options.equipoId;
    }

    const ordenes = await OrdenEquipo.find(query)
      .sort({ proximoIntento: 1, updatedAt: -1 })
      .limit(safeLimit)
      .populate('equipo', 'nombre protocolo estado')
      .populate('factura', 'numero codigoId')
      .populate('paciente', 'nombre apellido cedula')
      .lean();

    return ordenes.map(item => ({
      id: item._id,
      estado: item.estado,
      equipo: {
        id: item.equipo?._id || item.equipo,
        nombre: item.equipo?.nombre || 'Equipo',
        protocolo: item.equipo?.protocolo || null,
        estado: item.equipo?.estado || null
      },
      factura: {
        id: item.factura?._id || item.factura,
        numero: item.factura?.numero || null,
        codigoId: item.factura?.codigoId || item.codigoId || null
      },
      paciente: {
        id: item.paciente?._id || item.paciente,
        nombre: item.paciente ? `${item.paciente.nombre || ''} ${item.paciente.apellido || ''}`.trim() : (item.pacienteNombre || ''),
        cedula: item.paciente?.cedula || null
      },
      intentos: item.intentos || 0,
      ultimoError: item.ultimoError || null,
      ultimoIntento: item.ultimoIntento || null,
      proximoIntento: item.proximoIntento || null,
      pruebas: (item.pruebas || []).map(p => ({
        codigo: p.codigo,
        codigoEquipo: p.codigoEquipo || null,
        nombre: p.nombre,
        completada: !!p.completada,
        fechaCompletada: p.fechaCompletada || null
      }))
    }));
  }

  async obtenerOrdenesParaAgente(equipoId, limit = 200) {
    await this.sincronizarResultadosPendientesGlobales(equipoId);

    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 5000));

    const ordenes = await OrdenEquipo.find({
      equipo: equipoId,
      estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error'] }
    })
      .sort({ updatedAt: 1, createdAt: 1 })
      .limit(safeLimit)
      .populate('factura', 'numero codigoId')
      .populate('paciente', 'nombre apellido cedula')
      .lean();

    const payload = ordenes
      .map(item => {
        const pruebasPendientes = (item.pruebas || [])
          .filter(p => !p.completada)
          .map(p => ({
            codigo: p.codigoEquipo || p.codigo,
            nombre: p.nombre || p.codigo,
            codigoEquipo: p.codigoEquipo || null,
            estudioId: p.estudio || null
          }));

        if (pruebasPendientes.length === 0) return null;

        return {
          ordenId: item._id,
          codigoId: item.codigoId || item.factura?.codigoId || null,
          facturaNumero: item.factura?.numero || null,
          paciente: {
            id: item.paciente?._id || item.paciente || null,
            nombre: item.paciente
              ? `${item.paciente.nombre || ''} ${item.paciente.apellido || ''}`.trim()
              : (item.pacienteNombre || ''),
            cedula: item.paciente?.cedula || null
          },
          pruebas: pruebasPendientes,
          intentos: item.intentos || 0,
          estado: item.estado,
          proximoIntento: item.proximoIntento
        };
      })
      .filter(Boolean);

    await this.registrarLogAgente({
      equipoId,
      source: 'server',
      level: 'info',
      event: 'ordenes.pull.response',
      message: `Se entregaron ${payload.length} órdenes al agente`,
      payload: {
        count: payload.length,
        orderIds: payload.map(p => p.ordenId)
      }
    });

    return payload;
  }

  async ackOrdenesAgente(equipoId, orderIds = []) {
    const idsValidos = (orderIds || []).filter(Boolean);
    if (idsValidos.length === 0) {
      return { acked: 0 };
    }

    const result = await OrdenEquipo.updateMany(
      {
        _id: { $in: idsValidos },
        equipo: equipoId,
        estado: { $in: ['pendiente', 'enviada', 'error'] }
      },
      {
        $set: {
          estado: 'en_proceso',
          ultimoError: null,
          ultimoIntento: new Date()
        }
      }
    );

    const acked = result.modifiedCount || 0;

    await this.registrarLogAgente({
      equipoId,
      source: 'agente',
      level: 'info',
      event: 'ordenes.ack',
      message: `Agente confirmó ${acked} orden(es)`,
      payload: {
        orderIds: idsValidos,
        acked
      }
    });

    return { acked };
  }

  async registrarResultadosDesdeAgente(equipo, payload = {}) {
    const codigoId = payload.codigoId || payload.pacienteId || payload.cedula;
    const ordenId = payload.ordenId || null;
    const resultadosRaw = Array.isArray(payload.resultados) ? payload.resultados : [];

    if (!codigoId) {
      throw new Error('codigoId o pacienteId es requerido');
    }

    if (resultadosRaw.length === 0) {
      throw new Error('Debe enviar al menos un resultado');
    }

    const resultados = resultadosRaw.map(r => ({
      codigoEquipo: String(r.codigoEquipo || r.codigo || '').trim().toUpperCase(),
      valor: r.valor,
      unidad: r.unidad || '',
      valorReferencia: r.valorReferencia || r.referencia || '',
      estado: r.estado || 'normal'
    })).filter(r => r.codigoEquipo && r.valor !== undefined && r.valor !== null);

    if (resultados.length === 0) {
      throw new Error('Los resultados enviados no contienen códigos/valores válidos');
    }

    await this.registrarLogAgente({
      equipoId: equipo?._id,
      source: 'agente',
      level: 'info',
      event: 'resultados.submit.request',
      message: `Agente envió ${resultados.length} resultado(s)`,
      payload: {
        codigoId,
        ordenId,
        codigos: resultados.map(r => r.codigoEquipo)
      }
    });

    const guardado = await this.guardarResultados(equipo, String(codigoId), ordenId, resultados);

    await this.registrarLogAgente({
      equipoId: equipo?._id,
      source: 'server',
      level: 'info',
      event: 'resultados.submit.saved',
      message: 'Resultado guardado correctamente',
      payload: {
        codigoId,
        ordenId,
        resultadoId: guardado?._id || null
      }
    });

    return guardado;
  }

  async sincronizarResultadosPendientesGlobales(equipoId = null) {
    const Resultado = require('../models/Resultado');

    const pendientes = await Resultado.find({
      estado: { $in: ['pendiente', 'en_proceso'] },
      $or: [
        { valores: { $exists: false } },
        { valores: { $size: 0 } }
      ],
      factura: { $exists: true, $ne: null }
    }).select('factura');

    const facturaIds = [...new Set(pendientes
      .map(r => (r.factura?.toString ? r.factura.toString() : null))
      .filter(Boolean))];

    let totalEncoladas = 0;
    for (const facturaId of facturaIds) {
      try {
        const resultado = await this.sincronizarResultadosPendientesAFila(facturaId, { equipoId });
        totalEncoladas += resultado?.encoladas || 0;
      } catch (_) {
        // no-op por factura individual
      }
    }

    return { facturasProcesadas: facturaIds.length, encoladas: totalEncoladas };
  }

  // Iniciar comunicación con un equipo específico
  async iniciarEquipo(equipoId) {
    const equipo = await Equipo.findById(equipoId);
    if (!equipo) {
      const errorMsg = `Equipo no encontrado [ID:${equipoId}]`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`🔌 Conectando a ${equipo.nombre} (${equipo.protocolo})...`);

    switch (equipo.protocolo) {
      case 'ASTM':
        return this.iniciarASTM(equipo);
      case 'HL7':
        return this.iniciarHL7(equipo);
      case 'SERIAL':
        return this.iniciarSerial(equipo);
      case 'TCP':
        return this.iniciarTCP(equipo);
      case 'FILE':
        return this.iniciarFile(equipo);
      default:
        const errorMsg = `Protocolo ${equipo.protocolo} no soportado para equipo [ID:${equipo._id}]`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
  }

  // Protocolo ASTM (Mindray BS-200, BC-6800)
  async iniciarASTM(equipo) {
    console.log(`✅ ASTM iniciado para ${equipo.nombre}`);

    this.conexiones.set(equipo._id.toString(), {
      equipo,
      protocolo: 'ASTM',
      estado: 'conectado',
      procesarDatos: (datos) => this.procesarASTM(equipo, datos)
    });

    return true;
  }

  // Procesar mensaje ASTM
  async procesarASTM(equipo, mensaje) {
    const lineas = mensaje.split('\n');
    let pacienteId = null;
    let resultados = [];

    for (const linea of lineas) {
      const campos = linea.split('|');
      const tipo = campos[0];

      switch (tipo) {
        case 'H':
          console.log('📡 Recibiendo transmisión ASTM...');
          break;

        case 'P':
          pacienteId = campos[2];
          break;

        case 'R':
          const codigoTest = campos[2]?.split('^')[3] || campos[2];
          const valor = campos[3];
          const unidad = campos[4];
          const estado = campos[8];

          resultados.push({
            codigoEquipo: codigoTest,
            valor,
            unidad,
            estado: estado === 'N' ? 'normal' : estado === 'H' ? 'alto' : 'bajo'
          });
          break;
      }
    }

    if (resultados.length > 0) {
      await this.guardarResultados(equipo, pacienteId, null, resultados);
    }

    return resultados;
  }

  // Protocolo HL7 v2.x (Siemens, Abbott, Roche, Beckman Coulter)
  async iniciarHL7(equipo) {
    const config = equipo.configuracion || {};
    const port = config.puertoTcp || 2575;
    const host = config.ip || '0.0.0.0';

    const server = net.createServer((socket) => {
      let buffer = '';
      console.log(`📡 HL7 conexión desde ${socket.remoteAddress} para ${equipo.nombre}`);

      socket.on('data', (data) => {
        buffer += data.toString();
        // HL7 messages delimited by \x0B (VT) start and \x1C\x0D (FS+CR) end
        const startChar = '\x0B';
        const endChars = '\x1C\x0D';
        let startIdx = buffer.indexOf(startChar);
        let endIdx = buffer.indexOf(endChars);

        while (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const mensaje = buffer.substring(startIdx + 1, endIdx);
          buffer = buffer.substring(endIdx + 2);
          this.procesarHL7(equipo, mensaje).catch(err => {
            console.error(`❌ Error procesando HL7: ${err.message}`);
          });
          // Send ACK
          const ack = this.generarHL7ACK(mensaje);
          socket.write(`${startChar}${ack}${endChars}`);
          startIdx = buffer.indexOf(startChar);
          endIdx = buffer.indexOf(endChars);
        }
      });

      socket.on('error', (err) => {
        console.error(`❌ HL7 socket error (${equipo.nombre}):`, err.message);
      });
    });

    server.listen(port, host, () => {
      console.log(`✅ HL7 escuchando en ${host}:${port} para ${equipo.nombre}`);
    });

    server.on('error', (err) => {
      console.error(`❌ HL7 server error (${equipo.nombre}):`, err.message);
      this.actualizarEstadoEquipo(equipo._id, 'error', err.message);
    });

    this.conexiones.set(equipo._id.toString(), {
      equipo,
      protocolo: 'HL7',
      estado: 'conectado',
      server,
      procesarDatos: (datos) => this.procesarHL7(equipo, datos)
    });

    return true;
  }

  // Parse HL7 v2 message and extract results
  async procesarHL7(equipo, mensaje) {
    const segmentos = mensaje.split('\r');
    let pacienteId = null;
    let resultados = [];

    for (const segmento of segmentos) {
      const campos = segmento.split('|');
      const tipo = campos[0];

      switch (tipo) {
        case 'PID':
          // PID segment: patient ID in field 3
          pacienteId = campos[3]?.split('^')[0] || campos[3];
          break;

        case 'OBX':
          // OBX segment: observation result
          const codigoTest = campos[3]?.split('^')[0] || campos[3];
          const valor = campos[5];
          const unidad = campos[6];
          const refRange = campos[7];
          const abnFlag = campos[8];

          resultados.push({
            codigoEquipo: codigoTest,
            valor,
            unidad,
            valorReferencia: refRange,
            estado: abnFlag === 'N' ? 'normal' :
              abnFlag === 'H' || abnFlag === 'HH' ? 'alto' :
                abnFlag === 'L' || abnFlag === 'LL' ? 'bajo' : 'normal'
          });
          break;
      }
    }

    if (resultados.length > 0) {
      await this.guardarResultados(equipo, pacienteId, null, resultados);
    }

    return resultados;
  }

  // Generate HL7 ACK message
  generarHL7ACK(mensajeOriginal) {
    const segmentos = mensajeOriginal.split('\r');
    const msh = segmentos[0]?.split('|') || [];
    const msgId = msh[9] || '0';
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
    return `MSH|^~\\&|CENTRO_DIAG|LAB|${msh[3] || ''}|${msh[4] || ''}|${timestamp}||ACK|${msgId}|P|2.3\rMSA|AA|${msgId}\r`;
  }

  // Protocolo TCP genérico (equipos con conexión TCP/IP directa)
  async iniciarTCP(equipo) {
    const config = equipo.configuracion || {};
    const port = config.puertoTcp || 9100;
    const host = config.ip || '0.0.0.0';

    const server = net.createServer((socket) => {
      let buffer = '';
      console.log(`📡 TCP conexión desde ${socket.remoteAddress} para ${equipo.nombre}`);

      socket.on('data', (data) => {
        buffer += data.toString();
        // Process complete messages (newline delimited)
        const mensajes = buffer.split('\n');
        buffer = mensajes.pop() || '';

        for (const msg of mensajes) {
          if (msg.trim()) {
            this.procesarTCPData(equipo, msg.trim()).catch(err => {
              console.error(`❌ Error procesando TCP: ${err.message}`);
            });
          }
        }
      });

      socket.on('error', (err) => {
        console.error(`❌ TCP socket error (${equipo.nombre}):`, err.message);
      });
    });

    server.listen(port, host, () => {
      console.log(`✅ TCP escuchando en ${host}:${port} para ${equipo.nombre}`);
    });

    server.on('error', (err) => {
      console.error(`❌ TCP server error (${equipo.nombre}):`, err.message);
      this.actualizarEstadoEquipo(equipo._id, 'error', err.message);
    });

    this.conexiones.set(equipo._id.toString(), {
      equipo,
      protocolo: 'TCP',
      estado: 'conectado',
      server,
      procesarDatos: (datos) => this.procesarTCPData(equipo, datos)
    });

    return true;
  }

  // Process generic TCP data (try JSON first, then ASTM-like)
  async procesarTCPData(equipo, datos) {
    try {
      const parsed = JSON.parse(datos);
      if (parsed.cedula && parsed.valores) {
        await this.guardarResultados(equipo, parsed.cedula, null, parsed.valores.map(v => ({
          codigoEquipo: v.codigo || v.parametro,
          valor: v.valor,
          unidad: v.unidad || '',
          estado: v.estado || 'normal'
        })));
      }
    } catch {
      // Not JSON, try ASTM-like pipe-delimited
      await this.procesarASTM(equipo, datos);
    }
  }

  // Protocolo Serial (RS-232 / USB-Serial)
  async iniciarSerial(equipo) {
    const config = equipo.configuracion || {};
    const puerto = config.puerto || '/dev/ttyUSB0';

    try {
      // Dynamic import to avoid crash if serialport not available
      const { SerialPort } = require('serialport');
      const { ReadlineParser } = require('@serialport/parser-readline');

      const port = new SerialPort({
        path: puerto,
        baudRate: config.baudRate || 9600,
        dataBits: config.dataBits || 8,
        stopBits: config.stopBits || 1,
        parity: config.parity || 'none'
      });

      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      let buffer = '';

      parser.on('data', (line) => {
        buffer += line + '\n';
        // Check for end of transmission (ETX or L record in ASTM)
        if (line.startsWith('L|') || line.includes('\x03')) {
          this.procesarASTM(equipo, buffer).catch(err => {
            console.error(`❌ Error procesando Serial: ${err.message}`);
          });
          buffer = '';
        }
      });

      port.on('error', (err) => {
        console.error(`❌ Serial error (${equipo.nombre}):`, err.message);
        this.actualizarEstadoEquipo(equipo._id, 'error', err.message);
      });

      port.on('open', () => {
        console.log(`✅ Serial abierto ${puerto} para ${equipo.nombre}`);
      });

      this.conexiones.set(equipo._id.toString(), {
        equipo,
        protocolo: 'SERIAL',
        estado: 'conectado',
        port,
        procesarDatos: (datos) => this.procesarASTM(equipo, datos)
      });

      return true;
    } catch (err) {
      console.warn(`⚠️ SerialPort no disponible para ${equipo.nombre}: ${err.message}`);
      // Register connection in monitoring mode without actual serial
      this.conexiones.set(equipo._id.toString(), {
        equipo,
        protocolo: 'SERIAL',
        estado: 'sin_puerto',
        procesarDatos: (datos) => this.procesarASTM(equipo, datos)
      });
      return false;
    }
  }

  // Protocolo FILE (monitoreo de carpeta para archivos de resultados)
  async iniciarFile(equipo) {
    const config = equipo.configuracion || {};
    const rutaArchivos = config.rutaArchivos || path.join(__dirname, '../uploads/equipos', equipo._id.toString());

    // Ensure directory exists
    if (!fs.existsSync(rutaArchivos)) {
      fs.mkdirSync(rutaArchivos, { recursive: true });
    }

    const patron = config.patron || '*.txt';
    const procesados = new Set();

    const verificarArchivos = async () => {
      try {
        const archivos = fs.readdirSync(rutaArchivos);
        for (const archivo of archivos) {
          if (procesados.has(archivo)) continue;
          // Simple pattern matching
          const ext = patron.replaceAll('*', '');
          if (ext && !archivo.endsWith(ext)) continue;

          const rutaCompleta = path.join(rutaArchivos, archivo);
          const stat = fs.statSync(rutaCompleta);
          if (!stat.isFile()) continue;

          try {
            const contenido = fs.readFileSync(rutaCompleta, 'utf-8');
            procesados.add(archivo);
            console.log(`📄 Procesando archivo ${archivo} para ${equipo.nombre}`);

            // Try JSON format first
            try {
              const parsed = JSON.parse(contenido);
              if (parsed.cedula && parsed.valores) {
                await this.guardarResultados(equipo, parsed.cedula, null, parsed.valores.map(v => ({
                  codigoEquipo: v.codigo || v.parametro,
                  valor: v.valor,
                  unidad: v.unidad || '',
                  estado: v.estado || 'normal'
                })));
              }
            } catch {
              // Fallback to ASTM format
              await this.procesarASTM(equipo, contenido);
            }

            // Move processed file
            const procesadosDir = path.join(rutaArchivos, 'procesados');
            if (!fs.existsSync(procesadosDir)) {
              fs.mkdirSync(procesadosDir, { recursive: true });
            }
            fs.renameSync(rutaCompleta, path.join(procesadosDir, archivo));
          } catch (err) {
            console.error(`❌ Error procesando archivo ${archivo}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`❌ Error leyendo directorio ${rutaArchivos}:`, err.message);
      }
    };

    // Check for files every 10 seconds
    const intervalo = setInterval(verificarArchivos, 10000);
    verificarArchivos();

    console.log(`✅ FILE monitor iniciado en ${rutaArchivos} para ${equipo.nombre}`);

    this.conexiones.set(equipo._id.toString(), {
      equipo,
      protocolo: 'FILE',
      estado: 'conectado',
      intervalo,
      rutaArchivos,
      procesarDatos: (datos) => this.procesarASTM(equipo, datos)
    });

    return true;
  }

  // Helper: update equipment status in DB
  async actualizarEstadoEquipo(equipoId, estado, error) {
    const update = { estado };
    if (error) update.ultimoError = error;
    await Equipo.findByIdAndUpdate(equipoId, update);
  }

  // Encolar órdenes persistentes por factura para equipos bidireccionales
  async encolarOrdenesFactura(facturaId) {
    const Factura = require('../models/Factura');

    const factura = await Factura.findById(facturaId)
      .populate('paciente', 'nombre apellido cedula')
      .populate('cita')
      .populate('items.estudio', 'nombre codigo codigoLIS');

    if (!factura) {
      return { encoladas: 0, motivo: 'factura_no_encontrada' };
    }

    const pruebasPendientes = (factura.items || [])
      .filter(item => item?.estudio?.codigoLIS)
      .map(item => ({
        estudio: item.estudio._id,
        codigo: String(item.estudio.codigo || item.estudio.codigoLIS || '').trim().toUpperCase(),
        nombre: item.estudio.nombre,
        codigoEquipo: String(item.estudio.codigoLIS || '').trim().toUpperCase(),
        completada: false
      }))
      .filter(p => p.codigoEquipo);

    if (pruebasPendientes.length === 0) {
      return { encoladas: 0, motivo: 'sin_pruebas_codigo_equipo' };
    }

    const equiposBidireccionales = await Equipo.find({
      estado: 'activo',
      protocolo: { $in: ['ASTM', 'HL7'] },
      $or: [
        { 'integracion.modoEntrega': { $exists: false } },
        { 'integracion.modoEntrega': 'manual_pull' },
        { 'integracion.modoEntrega': 'push_socket' }
      ]
    }).select('_id nombre');

    let encoladas = 0;

    for (const equipo of equiposBidireccionales) {
      const existente = await OrdenEquipo.findOne({
        equipo: equipo._id,
        factura: factura._id,
        estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error'] }
      });

      if (existente) {
        const codigosExistentes = new Set(
          (existente.pruebas || [])
            .map(p => String(p.codigoEquipo || p.codigo || '').trim().toUpperCase())
            .filter(Boolean)
        );

        const faltantes = pruebasPendientes.filter(p => !codigosExistentes.has(p.codigoEquipo));
        if (faltantes.length > 0) {
          existente.pruebas.push(...faltantes);
          existente.estado = 'pendiente';
          existente.proximoIntento = new Date();
          await existente.save();
        }
        continue;
      }

      await OrdenEquipo.create({
        equipo: equipo._id,
        factura: factura._id,
        cita: factura.cita || null,
        paciente: factura.paciente?._id,
        pacienteNombre: factura.paciente
          ? `${factura.paciente.nombre || ''} ${factura.paciente.apellido || ''}`.trim()
          : '',
        codigoId: factura.codigoId || null,
        estado: 'pendiente',
        pruebas: pruebasPendientes,
        proximoIntento: new Date()
      });
      encoladas += 1;
    }

    this.iniciarProcesadorOrdenes();

    return {
      encoladas,
      equipos: equiposBidireccionales.length,
      pruebas: pruebasPendientes.length
    };
  }

  async sincronizarResultadosPendientesAFila(facturaId, options = {}) {
    const Factura = require('../models/Factura');
    const Resultado = require('../models/Resultado');

    const factura = await Factura.findById(facturaId)
      .populate('items.estudio', 'nombre codigo codigoLIS')
      .populate('paciente', 'nombre apellido cedula');

    if (!factura) {
      return { encoladas: 0, motivo: 'factura_no_encontrada' };
    }

    const estudiosPendientes = await Resultado.find({
      factura: factura._id,
      estado: { $in: ['pendiente', 'en_proceso'] },
      $or: [
        { valores: { $exists: false } },
        { valores: { $size: 0 } }
      ]
    }).populate('estudio', 'nombre codigo codigoLIS');

    const pruebasDesdeResultados = estudiosPendientes
      .filter(r => r.estudio?.codigoLIS)
      .map(r => ({
        estudio: r.estudio._id,
        codigo: String(r.estudio.codigo || r.estudio.codigoLIS || '').trim().toUpperCase(),
        nombre: r.estudio.nombre,
        codigoEquipo: String(r.estudio.codigoLIS || '').trim().toUpperCase(),
        completada: false
      }))
      .filter(p => p.codigoEquipo);

    if (pruebasDesdeResultados.length === 0) {
      return { encoladas: 0, motivo: 'sin_resultados_pendientes_con_codigo_equipo' };
    }

    const queryEquipos = {
      estado: 'activo',
      protocolo: { $in: ['ASTM', 'HL7'] },
      $or: [
        { 'integracion.modoEntrega': { $exists: false } },
        { 'integracion.modoEntrega': 'manual_pull' }
      ]
    };

    if (options.equipoId) {
      queryEquipos._id = options.equipoId;
    }

    const equiposManualPull = await Equipo.find(queryEquipos).select('_id nombre');

    let encoladas = 0;

    for (const equipo of equiposManualPull) {
      const existente = await OrdenEquipo.findOne({
        equipo: equipo._id,
        factura: factura._id,
        estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error'] }
      });

      if (existente) {
        const codigosExistentes = new Set((existente.pruebas || []).map(p => String(p.codigoEquipo || p.codigo || '').trim().toUpperCase()).filter(Boolean));
        const faltantes = pruebasDesdeResultados.filter(p => !codigosExistentes.has(p.codigoEquipo));
        if (faltantes.length > 0) {
          existente.pruebas.push(...faltantes);
          existente.estado = 'pendiente';
          existente.proximoIntento = new Date();
          await existente.save();
          encoladas += 1;
        }
        continue;
      }

      await OrdenEquipo.create({
        equipo: equipo._id,
        factura: factura._id,
        cita: factura.cita || null,
        paciente: factura.paciente?._id,
        pacienteNombre: factura.paciente ? `${factura.paciente.nombre || ''} ${factura.paciente.apellido || ''}`.trim() : '',
        codigoId: factura.codigoId || null,
        estado: 'pendiente',
        pruebas: pruebasDesdeResultados,
        proximoIntento: new Date()
      });
      encoladas += 1;
    }

    return { encoladas, pruebas: pruebasDesdeResultados.length, equipos: equiposManualPull.length };
  }

  async procesarOrdenesPendientes() {
    if (this.procesandoOrdenes) return;
    this.procesandoOrdenes = true;

    try {
      const ahora = new Date();
      const ordenes = await OrdenEquipo.find({
        estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error'] },
        proximoIntento: { $lte: ahora }
      })
        .sort({ proximoIntento: 1 })
        .limit(5000)
        .populate('paciente', 'nombre apellido cedula');

      for (const orden of ordenes) {
        try {
          const equipoId = orden.equipo?.toString ? orden.equipo.toString() : String(orden.equipo);
          const conexion = this.conexiones.get(equipoId);

          if (!conexion) {
            await OrdenEquipo.findByIdAndUpdate(orden._id, {
              estado: 'error',
              ultimoError: 'Equipo no conectado',
              ultimoIntento: new Date(),
              $inc: { intentos: 1 },
              proximoIntento: new Date(Date.now() + 30000)
            });
            continue;
          }

          const pruebasPendientes = (orden.pruebas || []).filter(p => !p.completada);
          if (pruebasPendientes.length === 0) {
            await OrdenEquipo.findByIdAndUpdate(orden._id, {
              estado: 'completada',
              fechaCompletado: new Date(),
              ultimoError: null
            });
            continue;
          }

          const pacienteIdEnvio = orden.codigoId || orden.paciente?.cedula || '';
          const pacienteNombreEnvio = orden.pacienteNombre ||
            `${orden.paciente?.nombre || ''} ${orden.paciente?.apellido || ''}`.trim();

          await this.enviarOrden(equipoId, {
            pacienteId: String(pacienteIdEnvio),
            pacienteNombre: pacienteNombreEnvio,
            ordenId: orden._id.toString(),
            pruebas: pruebasPendientes.map(p => ({
              codigo: p.codigoEquipo || p.codigo,
              nombre: p.nombre || p.codigo
            }))
          });

          await OrdenEquipo.findByIdAndUpdate(orden._id, {
            estado: 'en_proceso',
            ultimoError: null,
            ultimoIntento: new Date(),
            $inc: { intentos: 1 },
            proximoIntento: new Date(Date.now() + 60000)
          });
        } catch (errorOrden) {
          const intentos = (orden.intentos || 0) + 1;
          const backoffMs = Math.min(intentos, 10) * 30000;
          await OrdenEquipo.findByIdAndUpdate(orden._id, {
            estado: 'error',
            ultimoError: errorOrden.message,
            ultimoIntento: new Date(),
            $inc: { intentos: 1 },
            proximoIntento: new Date(Date.now() + backoffMs)
          });
        }
      }
    } finally {
      this.procesandoOrdenes = false;
    }
  }

  async marcarOrdenesComoCompletadas(equipo, facturaVinculada, resultados = []) {
    if (!equipo?._id || !facturaVinculada?._id) return;

    const codigosRecibidos = resultados
      .map(r => String(r.codigoEquipo || '').trim().toUpperCase())
      .filter(Boolean);

    if (codigosRecibidos.length === 0) return;

    const ordenes = await OrdenEquipo.find({
      equipo: equipo._id,
      factura: facturaVinculada._id,
      estado: { $in: ['pendiente', 'enviada', 'en_proceso', 'error'] }
    });

    for (const orden of ordenes) {
      let huboCambio = false;

      for (const prueba of orden.pruebas || []) {
        if (prueba.completada) continue;
        const codigosPrueba = [prueba.codigoEquipo, prueba.codigo]
          .map(v => String(v || '').trim().toUpperCase())
          .filter(Boolean);

        if (codigosPrueba.some(c => codigosRecibidos.includes(c))) {
          prueba.completada = true;
          prueba.fechaCompletada = new Date();
          huboCambio = true;
        }
      }

      if (huboCambio) {
        const todasCompletadas = (orden.pruebas || []).every(p => p.completada);
        orden.estado = todasCompletadas ? 'completada' : 'en_proceso';
        orden.ultimoError = null;
        if (todasCompletadas) {
          orden.fechaCompletado = new Date();
        }
        await orden.save();
      }
    }
  }

  // Enviar orden de trabajo a un equipo
  async enviarOrden(equipoId, ordenData) {
    const conexion = this.conexiones.get(equipoId.toString());
    if (!conexion) throw new Error('Equipo no conectado');

    const equipo = conexion.equipo;

    switch (conexion.protocolo) {
      case 'ASTM':
        return this.enviarOrdenASTM(equipo, conexion, ordenData);
      case 'HL7':
        return this.enviarOrdenHL7(equipo, conexion, ordenData);
      default:
        throw new Error(`Envío de órdenes no soportado para protocolo ${conexion.protocolo}`);
    }
  }

  // Format and send ASTM work order
  async enviarOrdenASTM(equipo, conexion, ordenData) {
    const mensaje = [
      `H|\\^&|||Centro Diagnóstico|||||||P|1|${new Date().toISOString()}`,
      `P|1|${ordenData.pacienteId}||${ordenData.pacienteNombre}`,
      ...ordenData.pruebas.map((p, i) => `O|${i + 1}|${ordenData.ordenId}||^^^${p.codigo}|R`),
      'L|1|N'
    ].join('\n');

    if (conexion.port && conexion.port.write) {
      conexion.port.write(mensaje + '\n');
    }

    return { enviado: true, mensaje };
  }

  // Format and send HL7 work order
  async enviarOrdenHL7(equipo, conexion, ordenData) {
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
    const mensaje = [
      `MSH|^~\\&|CENTRO_DIAG|LAB|${equipo.nombre}|LAB|${timestamp}||ORM^O01|${Date.now()}|P|2.3`,
      `PID|1||${ordenData.pacienteId}||${ordenData.pacienteNombre}`,
      ...ordenData.pruebas.map((p, i) =>
        `OBR|${i + 1}|${ordenData.ordenId}||${p.codigo}^${p.nombre}|||${timestamp}`
      )
    ].join('\r');

    return { enviado: true, mensaje };
  }

  // Guardar resultados en la base de datos
  // pacienteId puede ser: codigoId (número), cédula, o ID de paciente
  async guardarResultados(equipo, pacienteId, ordenId, resultados) {
    try {
      const Paciente = require('../models/Paciente');
      const Factura = require('../models/Factura');
      const Cita = require('../models/Cita');
      const Estudio = require('../models/Estudio');

      let paciente = null;
      let facturaVinculada = null;
      let cita = null;
      let estudio = null;

      // ── ESTRATEGIA 1: Buscar por codigoId en Facturas ──────────────
      // Las máquinas envían el ID de muestra corto (codigoId) que el
      // bioanalista teclea al procesar la muestra.
      const codigoNumerico = parseInt(pacienteId, 10);
      if (!isNaN(codigoNumerico) && codigoNumerico >= 1000 && codigoNumerico <= 99999) {
        facturaVinculada = await Factura.findOne({
          codigoId: codigoNumerico
        })
          .populate('paciente')
          .populate('cita');

        if (facturaVinculada && facturaVinculada.paciente) {
          paciente = facturaVinculada.paciente;
          cita = facturaVinculada.cita || null;
          console.log(`🔗 Resultado vinculado por codigoId ${codigoNumerico} → Paciente: ${paciente.nombre} ${paciente.apellido} → Factura: ${facturaVinculada.numero}`);
        }
      }

      // ── ESTRATEGIA 2: Buscar por cédula (fallback) ──────────────────
      if (!paciente && pacienteId) {
        paciente = await Paciente.findOne({ cedula: pacienteId });
        if (paciente) {
          console.log(`🔗 Resultado vinculado por cédula ${pacienteId} → Paciente: ${paciente.nombre} ${paciente.apellido}`);
        }
      }

      // ── Sin paciente encontrado: encolar para procesamiento posterior ─
      if (!paciente) {
        console.warn(`⚠️ Paciente no encontrado con identificador: ${pacienteId}. Encolando...`);
        this.colas.set(`${equipo._id}-${pacienteId}`, {
          equipo: equipo._id,
          pacienteId,
          resultados,
          fecha: new Date()
        });
        this.emit('resultadoEncolado', {
          equipo: equipo.nombre,
          identificador: pacienteId,
          cantidad: resultados.length
        });
        return null;
      }

      // ── Mapear parámetros del equipo a nombres legibles ─────────────
      const valoresMapeados = resultados.map(r => {
        const mapeo = equipo.mapeoParametros.find(m => m.codigoEquipo === r.codigoEquipo);
        return {
          codigoEquipo: String(r.codigoEquipo || '').trim().toUpperCase(),
          parametro: mapeo?.nombreParametro || r.codigoEquipo,
          valor: (parseFloat(r.valor) * (mapeo?.factor || 1)).toFixed(mapeo?.decimales || 2),
          unidad: mapeo?.unidad || r.unidad,
          valorReferencia: mapeo?.valorReferencia || r.valorReferencia,
          estado: r.estado
        };
      });

      // ── Buscar cita si no se encontró vía factura ──────────────────
      if (!cita && ordenId) {
        cita = await Cita.findById(ordenId);
      }
      if (!cita) {
        cita = await Cita.findOne({
          paciente: paciente._id,
          estado: { $in: ['programada', 'confirmada', 'en_proceso', 'completada'] }
        }).sort({ createdAt: -1 });
      }

      // ── Buscar estudio usando códigos LIS recibidos desde el equipo ─
      // Prioridad:
      // 1) Coincidencia exacta por Estudio.codigoLIS para cada resultado
      // 2) mapeoEstudios del equipo (compatibilidad)
      // 3) fallback al primer estudio
      const codigosRecibidos = resultados
        .map(r => (r.codigoEquipo || '').toString().trim().toUpperCase())
        .filter(Boolean);

      const estudiosPorCodigo = new Map();

      if (codigosRecibidos.length > 0) {
        const estudiosCoincidentes = await Estudio.find({
          codigoLIS: { $in: codigosRecibidos }
        }).select('_id codigoLIS');
        for (const e of estudiosCoincidentes) {
          estudiosPorCodigo.set(String(e.codigoLIS || '').trim().toUpperCase(), e._id);
        }

        // estudio principal para compatibilidad con flujo existente
        estudio = estudiosCoincidentes[0] || null;
      }

      if (!estudio) {
        const mapeoEstudio = equipo.mapeoEstudios && equipo.mapeoEstudios.length > 0
          ? equipo.mapeoEstudios[0]
          : null;
        if (mapeoEstudio) {
          estudio = await Estudio.findById(mapeoEstudio.estudioId);
        }
      }

      if (!estudio) {
        estudio = await Estudio.findOne();
      }

      // ── Auto-crear cita si no existe (para equipos que envían sin orden) ─
      if (!cita && estudio) {
        const ahora = new Date();
        cita = await Cita.create({
          paciente: paciente._id,
          fecha: ahora,
          horaInicio: ahora.toTimeString().slice(0, 5),
          estudios: [{
            estudio: estudio._id,
            precio: estudio.precio || 0
          }],
          estado: 'completada',
          motivo: `Auto - ${equipo.nombre}`
        });
      }

      // ── Crear/actualizar Resultados por cada código LIS recibido ───
      let resultado = null;
      const gruposPorCodigo = new Map();
      for (const valor of valoresMapeados) {
        const cod = String(valor.codigoEquipo || '').trim().toUpperCase();
        const key = cod || '__SIN_CODIGO__';
        if (!gruposPorCodigo.has(key)) gruposPorCodigo.set(key, []);
        gruposPorCodigo.get(key).push(valor);
      }

      for (const [codigoGrupo, valoresGrupo] of gruposPorCodigo) {
        const estudioIdGrupo = estudiosPorCodigo.get(codigoGrupo) || (estudio ? estudio._id : undefined);

        // Intentar actualizar placeholder pendiente (valores vacíos) para este estudio/factura
        let existente = null;
        if (facturaVinculada && estudioIdGrupo) {
          existente = await Resultado.findOne({
            factura: facturaVinculada._id,
            estudio: estudioIdGrupo,
            estado: { $in: ['pendiente', 'en_proceso'] },
            $or: [
              { valores: { $exists: false } },
              { valores: { $size: 0 } }
            ]
          }).sort({ createdAt: 1 });
        }

        if (existente) {
          existente.valores = valoresGrupo;
          existente.estado = 'en_proceso';
          existente.observaciones = `Recibido automáticamente desde ${equipo.nombre}${facturaVinculada ? ` (ID: ${facturaVinculada.codigoId})` : ''}`;
          existente.fechaRealizacion = new Date();
          await existente.save();
          resultado = existente;
        } else {
          const creado = await Resultado.create({
            paciente: paciente._id,
            cita: cita ? cita._id : undefined,
            factura: facturaVinculada ? facturaVinculada._id : undefined,
            estudio: estudioIdGrupo,
            valores: valoresGrupo,
            estado: 'en_proceso',
            observaciones: `Recibido automáticamente desde ${equipo.nombre}${facturaVinculada ? ` (ID: ${facturaVinculada.codigoId})` : ''}`,
            fechaRealizacion: new Date()
          });
          resultado = creado;
        }
      }

      if (facturaVinculada) {
        await this.marcarOrdenesComoCompletadas(equipo, facturaVinculada, resultados);
      }

      // ── Actualizar estadísticas del equipo ─────────────────────────
      await Equipo.findByIdAndUpdate(equipo._id, {
        ultimaConexion: new Date(),
        $inc: { 'estadisticas.resultadosRecibidos': 1 },
        'estadisticas.ultimoResultado': new Date()
      });

      // ── Emitir evento para notificaciones en tiempo real ───────────
      this.emit('nuevoResultado', {
        equipo: equipo.nombre,
        paciente: `${paciente.nombre} ${paciente.apellido}`,
        resultado: resultado._id,
        codigoId: facturaVinculada?.codigoId || null,
        factura: facturaVinculada?.numero || null
      });

      console.log(`✅ Resultado guardado: ${paciente.nombre} ${paciente.apellido}${facturaVinculada ? ` | Factura: ${facturaVinculada.numero} | ID: ${facturaVinculada.codigoId}` : ''}`);
      return resultado;

    } catch (error) {
      console.error('❌ Error guardando resultado:', error);
      await Equipo.findByIdAndUpdate(equipo._id, {
        ultimoError: error.message,
        $inc: { 'estadisticas.errores': 1 }
      });
      throw error;
    }
  }

  // Detener equipo
  async detenerEquipo(equipoId) {
    const conexion = this.conexiones.get(equipoId.toString());
    if (conexion) {
      // Cleanup resources
      if (conexion.server) {
        conexion.server.close();
      }
      if (conexion.port && conexion.port.isOpen) {
        conexion.port.close();
      }
      if (conexion.intervalo) {
        clearInterval(conexion.intervalo);
      }
      this.conexiones.delete(equipoId.toString());
      console.log(`🔌 Equipo desconectado: ${conexion.equipo.nombre}`);
    }
  }

  // Obtener estado de todos los equipos
  obtenerEstados() {
    const estados = [];
    for (const [id, conexion] of this.conexiones) {
      estados.push({
        id,
        nombre: conexion.equipo.nombre,
        estado: conexion.estado,
        protocolo: conexion.protocolo
      });
    }
    return estados;
  }

  // Procesar cola pendiente (reintentar resultados sin paciente)
  async procesarCola() {
    for (const [key, item] of this.colas) {
      const Paciente = require('../models/Paciente');
      const Factura = require('../models/Factura');

      let paciente = null;

      // Intentar buscar por codigoId primero
      const codigoNumerico = parseInt(item.pacienteId, 10);
      if (!isNaN(codigoNumerico) && codigoNumerico >= 1000 && codigoNumerico <= 99999) {
        const factura = await Factura.findOne({ codigoId: codigoNumerico }).populate('paciente');
        if (factura && factura.paciente) {
          paciente = factura.paciente;
        }
      }

      // Fallback: buscar por cédula
      if (!paciente) {
        paciente = await Paciente.findOne({ cedula: item.pacienteId });
      }

      if (paciente) {
        const equipo = await Equipo.findById(item.equipo);
        if (equipo) {
          await this.guardarResultados(equipo, item.pacienteId, null, item.resultados);
          this.colas.delete(key);
          console.log(`📦 Cola procesada: ${key} → ${paciente.nombre} ${paciente.apellido}`);
        }
      }
    }
  }
}

module.exports = new EquipoService();
