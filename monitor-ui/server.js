/**
 * ============================================================
 *  MONITOR DE COMUNICACIONES UI — Centro Diagnóstico v2.0
 * ============================================================
 *  Servidor web con interfaz gráfica para monitorear
 *  comunicaciones de equipos de laboratorio en tiempo real.
 *
 *  ⚠️  SOLO LECTURA — No interfiere con otros programas
 *  📡 WebSocket para actualizaciones en tiempo real
 *  🌐 Interfaz web en http://localhost:3000
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const express = require('express');
const { WebSocketServer } = require('ws');

// ── Directorios base ─────────────────────────────────────────
// APP_DIR: config.json y logs → siempre en disco real junto al exe
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
// STATIC_DIR: public/index.html → en el snapshot de pkg cuando es exe
// (pkg embebe los assets con __dirname apuntando al snapshot interno)
const STATIC_DIR = __dirname;

// ── Cargar módulos ───────────────────────────────────────────
const Logger = require('./lib/logger');
const ProtocolDetector = require('./lib/protocol-detector');
const TCPProxy = require('./lib/tcp-proxy');
const SerialProxy = require('./lib/serial-proxy');

// ── Cargar configuración ─────────────────────────────────────
const CONFIG_PATH = path.join(APP_DIR, 'config.json');
let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
} catch (err) {
    console.error('❌ No se pudo cargar config.json:', err.message);
    process.exit(1);
}

// ── Directorio de logs ───────────────────────────────────────
const dirLogs = path.resolve(APP_DIR, config.directorioLogs || './logs');

// ── Estado global ────────────────────────────────────────────
const estado = {
    iniciado: new Date().toISOString(),
    equipos: {},
    mensajesCapturados: [],
    totalMensajes: 0,
    wsClientes: new Set()
};

// Límite de mensajes en memoria para la UI
const MAX_MENSAJES_UI = 500;

// ── Crear Logger con hook para WebSocket ─────────────────────
const logger = new Logger(dirLogs, config.opciones || {});
const detector = new ProtocolDetector();
const proxies = [];

// ── Función para emitir eventos a todos los clientes WS ──────
function emitirWS(tipo, datos) {
    const mensaje = JSON.stringify({ tipo, datos, ts: new Date().toISOString() });
    for (const cliente of estado.wsClientes) {
        if (cliente.readyState === 1) { // OPEN
            try { cliente.send(mensaje); } catch { }
        }
    }
}

// ── Wrapper del Logger para capturar datos ───────────────────
const loggerOriginalRegistrar = logger.registrarDatos.bind(logger);
logger.registrarDatos = function (nombreEquipo, direccion, datos, infoProtocolo) {
    // Llamar al método original (escribe en archivo)
    loggerOriginalRegistrar(nombreEquipo, direccion, datos, infoProtocolo);

    // Preparar datos para UI
    const buf = Buffer.isBuffer(datos) ? datos : Buffer.from(datos);
    const textoLegible = buf.toString('latin1')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, (c) => {
            return `<${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}>`;
        });

    const hex = Array.from(buf.slice(0, 512))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

    const mensajeUI = {
        id: Date.now() + Math.random(),
        ts: new Date().toISOString(),
        equipo: nombreEquipo,
        direccion,
        bytes: buf.length,
        protocolo: infoProtocolo?.protocolo || 'DESCONOCIDO',
        version: infoProtocolo?.version || '',
        detalles: infoProtocolo?.detalles || '',
        texto: textoLegible.substring(0, 2000),
        hex: hex.substring(0, 1500),
        truncado: buf.length > 512
    };

    // Agregar a la lista en memoria
    estado.mensajesCapturados.unshift(mensajeUI);
    if (estado.mensajesCapturados.length > MAX_MENSAJES_UI) {
        estado.mensajesCapturados.pop();
    }
    estado.totalMensajes++;

    // Actualizar estado del equipo
    if (!estado.equipos[nombreEquipo]) {
        estado.equipos[nombreEquipo] = {
            nombre: nombreEquipo,
            activo: true,
            totalMensajes: 0,
            ultimoMensaje: null,
            protocolos: {}
        };
    }
    const eq = estado.equipos[nombreEquipo];
    eq.totalMensajes++;
    eq.ultimoMensaje = mensajeUI.ts;
    eq.ultimoProtocolo = mensajeUI.protocolo;
    eq.protocolos[mensajeUI.protocolo] = (eq.protocolos[mensajeUI.protocolo] || 0) + 1;

    // Emitir por WebSocket
    emitirWS('mensaje', mensajeUI);
    emitirWS('estadoEquipo', eq);
};

// ── Express App ───────────────────────────────────────────────
const app = express();
app.use(express.json());
// Servir index.html desde el snapshot del exe (pkg embebe public/ con __dirname=snapshot)
// Fallback al disco real si no lo encuentra en el snapshot
app.use(express.static(path.join(STATIC_DIR, 'public')));
app.use(express.static(path.join(APP_DIR, 'public')));

// API: Estado general
app.get('/api/status', (req, res) => {
    res.json({
        iniciado: estado.iniciado,
        totalMensajes: estado.totalMensajes,
        equipos: Object.values(estado.equipos),
        uptime: process.uptime(),
        version: '2.0.0'
    });
});

// API: Mensajes capturados (con filtros)
app.get('/api/mensajes', (req, res) => {
    let mensajes = [...estado.mensajesCapturados];
    const { equipo, protocolo, limite = 100 } = req.query;

    if (equipo && equipo !== 'todos') {
        mensajes = mensajes.filter(m => m.equipo === equipo);
    }
    if (protocolo && protocolo !== 'todos') {
        mensajes = mensajes.filter(m => m.protocolo === protocolo);
    }

    res.json(mensajes.slice(0, parseInt(limite)));
});

// API: Configuración actual
app.get('/api/config', (req, res) => {
    res.json(config);
});

// API: Guardar configuración
app.post('/api/config', (req, res) => {
    try {
        const nuevaConfig = req.body;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(nuevaConfig, null, 4));
        config = nuevaConfig;
        res.json({ ok: true, mensaje: 'Configuración guardada. Reinicia el monitor para aplicar cambios.' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// API: Lista de logs disponibles
app.get('/api/logs', (req, res) => {
    try {
        if (!fs.existsSync(dirLogs)) return res.json([]);
        const archivos = fs.readdirSync(dirLogs)
            .filter(f => f !== '.gitkeep' && f.endsWith('.log'))
            .sort()
            .reverse()
            .slice(0, 50)
            .map(f => {
                const s = fs.statSync(path.join(dirLogs, f));
                return { nombre: f, tamano: s.size, modificado: s.mtime };
            });
        res.json(archivos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Leer contenido de un log
app.get('/api/logs/:nombre', (req, res) => {
    try {
        const archivo = path.join(dirLogs, path.basename(req.params.nombre));
        if (!fs.existsSync(archivo)) return res.status(404).json({ error: 'No encontrado' });
        const contenido = fs.readFileSync(archivo, 'utf-8');
        // Enviar últimas 200KB
        const limite = 200 * 1024;
        res.json({
            nombre: req.params.nombre,
            contenido: contenido.length > limite
                ? '... [archivo truncado, mostrando últimas 200KB] ...\n' + contenido.slice(-limite)
                : contenido
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Simular datos de prueba
app.post('/api/simular', (req, res) => {
    simularDatos();
    res.json({ ok: true, mensaje: 'Datos simulados generados' });
});

// API: Limpiar mensajes en memoria
app.post('/api/limpiar', (req, res) => {
    estado.mensajesCapturados = [];
    emitirWS('limpiar', {});
    res.json({ ok: true });
});

// ── Función de simulación ────────────────────────────────────
function simularDatos() {
    const mensajeASTM = [
        'H|\\^&|||Mindray BS-200|||||LIS|||LIS2-A|20260319140000',
        'P|1||0011234567||García^Juan||19850315|M',
        'O|1|001^01||^^^GLU|R||||||N||||||||||||||Q',
        'R|1|^^^GLU|95.5|mg/dL||N||F||||20260319140000',
        'R|2|^^^UREA|28.3|mg/dL||N||F||||20260319140000',
        'R|3|^^^CREA|0.95|mg/dL||N||F||||20260319140000',
        'R|4|^^^CHOL|185|mg/dL||N||F||||20260319140000',
        'L|1|N'
    ].join('\r\n');

    const infoASTM = detector.detectar(Buffer.from(mensajeASTM));
    logger.registrarDatos('Mindray BS-200 [SIM]', 'RECIBIDO', Buffer.from(mensajeASTM), infoASTM);

    setTimeout(() => {
        const mensajeHL7 = [
            '\x0BMSH|^~\\&|Mindray BC-6800|LAB|LIS|HOSPITAL|20260319||ORU^R01|1234|P|2.3.1',
            'PID|1||0011234567||García^Juan||19850315|M',
            'OBR|1|001^01|001^01|CBC|||20260319',
            'OBX|1|NM|WBC^Leucocitos||7.5|10³/µL|4.0-10.0|N|||F',
            'OBX|2|NM|RBC^Eritrocitos||4.8|10⁶/µL|4.5-5.5|N|||F',
            'OBX|3|NM|HGB^Hemoglobina||14.2|g/dL|13.0-17.0|N|||F',
            'OBX|4|NM|PLT^Plaquetas||285|10³/µL|150-400|N|||F\x1C\x0D'
        ].join('\r');

        const infoHL7 = detector.detectar(Buffer.from(mensajeHL7));
        logger.registrarDatos('Mindray BC-6800 [SIM]', 'RECIBIDO', Buffer.from(mensajeHL7), infoHL7);
    }, 800);

    setTimeout(() => {
        const enq = Buffer.from([0x05]);
        logger.registrarDatos('Mindray BS-200 [SIM]', 'RECIBIDO', enq, detector.detectar(enq));
    }, 1500);

    setTimeout(() => {
        const ack = Buffer.from([0x06]);
        logger.registrarDatos('Mindray BC-6800 [SIM]', 'ENVIADO', ack, detector.detectar(ack));
    }, 1800);
}

// ── Auto-escaneo de todos los puertos COM disponibles ───────
async function autoEscanearSerial() {
    try {
        // Cargar serialport desde disco real cuando corre como .exe (no del snapshot de pkg)
        let SerialPort;
        if (process.pkg) {
            const { createRequire } = require('module');
            const reqFs = createRequire(
                path.join(path.dirname(process.execPath), 'node_modules', 'serialport', 'package.json')
            );
            SerialPort = reqFs('serialport').SerialPort;
        } else {
            SerialPort = require('serialport').SerialPort;
        }
        const puertosDisponibles = await SerialPort.list();


        if (puertosDisponibles.length === 0) {
            logger.info('🔍 Auto-escaneo: No se encontraron puertos COM disponibles');
            return;
        }

        logger.info(`🔍 Auto-escaneo: ${puertosDisponibles.length} puerto(s) COM encontrado(s):`);
        for (const p of puertosDisponibles) {
            logger.info(`   ${p.path} — ${p.manufacturer || 'fabricante desconocido'} ${p.friendlyName || ''}`);
        }

        // Obtener puertos ya configurados manualmente para no duplicar
        const puertosManuales = config.equipos
            .filter(e => e.protocolo === 'SERIAL' && e.activo && e.serial?.puertoReal)
            .map(e => e.serial.puertoReal.toUpperCase());

        // Puertos a omitir (ambiguos o sistema)
        const omitir = ['COM1'];

        for (const puerto of puertosDisponibles) {
            const comPath = puerto.path.toUpperCase();

            // Saltar si ya está configurado manualmente
            if (puertosManuales.includes(comPath)) {
                logger.info(`   ↳ ${puerto.path} — ya configurado manualmente, saltando`);
                continue;
            }

            // Saltar puertos de sistema conocidos
            const nombreFriendly = (puerto.friendlyName || puerto.manufacturer || '').toLowerCase();
            if (nombreFriendly.includes('intel') && nombreFriendly.includes('management')) {
                logger.info(`   ↳ ${puerto.path} — Intel AMT (puerto de sistema), saltando`);
                continue;
            }
            if (omitir.includes(comPath) && !nombreFriendly.includes('usb') && !nombreFriendly.includes('serial')) {
                logger.info(`   ↳ ${puerto.path} — puerto de sistema, saltando`);
                continue;
            }

            // Intentar abrir este puerto como listener pasivo
            const nombreEquipo = `Auto-${puerto.path} (${puerto.manufacturer || 'desconocido'})`;
            logger.info(`   ↳ ${puerto.path} — intentando abrir como listener...`);

            const equipoAuto = {
                nombre: nombreEquipo,
                tipo: 'auto-detectado',
                protocolo: 'SERIAL',
                activo: true,
                serial: {
                    puertoReal: puerto.path,
                    baudRate: 9600,
                    dataBits: 8,
                    stopBits: 1,
                    parity: 'none'
                }
            };

            // Registrar en estado
            estado.equipos[nombreEquipo] = {
                nombre: nombreEquipo,
                tipo: 'auto-detectado',
                protocolo: 'SERIAL',
                activo: false,
                configurado: true,
                comPath: puerto.path,
                fabricante: puerto.manufacturer || 'desconocido',
                totalMensajes: 0,
                ultimoMensaje: null,
                protocolos: {}
            };

            const proxy = new SerialProxy(equipoAuto, logger, detector);
            const exito = await proxy.iniciar();
            if (exito) {
                proxies.push(proxy);
                estado.equipos[nombreEquipo].activo = true;
                logger.info(`   ✅ ${puerto.path} — abierto y escuchando`);
                emitirWS('estadoEquipo', estado.equipos[nombreEquipo]);
            } else {
                logger.info(`   ⚠️  ${puerto.path} — no se pudo abrir (posiblemente en uso por otro programa)`);
            }
        }
    } catch (err) {
        if (err.message.includes('Cannot find module')) {
            logger.info('⚠️  serialport no disponible para auto-escaneo');
        } else {
            logger.error(`Error en auto-escaneo: ${err.message}`);
        }
    }
}

// ── Iniciar proxies ──────────────────────────────────────────
async function iniciarProxies() {
    if (process.argv.includes('--test')) {
        logger.info('🧪 Modo TEST: generando datos simulados...');
        setTimeout(simularDatos, 1000);
        setTimeout(simularDatos, 5000);
        return;
    }

    for (const equipo of config.equipos) {
        // Registrar equipo en el estado
        estado.equipos[equipo.nombre] = {
            nombre: equipo.nombre,
            tipo: equipo.tipo,
            protocolo: equipo.protocolo,
            activo: false,
            configurado: equipo.activo,
            totalMensajes: 0,
            ultimoMensaje: null,
            protocolos: {}
        };

        if (!equipo.activo) {
            logger.info(`⏸️  ${equipo.nombre} — Inactivo (saltando)`);
            continue;
        }

        if (equipo.protocolo === 'TCP') {
            const proxy = new TCPProxy(equipo, logger, detector);
            const exito = await proxy.iniciar();
            if (exito) {
                proxies.push(proxy);
                estado.equipos[equipo.nombre].activo = true;
            }
        } else if (equipo.protocolo === 'SERIAL') {
            const proxy = new SerialProxy(equipo, logger, detector);
            const exito = await proxy.iniciar();
            if (exito) {
                proxies.push(proxy);
                estado.equipos[equipo.nombre].activo = true;
            }
        }
    }

    // Auto-escanear todos los puertos COM que no estén ya configurados
    logger.info('🔍 Iniciando auto-escaneo de puertos COM adicionales...');
    await autoEscanearSerial();
}

// ── Crear servidor HTTP + WebSocket ──────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    estado.wsClientes.add(ws);

    // Enviar estado inicial
    ws.send(JSON.stringify({
        tipo: 'estadoInicial',
        datos: {
            totalMensajes: estado.totalMensajes,
            equipos: Object.values(estado.equipos),
            mensajesRecientes: estado.mensajesCapturados.slice(0, 50)
        },
        ts: new Date().toISOString()
    }));

    ws.on('message', (msg) => {
        try {
            const { accion } = JSON.parse(msg.toString());
            if (accion === 'simular') simularDatos();
            if (accion === 'limpiar') {
                estado.mensajesCapturados = [];
                emitirWS('limpiar', {});
            }
        } catch { }
    });

    ws.on('close', () => estado.wsClientes.delete(ws));
    ws.on('error', () => estado.wsClientes.delete(ws));
});

// ── Arrancar servidor ────────────────────────────────────────
const PUERTO = config.puertUI || 3000;

server.listen(PUERTO, '0.0.0.0', async () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   📡 Monitor de Comunicaciones — Centro Diagnóstico  ║');
    console.log('║   Versión 2.0 | Interfaz Gráfica                     ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  🌐 Interfaz web: http://localhost:${PUERTO}`);
    console.log(`  📂 Logs en: ${dirLogs}`);
    console.log(`  ⚠️  Solo lectura — No interfiere con otros programas`);
    console.log('');

    logger.info(`Servidor web iniciado en http://0.0.0.0:${PUERTO}`);
    await iniciarProxies();

    console.log('');
    console.log(`  ✅ Monitor activo. Abre http://localhost:${PUERTO} en tu navegador.`);
    console.log('  ⏹️  Presiona Ctrl+C para detener\n');

    // Estadísticas periódicas
    setInterval(() => {
        emitirWS('ping', {
            totalMensajes: estado.totalMensajes,
            uptime: process.uptime()
        });
    }, 5000);
});

// ── Cierre limpio ────────────────────────────────────────────
process.on('SIGINT', () => {
    console.log('\n\n  ⛔ Deteniendo monitor...\n');
    for (const proxy of proxies) proxy.detener();
    server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
    logger.error(`Error no capturado: ${err.message}\n${err.stack}`);
});
