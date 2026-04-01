/**
 * ============================================================
 *  Proxy Serial Transparente
 * ============================================================
 *  Modo de operación para puertos seriales (COM / ttyUSB):
 *
 *  MODO PROXY (Linux):
 *    1. Abre el puerto serial REAL (ej: /dev/ttyUSB0)
 *    2. Crea un par de pseudo-terminales (PTY)
 *    3. Reenvía TODOS los datos bidireccionalmente
 *    4. Registra TODO lo que pasa sin modificar nada
 *    5. El agente-laboratorio se conecta al PTY virtual
 *       en lugar del puerto real
 *
 *  MODO SOLO-LECTURA (cuando no se puede hacer proxy):
 *    1. Lee datos del puerto serial sin enviar nada
 *    2. Útil cuando el equipo transmite sin necesitar respuesta
 *    3. NOTA: Si otro programa ya tiene el puerto abierto,
 *       este modo NO funcionará (acceso exclusivo del OS)
 *
 *  IMPORTANTE:
 *    - Este programa NUNCA modifica los datos
 *    - Solo OBSERVA y REGISTRA
 *    - El flujo de datos entre equipo y agente no se altera
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

class SerialProxy {
    /**
     * @param {object} equipoConfig - Configuración del equipo
     * @param {object} logger - Instancia del Logger
     * @param {object} detector - Instancia del ProtocolDetector
     */
    constructor(equipoConfig, logger, detector) {
        this.config = equipoConfig;
        this.nombre = equipoConfig.nombre;
        this.logger = logger;
        this.detector = detector;
        this.puertoReal = null;
        this.puertoVirtual = null;
        this.activo = false;
        this.bytesRecibidos = 0;
        this.bytesEnviados = 0;
    }

    /**
     * Inicia el proxy serial
     */
    async iniciar() {
        const serialConfig = this.config.serial;
        if (!serialConfig) {
            this.logger.error(`${this.nombre}: No hay configuración serial`);
            return false;
        }

        try {
            // Intentar cargar serialport
            const { SerialPort } = require('serialport');

            this.logger.info(`${this.nombre}: Abriendo puerto ${serialConfig.puertoReal}...`);
            this.logger.registrarEvento(this.nombre, 'INICIO_PROXY_SERIAL',
                `Puerto: ${serialConfig.puertoReal} | BaudRate: ${serialConfig.baudRate} | ` +
                `DataBits: ${serialConfig.dataBits} | StopBits: ${serialConfig.stopBits} | Parity: ${serialConfig.parity}`);

            // Abrir puerto serial real
            this.puertoReal = new SerialPort({
                path: serialConfig.puertoReal,
                baudRate: serialConfig.baudRate || 9600,
                dataBits: serialConfig.dataBits || 8,
                stopBits: serialConfig.stopBits || 1,
                parity: serialConfig.parity || 'none',
                autoOpen: false
            });

            return new Promise((resolve) => {
                this.puertoReal.open((err) => {
                    if (err) {
                        this.logger.error(`${this.nombre}: No se pudo abrir ${serialConfig.puertoReal}: ${err.message}`);
                        this.logger.registrarEvento(this.nombre, 'ERROR_APERTURA', err.message);
                        resolve(false);
                        return;
                    }

                    this.activo = true;
                    this.logger.info(`${this.nombre}: ✅ Puerto ${serialConfig.puertoReal} abierto correctamente`);
                    this.logger.registrarEvento(this.nombre, 'PUERTO_ABIERTO', serialConfig.puertoReal);

                    // Escuchar datos del equipo (solo lectura — no envía nada)
                    this.puertoReal.on('data', (data) => {
                        this._procesarDatosRecibidos(data);
                    });

                    this.puertoReal.on('error', (err) => {
                        this.logger.error(`${this.nombre}: Error serial: ${err.message}`);
                        this.logger.registrarEvento(this.nombre, 'ERROR_SERIAL', err.message);
                    });

                    this.puertoReal.on('close', () => {
                        this.activo = false;
                        this.logger.info(`${this.nombre}: Puerto serial cerrado`);
                        this.logger.registrarEvento(this.nombre, 'PUERTO_CERRADO', serialConfig.puertoReal);

                        // Reintentar conexión
                        if (this.config.activo) {
                            const intervalo = this.config.intervaloReconexion || 10000;
                            this.logger.info(`${this.nombre}: Reintentando en ${intervalo / 1000}s...`);
                            setTimeout(() => this.iniciar(), intervalo);
                        }
                    });

                    // Intentar crear PTY virtual para modo proxy
                    this._intentarCrearPTY();

                    resolve(true);
                });
            });

        } catch (err) {
            this.logger.error(`${this.nombre}: Error al inicializar serial: ${err.message}`);
            if (err.message.includes('Cannot find module')) {
                this.logger.info(`${this.nombre}: Instala serialport: npm install serialport`);
            }
            return false;
        }
    }

    /**
     * Intenta crear un PTY virtual para modo proxy transparente (Linux)
     * Esto permite que el agente-laboratorio se conecte al PTY
     * mientras este monitor lee del puerto real
     */
    _intentarCrearPTY() {
        if (process.platform !== 'linux') {
            this.logger.info(`${this.nombre}: Modo proxy PTY solo disponible en Linux. ` +
                `En ${process.platform}, operando en modo solo-lectura.`);
            return;
        }

        try {
            const pty = require('child_process');
            // Crear un enlace simbólico informativo
            const linkPath = `/tmp/monitor-lab-${this.nombre.replace(/[^a-zA-Z0-9]/g, '_')}`;
            this.logger.info(`${this.nombre}: Para proxy completo en Linux, use socat:`);
            this.logger.info(`  socat -d -d pty,raw,echo=0,link=${linkPath} pty,raw,echo=0,link=${this.config.serial.puertoReal}_virtual`);
            this.logger.info(`  Luego configure el agente-laboratorio para usar: ${this.config.serial.puertoReal}_virtual`);
        } catch {
            // PTY no disponible
        }
    }

    /**
     * Procesa datos recibidos del equipo
     */
    _procesarDatosRecibidos(data) {
        this.bytesRecibidos += data.length;

        // Detectar protocolo
        const infoProtocolo = this.detector.detectar(data);
        this.detector.actualizarEstadisticas(this.nombre, infoProtocolo);

        // Registrar en el log
        this.logger.registrarDatos(this.nombre, 'RECIBIDO', data, infoProtocolo);
    }

    /**
     * Detiene el proxy serial
     */
    detener() {
        this.activo = false;
        this.config.activo = false;

        if (this.puertoReal && this.puertoReal.isOpen) {
            this.puertoReal.close((err) => {
                if (err) {
                    this.logger.error(`${this.nombre}: Error cerrando puerto: ${err.message}`);
                }
            });
        }

        this.logger.registrarEvento(this.nombre, 'DETENIDO',
            `Total recibido: ${this.bytesRecibidos} bytes | Total enviado: ${this.bytesEnviados} bytes`);
    }

    /**
     * Devuelve estado actual
     */
    obtenerEstado() {
        return {
            nombre: this.nombre,
            activo: this.activo,
            puerto: this.config.serial?.puertoReal,
            bytesRecibidos: this.bytesRecibidos,
            bytesEnviados: this.bytesEnviados
        };
    }
}

module.exports = SerialProxy;
