/**
 * ============================================================
 *  Detector de Protocolo — ASTM / HL7 / RAW
 * ============================================================
 *  Analiza datos recibidos para identificar automáticamente
 *  el protocolo de comunicación utilizado por cada equipo.
 *
 *  Protocolos detectados:
 *  - ASTM E1381/E1394 (caracteres de control + registros H|P|O|R|L)
 *  - HL7 v2.x (segmentos MSH|PID|OBR|OBX)
 *  - RAW (datos no reconocidos, posiblemente propietarios)
 *
 *  También detecta:
 *  - Caracteres de handshake (ENQ, ACK, NAK, EOT)
 *  - Encoding (ASCII, UTF-8, Latin-1)
 *  - Delimitadores utilizados
 * ============================================================
 */

// Caracteres de control ASTM
const CTRL = {
    NUL: 0x00, SOH: 0x01, STX: 0x02, ETX: 0x03,
    EOT: 0x04, ENQ: 0x05, ACK: 0x06, BEL: 0x07,
    LF: 0x0A, CR: 0x0D, NAK: 0x15, ETB: 0x17,
    VT: 0x0B, FS: 0x1C
};

class ProtocolDetector {
    constructor() {
        // Estadísticas por equipo
        this.estadisticas = {};
    }

    /**
     * Analiza datos y detecta el protocolo
     * @param {Buffer|string} datos - Datos recibidos
     * @returns {object} Información del protocolo detectado
     */
    detectar(datos) {
        const buf = Buffer.isBuffer(datos) ? datos : Buffer.from(datos);
        const str = buf.toString('latin1');

        // Primero verificar si es un solo carácter de control (handshake)
        if (buf.length === 1) {
            return this._detectarHandshake(buf[0]);
        }

        // Intentar detectar HL7
        const hl7 = this._detectarHL7(buf, str);
        if (hl7) return hl7;

        // Intentar detectar ASTM
        const astm = this._detectarASTM(buf, str);
        if (astm) return astm;

        // No reconocido — devolver como RAW con análisis
        return this._analizarRaw(buf, str);
    }

    /**
     * Detecta caracteres de handshake individuales
     */
    _detectarHandshake(byte) {
        const nombres = {
            [CTRL.ENQ]: { protocolo: 'ASTM_HANDSHAKE', detalles: 'ENQ — Equipo solicita iniciar transmisión', tipo: 'ENQ' },
            [CTRL.ACK]: { protocolo: 'ASTM_HANDSHAKE', detalles: 'ACK — Confirmación positiva', tipo: 'ACK' },
            [CTRL.NAK]: { protocolo: 'ASTM_HANDSHAKE', detalles: 'NAK — Confirmación negativa (error)', tipo: 'NAK' },
            [CTRL.EOT]: { protocolo: 'ASTM_HANDSHAKE', detalles: 'EOT — Fin de transmisión', tipo: 'EOT' },
            [CTRL.STX]: { protocolo: 'ASTM_HANDSHAKE', detalles: 'STX — Inicio de texto', tipo: 'STX' },
            [CTRL.ETX]: { protocolo: 'ASTM_HANDSHAKE', detalles: 'ETX — Fin de texto', tipo: 'ETX' }
        };

        return nombres[byte] || {
            protocolo: 'CONTROL_CHAR',
            detalles: `Carácter de control: 0x${byte.toString(16).padStart(2, '0')}`,
            tipo: 'DESCONOCIDO'
        };
    }

    /**
     * Detecta protocolo HL7 v2.x
     * Características: empieza con VT (0x0B), contiene MSH|, termina con FS CR (0x1C 0x0D)
     */
    _detectarHL7(buf, str) {
        const tieneVT = buf.indexOf(CTRL.VT) >= 0;
        const tieneFS = buf.indexOf(CTRL.FS) >= 0;
        const tieneMSH = str.includes('MSH|');

        if (!tieneMSH && !tieneVT) return null;

        const segmentos = [];
        const segmentosConocidos = ['MSH', 'PID', 'PV1', 'ORC', 'OBR', 'OBX', 'NTE', 'QRD', 'QRF', 'DSP'];
        for (const seg of segmentosConocidos) {
            if (str.includes(seg + '|')) segmentos.push(seg);
        }

        if (segmentos.length === 0) return null;

        // Detectar versión HL7
        let version = 'desconocida';
        const mshMatch = str.match(/MSH\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|([\d.]+)/);
        if (mshMatch) {
            version = mshMatch[1];
        }

        // Detectar tipo de mensaje
        let tipoMensaje = 'desconocido';
        const tipoMatch = str.match(/MSH\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|([^|]*)/);
        if (tipoMatch) {
            tipoMensaje = tipoMatch[1];
        }

        return {
            protocolo: 'HL7',
            version: version,
            tipoMensaje: tipoMensaje,
            segmentos: segmentos,
            tieneWrapping: tieneVT && tieneFS,
            detalles: `HL7 v${version} — Tipo: ${tipoMensaje} — ${segmentos.length} segmento(s): ${segmentos.join(', ')}`
        };
    }

    /**
     * Detecta protocolo ASTM E1381/E1394
     * Características: registros separados por | con tipos H, P, O, R, C, Q, L, M
     */
    _detectarASTM(buf, str) {
        const tiposRegistro = { 'H': 0, 'P': 0, 'O': 0, 'R': 0, 'C': 0, 'Q': 0, 'L': 0, 'M': 0, 'S': 0 };
        const lineas = str.split(/[\r\n]+/);
        const registrosEncontrados = [];

        for (const linea of lineas) {
            // Limpiar caracteres de control al inicio
            const limpia = linea.replace(/[\x00-\x1F]/g, '').trim();
            if (!limpia) continue;

            const campos = limpia.split('|');
            // El primer campo puede ser un número de frame seguido del tipo
            let tipo = campos[0];
            // ASTM con número de frame: "1H|", "2P|", etc.
            const frameMatch = tipo.match(/^(\d+)([A-Z])$/);
            if (frameMatch) {
                tipo = frameMatch[2];
            }

            if (tipo in tiposRegistro) {
                tiposRegistro[tipo]++;
                if (!registrosEncontrados.includes(tipo)) {
                    registrosEncontrados.push(tipo);
                }
            }
        }

        // Debe tener al menos H (header) o R (resultado) con |
        const tieneHeader = tiposRegistro['H'] > 0;
        const tieneResultados = tiposRegistro['R'] > 0;
        const tienePipe = str.includes('|');

        if (!tienePipe || registrosEncontrados.length === 0) return null;
        if (!tieneHeader && !tieneResultados) return null;

        // Detectar caracteres de control ASTM
        const tieneSTX = buf.indexOf(CTRL.STX) >= 0;
        const tieneETX = buf.indexOf(CTRL.ETX) >= 0;
        const tieneENQ = buf.indexOf(CTRL.ENQ) >= 0;
        const tieneEOT = buf.indexOf(CTRL.EOT) >= 0;

        let variante = 'ASTM';
        if (tieneSTX && tieneETX) {
            variante = 'ASTM E1381 (con framing STX/ETX)';
        } else if (tieneENQ || tieneEOT) {
            variante = 'ASTM E1381 (con handshake ENQ/EOT)';
        } else {
            variante = 'ASTM E1394 (sin framing)';
        }

        return {
            protocolo: 'ASTM',
            version: variante,
            segmentos: registrosEncontrados,
            conteo: tiposRegistro,
            totalResultados: tiposRegistro['R'],
            detalles: `${variante} — Registros: ${registrosEncontrados.join(', ')} — ${tiposRegistro['R']} resultado(s)`
        };
    }

    /**
     * Analiza datos no reconocidos para proveer información útil
     */
    _analizarRaw(buf, str) {
        const analisis = {
            protocolo: 'RAW',
            detalles: '',
            longitud: buf.length,
            caracteresControl: [],
            esTexto: true,
            encoding: 'desconocido'
        };

        // Analizar caracteres de control presentes
        const controlMap = {};
        let bytesTexto = 0;
        let bytesAlto = 0;

        for (const byte of buf) {
            if (byte < 0x20 && byte !== CTRL.CR && byte !== CTRL.LF) {
                const nombre = `0x${byte.toString(16).padStart(2, '0')}`;
                controlMap[nombre] = (controlMap[nombre] || 0) + 1;
            }
            if (byte >= 0x20 && byte <= 0x7E) bytesTexto++;
            if (byte > 0x7F) bytesAlto++;
        }

        analisis.caracteresControl = Object.entries(controlMap)
            .map(([char, count]) => `${char}(x${count})`)
            .sort();

        analisis.esTexto = (bytesTexto / buf.length) > 0.8;
        analisis.porcentajeTexto = Math.round((bytesTexto / buf.length) * 100);

        // Detectar encoding
        if (bytesAlto === 0) {
            analisis.encoding = 'ASCII';
        } else {
            // Verificar si es UTF-8 válido
            try {
                const decoded = buf.toString('utf-8');
                const reencoded = Buffer.from(decoded, 'utf-8');
                if (reencoded.equals(buf)) {
                    analisis.encoding = 'UTF-8';
                } else {
                    analisis.encoding = 'Latin-1/ISO-8859-1';
                }
            } catch {
                analisis.encoding = 'Latin-1/ISO-8859-1';
            }
        }

        // Detectar delimitadores comunes
        const delimitadores = [];
        if (str.includes('|')) delimitadores.push('pipe (|)');
        if (str.includes('\t')) delimitadores.push('tab');
        if (str.includes(',')) delimitadores.push('coma (,)');
        if (str.includes(';')) delimitadores.push('punto y coma (;)');
        analisis.delimitadores = delimitadores;

        analisis.detalles = `Datos RAW — ${buf.length} bytes — ${analisis.porcentajeTexto}% texto — ` +
            `Encoding: ${analisis.encoding}` +
            (delimitadores.length > 0 ? ` — Delimitadores: ${delimitadores.join(', ')}` : '') +
            (analisis.caracteresControl.length > 0 ? ` — Ctrl: ${analisis.caracteresControl.join(', ')}` : '');

        return analisis;
    }

    /**
     * Actualiza estadísticas por equipo
     */
    actualizarEstadisticas(nombreEquipo, info) {
        if (!this.estadisticas[nombreEquipo]) {
            this.estadisticas[nombreEquipo] = {
                protocolosDetectados: {},
                totalMensajes: 0,
                primerMensaje: new Date().toISOString(),
                ultimoMensaje: null
            };
        }

        const stats = this.estadisticas[nombreEquipo];
        stats.totalMensajes++;
        stats.ultimoMensaje = new Date().toISOString();

        const proto = info.protocolo;
        if (!stats.protocolosDetectados[proto]) {
            stats.protocolosDetectados[proto] = 0;
        }
        stats.protocolosDetectados[proto]++;
    }

    /**
     * Devuelve resumen de estadísticas
     */
    obtenerEstadisticas() {
        return { ...this.estadisticas };
    }
}

module.exports = ProtocolDetector;
