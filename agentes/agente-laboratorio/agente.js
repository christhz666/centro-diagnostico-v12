/**
 * ============================================================
 *  AGENTE DE LABORATORIO — Centro Diagnóstico
 * ============================================================
 *  Este agente corre en la PC del laboratorio y:
 *  1. Se conecta a los equipos (Mindray, Siemens, etc.)
 *     por Puerto Serial (COM) o TCP/IP
 *  2. Lee los resultados en formato ASTM o HL7
 *  3. Los envía al VPS por HTTPS
 * 
 *  USAR:
 *    node agente.js           → Modo normal (producción)
 *    node agente.js --test    → Envía un resultado de prueba
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const https = require('https');

// ── Detectar directorio real (pkg compila a snapshot interno) ─
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

// ── Cargar configuración ─────────────────────────────────────
const CONFIG_PATH = path.join(APP_DIR, 'config.json');
let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
} catch (err) {
    console.error('❌ No se pudo cargar config.json:', err.message);
    console.error('   Coloca config.json junto al .exe');
    process.exit(1);
}

const SERVER_URL = config.servidor.url.replace(/\/$/, '');
const LOG_FILE = path.join(APP_DIR, config.logArchivo || 'agente.log');

const CTRL = Object.freeze({
    ENQ: '\x05',
    ACK: '\x06',
    NAK: '\x15',
    EOT: '\x04',
    STX: '\x02',
    ETX: '\x03',
    ETB: '\x17',
    VT: '\x0B',
    FS: '\x1C',
    CR: '\x0D'
});

function hl7Timestamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function inferirTriggerACK(messageType = '') {
    const [, trigger = ''] = String(messageType).split('^');
    if (!trigger) return 'R01';
    // Mindray suele usar QRY^Q02 y espera ACK^Q03
    if (trigger === 'Q02') return 'Q03';
    return trigger;
}

function construirAckHL7(mensajeOriginal = '') {
    const segmentos = String(mensajeOriginal).split('\r').filter(Boolean);
    const mshSeg = segmentos.find(s => s.startsWith('MSH|')) || '';
    const msh = mshSeg.split('|');

    const sendingApp = msh[2] || '';
    const sendingFacility = msh[3] || '';
    const receivingApp = msh[4] || 'LIS';
    const receivingFacility = msh[5] || 'CENTRO_DIAG';
    const messageType = msh[8] || 'ORU^R01';
    const messageControlId = msh[9] || `${Date.now()}`;
    const version = msh[11] || '2.3.1';

    const ackTrigger = inferirTriggerACK(messageType);
    const ackType = `ACK^${ackTrigger}`;
    const ts = hl7Timestamp();

    return [
        `MSH|^~\\&|${receivingApp}|${receivingFacility}|${sendingApp}|${sendingFacility}|${ts}||${ackType}|${messageControlId}|P|${version}`,
        `MSA|AA|${messageControlId}|Message accepted`,
        ''
    ].join('\r');
}

function enviarAckHL7(socket, mensajeOriginal, nombreEquipo) {
    try {
        const ack = construirAckHL7(mensajeOriginal);
        socket.write(`${CTRL.VT}${ack}${CTRL.FS}${CTRL.CR}`);
        log('INFO', `↩️ ACK HL7 enviado a ${nombreEquipo}`);
    } catch (err) {
        log('ERROR', `❌ No se pudo enviar ACK HL7 a ${nombreEquipo}: ${err.message}`);
    }
}

function enviarAckASTM(writer, nombreEquipo, motivo = 'mensaje') {
    try {
        writer.write(Buffer.from([0x06])); // ACK
        log('INFO', `↩️ ACK ASTM enviado a ${nombreEquipo} (${motivo})`);
    } catch (err) {
        log('ERROR', `❌ No se pudo enviar ACK ASTM a ${nombreEquipo}: ${err.message}`);
    }
}

function responderControlASTM(writer, payload, nombreEquipo) {
    const chunk = Buffer.isBuffer(payload)
        ? payload.toString('binary')
        : String(payload || '');

    if (!chunk) return;

    const recibioENQ = chunk.includes(CTRL.ENQ);
    const recibioFrame = chunk.includes(CTRL.ETX) || chunk.includes(CTRL.ETB);

    if (recibioENQ) {
        enviarAckASTM(writer, nombreEquipo, 'ENQ');
    }
    if (recibioFrame) {
        enviarAckASTM(writer, nombreEquipo, 'FRAME');
    }
}

// ── Logging ──────────────────────────────────────────────────
function log(nivel, mensaje) {
    const ts = new Date().toLocaleString('es-DO');
    const linea = `[${ts}] [${nivel}] ${mensaje}`;
    console.log(linea);
    try { fs.appendFileSync(LOG_FILE, linea + '\n'); } catch { }
}

// ── Enviar resultados al VPS ─────────────────────────────────
async function enviarAlServidor(equipo, identificador, valores) {
    const data = JSON.stringify({
        station_name: require('os').hostname(),
        equipment_type: equipo.tipo,
        equipment_name: equipo.nombre,
        cedula: identificador,
        tipo_estudio: equipo.tipo,
        valores: valores.reduce((acc, v) => {
            acc[v.parametro || v.codigoEquipo] = {
                valor: v.valor,
                unidad: v.unidad || '',
                referencia: v.valorReferencia || '',
                estado: v.estado || 'normal'
            };
            return acc;
        }, {}),
        timestamp: new Date().toISOString()
    });

    return new Promise((resolve, reject) => {
        const url = new URL(`${SERVER_URL}/api/equipos/recibir-json`);
        const transport = url.protocol === 'https:' ? https : http;

        const req = transport.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.success) {
                        log('OK', `✅ Resultado enviado → Paciente: ${identificador} | Código muestra: ${parsed.codigoMuestra || 'N/A'}`);
                    } else {
                        log('WARN', `⚠️ Servidor respondió: ${parsed.message}`);
                    }
                    resolve(parsed);
                } catch {
                    log('ERROR', `Respuesta no-JSON del servidor: ${body}`);
                    reject(new Error(body));
                }
            });
        });

        req.on('error', (err) => {
            log('ERROR', `❌ No se pudo conectar al servidor: ${err.message}`);
            // Guardar en cola local
            guardarColaLocal(equipo, identificador, valores);
            reject(err);
        });

        req.write(data);
        req.end();
    });
}

// ── Cola local (cuando no hay internet) ──────────────────────
const COLA_PATH = path.join(APP_DIR, 'cola_pendiente.json');

function guardarColaLocal(equipo, identificador, valores) {
    let cola = [];
    try { cola = JSON.parse(fs.readFileSync(COLA_PATH, 'utf-8')); } catch { }
    cola.push({ equipo: equipo.nombre, identificador, valores, fecha: new Date().toISOString() });
    fs.writeFileSync(COLA_PATH, JSON.stringify(cola, null, 2));
    log('INFO', `📦 Resultado guardado en cola local (${cola.length} pendientes)`);
}

async function procesarColaLocal() {
    let cola = [];
    try { cola = JSON.parse(fs.readFileSync(COLA_PATH, 'utf-8')); } catch { return; }
    if (cola.length === 0) return;

    log('INFO', `📦 Procesando ${cola.length} resultado(s) de la cola local...`);
    const nuevaCola = [];

    for (const item of cola) {
        try {
            const equipoConfig = config.equipos.find(e => e.nombre === item.equipo) || { nombre: item.equipo, tipo: 'otro' };
            await enviarAlServidor(equipoConfig, item.identificador, item.valores);
        } catch {
            nuevaCola.push(item);
        }
    }

    fs.writeFileSync(COLA_PATH, JSON.stringify(nuevaCola, null, 2));
    if (nuevaCola.length < cola.length) {
        log('OK', `✅ ${cola.length - nuevaCola.length} resultado(s) enviados de la cola. ${nuevaCola.length} pendientes.`);
    }
}

// ── Parser ASTM ──────────────────────────────────────────────
function parsearASTM(datos) {
    const lineas = datos.split('\n');
    let identificador = null;
    const resultados = [];

    // Función para formatear las unidades feas de las máquinas
    const limpiarUnidad = (u) => {
        if (!u) return '';
        let limpia = u.trim();
        if (limpia === '10^3/uL' || limpia === '10e3/uL') return 'x 10³/µL';
        if (limpia === '10^6/uL' || limpia === '10e6/uL') return 'x 10⁶/µL';
        return limpia;
    };

    for (const linea of lineas) {
        const campos = linea.split('|');
        const tipo = campos[0]?.replace(/[\x02\x03\x05\x06]/g, '').trim();

        switch (tipo) {
            case 'H':
                log('INFO', '📡 Inicio de transmisión ASTM');
                break;
            case 'P':
                identificador = campos[2]?.trim() || null;
                break;
            case 'R':
                const codigo = campos[2]?.split('^')[3] || campos[2]?.trim();
                const valor = campos[3]?.trim();
                const unidadObj = campos[4]?.trim();
                const unidad = limpiarUnidad(unidadObj);
                const flag = campos[8]?.trim();
                if (codigo && valor) {
                    resultados.push({
                        codigoEquipo: codigo,
                        valor,
                        unidad: unidad || '',
                        estado: flag === 'N' ? 'normal' : flag === 'H' ? 'alto' : flag === 'L' ? 'bajo' : 'normal'
                    });
                }
                break;
            case 'L':
                log('INFO', '📡 Fin de transmisión ASTM');
                break;
        }
    }
    return { identificador, resultados };
}

// ── Parser HL7 ───────────────────────────────────────────────
function parsearHL7(datos) {
    const segmentos = datos.split('\r');
    let identificador = null;
    const resultados = [];

    // Función para formatear las unidades feas de las máquinas
    const limpiarUnidad = (u) => {
        if (!u) return '';
        let limpia = u.trim();
        if (limpia === '10^3/uL' || limpia === '10e3/uL') return 'x 10³/µL';
        if (limpia === '10^6/uL' || limpia === '10e6/uL') return 'x 10⁶/µL';
        return limpia;
    };

    for (const seg of segmentos) {
        const campos = seg.split('|');
        const tipo = campos[0]?.trim();

        switch (tipo) {
            case 'PID':
                identificador = campos[3]?.split('^')[0]?.trim() || campos[3]?.trim();
                break;
            case 'OBX':
                const codigo = campos[3]?.split('^')[0]?.trim();
                const valor = campos[5]?.trim();
                const unidadObj = campos[6]?.trim();
                const unidad = limpiarUnidad(unidadObj);
                const refRange = campos[7]?.trim();
                const flag = campos[8]?.trim();
                if (codigo && valor) {
                    resultados.push({
                        codigoEquipo: codigo,
                        valor,
                        unidad: unidad || '',
                        valorReferencia: refRange || '',
                        estado: flag === 'N' ? 'normal' : (flag === 'H' || flag === 'HH') ? 'alto' : (flag === 'L' || flag === 'LL') ? 'bajo' : 'normal'
                    });
                }
                break;
        }
    }
    return { identificador, resultados };
}

// ── Conectar por TCP/IP ──────────────────────────────────────
function conectarTCP(equipo) {
    const { ip, puerto, nombre, bindIp } = equipo;

    const server = net.createServer((socket) => {
        let buffer = '';
        log('OK', `📡 Conexión TCP recibida de ${socket.remoteAddress} para ${nombre}`);

        socket.on('data', (data) => {
            const chunk = Buffer.isBuffer(data) ? data.toString('binary') : String(data || '');
            buffer += chunk;

            // ASTM: responder handshake básico (ENQ/ETX/ETB -> ACK)
            responderControlASTM(socket, chunk, nombre);

            // HL7 sobre MLLP: <VT>...<FS><CR>
            const hl7Start = CTRL.VT;
            const hl7End = `${CTRL.FS}${CTRL.CR}`;
            let start = buffer.indexOf(hl7Start);
            let end = buffer.indexOf(hl7End);

            while (start !== -1 && end !== -1 && end > start) {
                const mensaje = buffer.substring(start + 1, end);
                const { identificador, resultados } = parsearHL7(mensaje);
                if (resultados.length > 0 && identificador) {
                    log('INFO', `📋 ${resultados.length} resultados HL7 de ${nombre} para ID: ${identificador}`);
                    enviarAlServidor(equipo, identificador, resultados).catch(() => { });
                }

                // Respuesta LIS requerida por varios equipos HL7
                enviarAckHL7(socket, mensaje, nombre);

                buffer = buffer.substring(end + hl7End.length);
                start = buffer.indexOf(hl7Start);
                end = buffer.indexOf(hl7End);
            }

            // Detectar fin de mensaje ASTM (L| record o ETX)
            if (buffer.includes('L|') || buffer.includes(CTRL.ETX) || buffer.includes(CTRL.EOT)) {
                const normalizado = buffer.replace(/\r/g, '\n');
                const { identificador, resultados } = parsearASTM(normalizado);
                if (resultados.length > 0 && identificador) {
                    log('INFO', `📋 ${resultados.length} resultados de ${nombre} para ID: ${identificador}`);
                    enviarAlServidor(equipo, identificador, resultados).catch(() => { });
                }
                buffer = '';
            }

            // Evitar crecimiento infinito de buffer en conexiones ruidosas
            if (buffer.length > 32768) {
                log('WARN', `⚠️ Buffer TCP grande en ${nombre}. Recortando para estabilidad.`);
                buffer = buffer.slice(-8192);
            }
        });

        socket.on('error', (err) => log('ERROR', `TCP error (${nombre}): ${err.message}`));
        socket.on('close', () => log('INFO', `Conexión cerrada: ${nombre}`));
    });

    const bind = bindIp || '0.0.0.0';
    server.listen(puerto, bind, () => {
        log('OK', `✅ TCP escuchando en ${bind}:${puerto} para ${nombre}`);
    });

    server.on('error', (err) => {
        log('ERROR', `❌ No se pudo abrir puerto ${puerto} para ${nombre}: ${err.message}`);
    });

    return server;
}

// ── Conectar por Puerto Serial (COM) ─────────────────────────
function conectarSerial(equipo) {
    const { comPort, baudRate, nombre } = equipo;

    try {
        let serialModule;
        if (process.pkg) {
            const m = require('module');
            const req = m.createRequire(path.join(process.cwd(), 'dummy.js'));
            serialModule = req('serialport');
        } else {
            serialModule = require('serialport');
        }
        const { SerialPort } = serialModule;

        const port = new SerialPort({
            path: comPort,
            baudRate: baudRate || 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        let buffer = '';

        port.on('data', (chunkBuffer) => {
            const chunk = Buffer.isBuffer(chunkBuffer)
                ? chunkBuffer.toString('binary')
                : String(chunkBuffer || '');

            buffer += chunk;

            // ASTM: responder handshake básico (ENQ/ETX/ETB -> ACK)
            responderControlASTM(port, chunk, nombre);

            // HL7 sobre serial con framing MLLP
            const hl7Start = CTRL.VT;
            const hl7End = `${CTRL.FS}${CTRL.CR}`;
            let start = buffer.indexOf(hl7Start);
            let end = buffer.indexOf(hl7End);

            while (start !== -1 && end !== -1 && end > start) {
                const mensaje = buffer.substring(start + 1, end);
                const { identificador, resultados } = parsearHL7(mensaje);
                if (resultados.length > 0 && identificador) {
                    log('INFO', `📋 ${resultados.length} resultados HL7 Serial de ${nombre} para ID: ${identificador}`);
                    enviarAlServidor(equipo, identificador, resultados).catch(() => { });
                }

                enviarAckASTM(port, nombre, 'HL7_MLLP');
                buffer = buffer.substring(end + hl7End.length);
                start = buffer.indexOf(hl7Start);
                end = buffer.indexOf(hl7End);
            }

            // ASTM por serial (fin por L|, ETX o EOT)
            if (buffer.includes('L|') || buffer.includes(CTRL.ETX) || buffer.includes(CTRL.EOT)) {
                const normalizado = buffer.replace(/\r/g, '\n');
                const { identificador, resultados } = parsearASTM(normalizado);
                if (resultados.length > 0 && identificador) {
                    log('INFO', `📋 ${resultados.length} resultados Serial de ${nombre} para ID: ${identificador}`);
                    enviarAlServidor(equipo, identificador, resultados).catch(() => { });
                }
                buffer = '';
            }

            if (buffer.length > 32768) {
                log('WARN', `⚠️ Buffer serial grande en ${nombre}. Recortando para estabilidad.`);
                buffer = buffer.slice(-8192);
            }
        });

        port.on('open', () => log('OK', `✅ Puerto serial ${comPort} abierto para ${nombre}`));
        port.on('error', (err) => {
            log('ERROR', `❌ Error serial ${comPort} (${nombre}): ${err.message}`);
            // Reintentar en 10 segundos
            setTimeout(() => conectarSerial(equipo), equipo.intervaloReconexion || 10000);
        });

        return port;
    } catch (err) {
        log('ERROR', `❌ No se pudo abrir ${comPort}: ${err.message}`);
        log('INFO', '   ¿Tienes el cable serial conectado? ¿Es el puerto correcto?');
        return null;
    }
}

// ── Modo TEST ────────────────────────────────────────────────
async function modoTest() {
    log('INFO', '🧪 MODO TEST — Enviando resultado simulado al servidor...');
    log('INFO', `   Servidor: ${SERVER_URL}`);

    const equipoTest = config.equipos[0] || { nombre: 'Equipo Test', tipo: 'hematologia' };

    const resultados = [
        { codigoEquipo: 'WBC', valor: '7.5', unidad: '10³/µL', estado: 'normal' },
        { codigoEquipo: 'RBC', valor: '4.8', unidad: '10⁶/µL', estado: 'normal' },
        { codigoEquipo: 'HGB', valor: '14.2', unidad: 'g/dL', estado: 'normal' },
        { codigoEquipo: 'PLT', valor: '285', unidad: '10³/µL', estado: 'normal' }
    ];

    try {
        const resp = await enviarAlServidor(equipoTest, '00000000000', resultados);
        console.log('\n📄 Respuesta completa del servidor:');
        console.log(JSON.stringify(resp, null, 2));
    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('   Verifica que la URL del servidor sea correcta en config.json');
    }

    process.exit(0);
}

// ── INICIO ───────────────────────────────────────────────────
async function inicio() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  🔬 Agente de Laboratorio — Centro Diagnóst ║');
    console.log('║     Recolector de resultados de equipos      ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    // Modo test?
    if (process.argv.includes('--test')) {
        return modoTest();
    }

    log('INFO', `Servidor VPS: ${SERVER_URL}`);
    log('INFO', `Equipos configurados: ${config.equipos.length}`);

    const conexiones = [];

    for (const equipo of config.equipos) {
        if (!equipo.activo) {
            log('INFO', `⏸️  ${equipo.nombre} — Inactivo (saltando)`);
            continue;
        }

        switch (equipo.protocolo) {
            case 'TCP':
                conexiones.push(conectarTCP(equipo));
                break;
            case 'SERIAL':
                const serial = conectarSerial(equipo);
                if (serial) conexiones.push(serial);
                break;
            default:
                log('WARN', `⚠️ Protocolo no soportado: ${equipo.protocolo} para ${equipo.nombre}`);
        }
    }

    // Procesar cola local cada 60 segundos
    setInterval(procesarColaLocal, 60000);
    procesarColaLocal();

    log('OK', `🟢 Agente corriendo. ${conexiones.length} conexión(es) activa(s)`);
    log('INFO', 'Presiona Ctrl+C para detener');
}

inicio().catch(err => {
    log('ERROR', `Error fatal: ${err.message}`);
    process.exit(1);
});
