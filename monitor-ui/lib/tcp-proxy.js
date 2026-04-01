/**
 * ============================================================
 *  Proxy TCP Transparente
 * ============================================================
 *  Modo de operación para equipos conectados por TCP/IP:
 *
 *  MODO PROXY:
 *    1. Escucha en un puerto TCP (ej: 9200)
 *    2. Cuando un equipo se conecta, crea una conexión
 *       hacia el destino real (ej: 127.0.0.1:9100)
 *    3. Reenvía TODOS los datos bidireccionalmente
 *    4. Registra TODO lo que pasa sin modificar nada
 *    5. Se configura el equipo para enviar al puerto del proxy
 *       y el proxy reenvía al agente-laboratorio
 *
 *  DIAGRAMA:
 *    Equipo Lab ──TCP──► Proxy (9200) ──TCP──► Agente (9100)
 *                          │
 *                          └── LOG (registra todo)
 *
 *  MODO ESCUCHA PASIVA:
 *    1. Crea un servidor TCP adicional en otro puerto
 *    2. Cualquier dato que llegue se registra
 *    3. No reenvía a ningún lado
 *    4. Útil para equipos que transmiten sin esperar respuesta
 *
 *  IMPORTANTE:
 *    - Este programa NUNCA modifica los datos
 *    - Solo OBSERVA y REGISTRA
 *    - El flujo de datos entre equipo y agente no se altera
 * ============================================================
 */

const net = require('net');

class TCPProxy {
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
        this.servidor = null;
        this.conexionesActivas = 0;
        this.activo = false;
        this.bytesRecibidosEquipo = 0;
        this.bytesRecibidosAgente = 0;
    }

    /**
     * Inicia el proxy TCP
     */
    async iniciar() {
        const tcpConfig = this.config.tcp;
        if (!tcpConfig) {
            this.logger.error(`${this.nombre}: No hay configuración TCP`);
            return false;
        }

        const puertoEscucha = tcpConfig.puertoEscucha;
        const destinoIp = tcpConfig.destinoIp || '127.0.0.1';
        const destinoPuerto = tcpConfig.destinoPuerto;

        this.logger.registrarEvento(this.nombre, 'INICIO_PROXY_TCP',
            `Escucha: 0.0.0.0:${puertoEscucha} → Destino: ${destinoIp}:${destinoPuerto}`);

        return new Promise((resolve) => {
            this.servidor = net.createServer((socketEquipo) => {
                this._manejarConexion(socketEquipo, destinoIp, destinoPuerto);
            });

            this.servidor.listen(puertoEscucha, '0.0.0.0', () => {
                this.activo = true;
                this.logger.info(`${this.nombre}: ✅ Proxy TCP escuchando en 0.0.0.0:${puertoEscucha}`);
                this.logger.info(`${this.nombre}:    Reenvía a ${destinoIp}:${destinoPuerto}`);
                this.logger.registrarEvento(this.nombre, 'PROXY_TCP_ACTIVO',
                    `Puerto ${puertoEscucha} → ${destinoIp}:${destinoPuerto}`);
                resolve(true);
            });

            this.servidor.on('error', (err) => {
                this.logger.error(`${this.nombre}: Error en servidor TCP: ${err.message}`);
                if (err.code === 'EADDRINUSE') {
                    this.logger.error(`${this.nombre}: Puerto ${puertoEscucha} ya está en uso. ` +
                        `Cambia puertoEscucha en config.json`);
                }
                this.logger.registrarEvento(this.nombre, 'ERROR_TCP', err.message);
                resolve(false);
            });
        });
    }

    /**
     * Maneja una conexión entrante del equipo
     * Crea un puente transparente con el agente destino
     */
    _manejarConexion(socketEquipo, destinoIp, destinoPuerto) {
        this.conexionesActivas++;
        const remoteAddr = `${socketEquipo.remoteAddress}:${socketEquipo.remotePort}`;

        this.logger.info(`${this.nombre}: 📡 Nueva conexión TCP desde ${remoteAddr}`);
        this.logger.registrarEvento(this.nombre, 'CONEXION_ENTRANTE',
            `Desde: ${remoteAddr} | Conexiones activas: ${this.conexionesActivas}`);

        // Conectar al agente destino
        const socketAgente = new net.Socket();

        socketAgente.connect(destinoPuerto, destinoIp, () => {
            this.logger.info(`${this.nombre}: 🔗 Conectado al destino ${destinoIp}:${destinoPuerto}`);
            this.logger.registrarEvento(this.nombre, 'PUENTE_ESTABLECIDO',
                `${remoteAddr} ↔ ${destinoIp}:${destinoPuerto}`);
        });

        // Datos del equipo → Log + Reenviar al agente
        socketEquipo.on('data', (data) => {
            this.bytesRecibidosEquipo += data.length;

            // Detectar protocolo y registrar
            const infoProtocolo = this.detector.detectar(data);
            this.detector.actualizarEstadisticas(this.nombre, infoProtocolo);
            this.logger.registrarDatos(this.nombre, 'EQUIPO→AGENTE', data, infoProtocolo);

            // Reenviar sin modificar
            if (!socketAgente.destroyed) {
                socketAgente.write(data);
            }
        });

        // Datos del agente → Log + Reenviar al equipo
        socketAgente.on('data', (data) => {
            this.bytesRecibidosAgente += data.length;

            // Detectar protocolo y registrar
            const infoProtocolo = this.detector.detectar(data);
            this.detector.actualizarEstadisticas(this.nombre, infoProtocolo);
            this.logger.registrarDatos(this.nombre, 'AGENTE→EQUIPO', data, infoProtocolo);

            // Reenviar sin modificar
            if (!socketEquipo.destroyed) {
                socketEquipo.write(data);
            }
        });

        // Manejo de cierre y errores
        const cerrarConexion = (origen) => {
            this.conexionesActivas = Math.max(0, this.conexionesActivas - 1);
            this.logger.registrarEvento(this.nombre, 'CONEXION_CERRADA',
                `Cerrada por: ${origen} | Conexiones activas: ${this.conexionesActivas}`);

            if (!socketEquipo.destroyed) socketEquipo.destroy();
            if (!socketAgente.destroyed) socketAgente.destroy();
        };

        socketEquipo.on('close', () => cerrarConexion('equipo'));
        socketEquipo.on('error', (err) => {
            this.logger.error(`${this.nombre}: Error socket equipo: ${err.message}`);
            cerrarConexion('error-equipo');
        });

        socketAgente.on('close', () => {
            if (!socketEquipo.destroyed) socketEquipo.destroy();
        });
        socketAgente.on('error', (err) => {
            this.logger.error(`${this.nombre}: Error socket agente: ${err.message}`);
            this.logger.registrarEvento(this.nombre, 'ERROR_DESTINO',
                `No se pudo conectar a ${destinoIp}:${destinoPuerto}: ${err.message}`);
            cerrarConexion('error-agente');
        });
    }

    /**
     * Detiene el proxy TCP
     */
    detener() {
        this.activo = false;

        if (this.servidor) {
            this.servidor.close(() => {
                this.logger.info(`${this.nombre}: Servidor TCP cerrado`);
            });
        }

        this.logger.registrarEvento(this.nombre, 'DETENIDO',
            `Bytes equipo→agente: ${this.bytesRecibidosEquipo} | Bytes agente→equipo: ${this.bytesRecibidosAgente}`);
    }

    /**
     * Devuelve estado actual
     */
    obtenerEstado() {
        return {
            nombre: this.nombre,
            activo: this.activo,
            conexionesActivas: this.conexionesActivas,
            puertoEscucha: this.config.tcp?.puertoEscucha,
            destino: `${this.config.tcp?.destinoIp}:${this.config.tcp?.destinoPuerto}`,
            bytesRecibidosEquipo: this.bytesRecibidosEquipo,
            bytesRecibidosAgente: this.bytesRecibidosAgente
        };
    }
}

module.exports = TCPProxy;
