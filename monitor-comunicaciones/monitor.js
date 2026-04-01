/**
 * ============================================================
 *  MONITOR DE COMUNICACIONES — Centro Diagnóstico
 * ============================================================
 *  Programa de SOLO LECTURA que registra todas las
 *  comunicaciones de los equipos de laboratorio para
 *  identificar sus métodos de comunicación.
 *
 *  ⚠️  NO INTERFIERE con el software existente
 *  ⚠️  NO modifica datos
 *  ⚠️  Solo OBSERVA y REGISTRA
 *
 *  MODOS DE OPERACIÓN:
 *
 *  1. PROXY TCP: Se coloca entre el equipo y el agente,
 *     reenvía todo transparentemente mientras registra.
 *
 *  2. PROXY SERIAL: Lee del puerto serial real y registra
 *     todo lo recibido. Para proxy completo (bidireccional),
 *     se usa socat en Linux para crear puertos virtuales.
 *
 *  3. TEST: Simula datos de equipos para verificar que
 *     el sistema de registro funciona correctamente.
 *
 *  USO:
 *    node monitor.js            → Modo normal (producción)
 *    node monitor.js --test     → Modo test con datos simulados
 *    node monitor.js --stats    → Muestra estadísticas
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

// ── Directorio de la aplicación ──────────────────────────────
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

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
    console.error('   Coloca config.json junto al monitor.js');
    process.exit(1);
}

// ── Inicializar componentes ──────────────────────────────────
const dirLogs = path.resolve(APP_DIR, config.directorioLogs || './logs');
const logger = new Logger(dirLogs, config.opciones || {});
const detector = new ProtocolDetector();

// ── Almacenar proxies activos ────────────────────────────────
const proxies = [];

// ── Modo TEST ────────────────────────────────────────────────
function modoTest() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  🧪 MODO TEST — Simulación de comunicación  ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    logger.info('Iniciando modo test — datos simulados');

    // Simular mensaje ASTM
    const mensajeASTM = [
        'H|\\^&|||Mindray BS-200|||||LIS|||LIS2-A|20260315120000',
        'P|1||0011234567||García^Juan||19850315|M',
        'O|1|001^01||^^^GLU|R||||||N||||||||||||||Q',
        'R|1|^^^GLU|95.5|mg/dL||N||F||||20260315120000',
        'R|2|^^^UREA|28.3|mg/dL||N||F||||20260315120000',
        'R|3|^^^CREA|0.95|mg/dL||N||F||||20260315120000',
        'R|4|^^^CHOL|185|mg/dL||N||F||||20260315120000',
        'L|1|N'
    ].join('\r\n');

    logger.info('Simulando mensaje ASTM...');
    const infoASTM = detector.detectar(Buffer.from(mensajeASTM));
    logger.registrarDatos('TEST-ASTM', 'RECIBIDO', Buffer.from(mensajeASTM), infoASTM);
    console.log(`\n  Resultado ASTM: ${infoASTM.detalles}\n`);

    // Simular mensaje HL7
    const mensajeHL7 = [
        '\x0BMSH|^~\\&|Mindray BC-6800|LAB|LIS|HOSPITAL|20260315||ORU^R01|1234|P|2.3.1',
        'PID|1||0011234567||García^Juan||19850315|M',
        'OBR|1|001^01|001^01|CBC|||20260315',
        'OBX|1|NM|WBC^Leucocitos||7.5|10³/µL|4.0-10.0|N|||F',
        'OBX|2|NM|RBC^Eritrocitos||4.8|10⁶/µL|4.5-5.5|N|||F',
        'OBX|3|NM|HGB^Hemoglobina||14.2|g/dL|13.0-17.0|N|||F',
        'OBX|4|NM|PLT^Plaquetas||285|10³/µL|150-400|N|||F\x1C\x0D'
    ].join('\r');

    logger.info('Simulando mensaje HL7...');
    const infoHL7 = detector.detectar(Buffer.from(mensajeHL7));
    logger.registrarDatos('TEST-HL7', 'RECIBIDO', Buffer.from(mensajeHL7), infoHL7);
    console.log(`  Resultado HL7: ${infoHL7.detalles}\n`);

    // Simular handshake ASTM
    logger.info('Simulando handshake ASTM...');
    const enq = detector.detectar(Buffer.from([0x05]));
    logger.registrarDatos('TEST-HANDSHAKE', 'RECIBIDO', Buffer.from([0x05]), enq);
    console.log(`  ENQ: ${enq.detalles}`);

    const ack = detector.detectar(Buffer.from([0x06]));
    logger.registrarDatos('TEST-HANDSHAKE', 'ENVIADO', Buffer.from([0x06]), ack);
    console.log(`  ACK: ${ack.detalles}`);

    const eot = detector.detectar(Buffer.from([0x04]));
    logger.registrarDatos('TEST-HANDSHAKE', 'RECIBIDO', Buffer.from([0x04]), eot);
    console.log(`  EOT: ${eot.detalles}`);

    // Simular datos RAW (protocolo propietario)
    logger.info('\nSimulando datos propietarios (RAW)...');
    const datosRaw = Buffer.from('ABX;001;WBC;7.5;RBC;4.8;HGB;14.2;PLT;285;END\r\n');
    const infoRaw = detector.detectar(datosRaw);
    logger.registrarDatos('TEST-RAW', 'RECIBIDO', datosRaw, infoRaw);
    console.log(`  Resultado RAW: ${infoRaw.detalles}\n`);

    // Mostrar estadísticas
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  📊 Estadísticas de detección               ║');
    console.log('╚══════════════════════════════════════════════╝');
    const stats = detector.obtenerEstadisticas();
    for (const [equipo, data] of Object.entries(stats)) {
        console.log(`\n  ${equipo}:`);
        console.log(`    Mensajes: ${data.totalMensajes}`);
        console.log(`    Protocolos: ${JSON.stringify(data.protocolosDetectados)}`);
    }

    console.log(`\n✅ Logs guardados en: ${dirLogs}`);
    console.log('   Revisa los archivos .log para ver el registro detallado');
    console.log('   Revisa los archivos .raw para ver los datos binarios\n');
}

// ── Modo ESTADÍSTICAS ────────────────────────────────────────
function modoStats() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  📊 Archivos de log disponibles             ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    if (!fs.existsSync(dirLogs)) {
        console.log('  No hay directorio de logs todavía.');
        return;
    }

    const archivos = fs.readdirSync(dirLogs)
        .filter(f => f !== '.gitkeep')
        .sort();

    if (archivos.length === 0) {
        console.log('  No hay archivos de log todavía. Ejecuta el monitor primero.');
        return;
    }

    for (const archivo of archivos) {
        const filePath = path.join(dirLogs, archivo);
        const stats = fs.statSync(filePath);
        const tamano = stats.size < 1024 ? `${stats.size} B` :
            stats.size < 1048576 ? `${(stats.size / 1024).toFixed(1)} KB` :
                `${(stats.size / 1048576).toFixed(1)} MB`;
        const fecha = stats.mtime.toLocaleString('es-DO');
        console.log(`  📄 ${archivo.padEnd(45)} ${tamano.padStart(10)}  ${fecha}`);
    }
    console.log('');
}

// ── INICIO PRINCIPAL ─────────────────────────────────────────
async function inicio() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  📡 Monitor de Comunicaciones — Lab         ║');
    console.log('║     Registro pasivo (NO interfiere)         ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    // Verificar argumentos
    if (process.argv.includes('--test')) {
        return modoTest();
    }
    if (process.argv.includes('--stats')) {
        return modoStats();
    }

    logger.info('Iniciando monitor de comunicaciones...');
    logger.info(`Directorio de logs: ${dirLogs}`);
    logger.info(`Equipos configurados: ${config.equipos.length}`);

    let equiposActivos = 0;

    for (const equipo of config.equipos) {
        if (!equipo.activo) {
            logger.info(`⏸️  ${equipo.nombre} — Inactivo (saltando)`);
            continue;
        }

        switch (equipo.protocolo) {
            case 'TCP': {
                const proxy = new TCPProxy(equipo, logger, detector);
                const exito = await proxy.iniciar();
                if (exito) {
                    proxies.push(proxy);
                    equiposActivos++;
                }
                break;
            }
            case 'SERIAL': {
                const proxy = new SerialProxy(equipo, logger, detector);
                const exito = await proxy.iniciar();
                if (exito) {
                    proxies.push(proxy);
                    equiposActivos++;
                }
                break;
            }
            default:
                logger.info(`⚠️  ${equipo.nombre}: Protocolo '${equipo.protocolo}' — solo se registrará si hay datos`);
        }
    }

    logger.info(`🟢 Monitor activo. ${equiposActivos} equipo(s) monitoreado(s)`);
    logger.info('Los datos se registran en: ' + dirLogs);
    logger.info('Presiona Ctrl+C para detener');
    console.log('');

    // Mostrar estadísticas periódicas
    setInterval(() => {
        const stats = detector.obtenerEstadisticas();
        const totalMensajes = Object.values(stats).reduce((sum, s) => sum + s.totalMensajes, 0);
        if (totalMensajes > 0) {
            logger.info(`📊 Estadísticas: ${totalMensajes} mensaje(s) capturado(s) en total`);
            for (const [equipo, data] of Object.entries(stats)) {
                logger.info(`   ${equipo}: ${data.totalMensajes} mensaje(s) — Protocolos: ${Object.keys(data.protocolosDetectados).join(', ')}`);
            }
        }
    }, 300000); // Cada 5 minutos
}

// ── Manejo de cierre limpio ──────────────────────────────────
process.on('SIGINT', () => {
    console.log('\n');
    logger.info('⛔ Deteniendo monitor...');

    for (const proxy of proxies) {
        proxy.detener();
    }

    // Mostrar resumen final
    const stats = detector.obtenerEstadisticas();
    const totalMensajes = Object.values(stats).reduce((sum, s) => sum + s.totalMensajes, 0);

    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  📊 Resumen de sesión                       ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`  Total mensajes capturados: ${totalMensajes}`);

    for (const [equipo, data] of Object.entries(stats)) {
        console.log(`  ${equipo}: ${data.totalMensajes} mensaje(s)`);
        for (const [proto, count] of Object.entries(data.protocolosDetectados)) {
            console.log(`    - ${proto}: ${count}`);
        }
    }

    console.log(`\n  📂 Logs guardados en: ${dirLogs}`);
    console.log('');

    process.exit(0);
});

process.on('uncaughtException', (err) => {
    logger.error(`Error no capturado: ${err.message}`);
    logger.error(err.stack);
});

// ── Ejecutar ─────────────────────────────────────────────────
inicio().catch(err => {
    logger.error(`Error fatal: ${err.message}`);
    process.exit(1);
});
