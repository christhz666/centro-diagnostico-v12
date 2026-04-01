/**
 * ============================================================
 *  Logger — Registro estructurado de comunicaciones
 * ============================================================
 *  Registra todos los datos capturados con:
 *  - Timestamp preciso (milisegundos)
 *  - Dirección del dato (RECIBIDO / ENVIADO)
 *  - Datos en hexadecimal y texto legible
 *  - Detección de protocolo
 *  - Rotación automática de archivos de log
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor(directorioLogs, opciones = {}) {
        this.directorioLogs = directorioLogs;
        this.maxTamanoBytes = (opciones.maxTamanoLogMB || 50) * 1024 * 1024;
        this.rotarLogs = opciones.rotarLogs !== false;
        this.logHex = opciones.logHexadecimal !== false;
        this.logTexto = opciones.logTexto !== false;
        this.logProtocolo = opciones.logProtocolo !== false;

        // Crear directorio si no existe
        if (!fs.existsSync(this.directorioLogs)) {
            fs.mkdirSync(this.directorioLogs, { recursive: true });
        }

        // Archivo de log general
        this.archivoGeneral = path.join(this.directorioLogs, 'monitor.log');
    }

    /**
     * Obtiene la fecha formateada para nombres de archivo
     */
    _fechaArchivo() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Obtiene timestamp preciso
     */
    _timestamp() {
        return new Date().toISOString();
    }

    /**
     * Convierte buffer/string a representación hexadecimal
     */
    _aHex(datos) {
        const buf = Buffer.isBuffer(datos) ? datos : Buffer.from(datos);
        const hexLineas = [];
        for (let i = 0; i < buf.length; i += 16) {
            const slice = buf.slice(i, Math.min(i + 16, buf.length));
            const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
            hexLineas.push(`  ${String(i).padStart(6, '0')}  ${hex.padEnd(48)}  |${ascii}|`);
        }
        return hexLineas.join('\n');
    }

    /**
     * Convierte datos a texto legible reemplazando caracteres de control
     */
    _aTextoLegible(datos) {
        const str = Buffer.isBuffer(datos) ? datos.toString('latin1') : datos;
        const controlChars = {
            '\x00': '<NUL>', '\x01': '<SOH>', '\x02': '<STX>', '\x03': '<ETX>',
            '\x04': '<EOT>', '\x05': '<ENQ>', '\x06': '<ACK>', '\x07': '<BEL>',
            '\x08': '<BS>', '\x0B': '<VT>', '\x0C': '<FF>',
            '\x0E': '<SO>', '\x0F': '<SI>', '\x10': '<DLE>',
            '\x11': '<DC1>', '\x12': '<DC2>', '\x13': '<DC3>', '\x14': '<DC4>',
            '\x15': '<NAK>', '\x16': '<SYN>', '\x17': '<ETB>',
            '\x18': '<CAN>', '\x19': '<EM>', '\x1A': '<SUB>', '\x1B': '<ESC>',
            '\x1C': '<FS>', '\x1D': '<GS>', '\x1E': '<RS>', '\x1F': '<US>'
        };

        let resultado = '';
        for (const ch of str) {
            if (controlChars[ch]) {
                resultado += controlChars[ch];
            } else {
                resultado += ch;
            }
        }
        return resultado;
    }

    /**
     * Rota el archivo de log si excede el tamaño máximo
     */
    _verificarRotacion(archivo) {
        if (!this.rotarLogs) return;
        try {
            const stats = fs.statSync(archivo);
            if (stats.size >= this.maxTamanoBytes) {
                const rotado = archivo.replace(/\.log$/, `.${this._fechaArchivo()}-${Date.now()}.log`);
                fs.renameSync(archivo, rotado);
            }
        } catch {
            // Archivo no existe aún
        }
    }

    /**
     * Escribe en el log general del monitor
     */
    info(mensaje) {
        const linea = `[${this._timestamp()}] [INFO] ${mensaje}\n`;
        console.log(linea.trimEnd());
        this._verificarRotacion(this.archivoGeneral);
        try { fs.appendFileSync(this.archivoGeneral, linea); } catch { }
    }

    error(mensaje) {
        const linea = `[${this._timestamp()}] [ERROR] ${mensaje}\n`;
        console.error(linea.trimEnd());
        this._verificarRotacion(this.archivoGeneral);
        try { fs.appendFileSync(this.archivoGeneral, linea); } catch { }
    }

    /**
     * Registra datos capturados de un equipo
     * @param {string} nombreEquipo - Nombre del equipo
     * @param {string} direccion - 'RECIBIDO' o 'ENVIADO'
     * @param {Buffer|string} datos - Datos capturados
     * @param {object} infoProtocolo - Info del protocolo detectado (opcional)
     */
    registrarDatos(nombreEquipo, direccion, datos, infoProtocolo = null) {
        const nombreSeguro = nombreEquipo.replace(/[^a-zA-Z0-9_-]/g, '_');
        const archivo = path.join(this.directorioLogs, `${nombreSeguro}_${this._fechaArchivo()}.log`);
        const archivoRaw = path.join(this.directorioLogs, `${nombreSeguro}_${this._fechaArchivo()}.raw`);

        this._verificarRotacion(archivo);

        const ts = this._timestamp();
        const tamano = Buffer.isBuffer(datos) ? datos.length : Buffer.byteLength(datos);
        const separador = '─'.repeat(70);

        let registro = '';
        registro += `\n${separador}\n`;
        registro += `[${ts}] [${direccion}] ${nombreEquipo} (${tamano} bytes)\n`;
        registro += `${separador}\n`;

        // Texto legible
        if (this.logTexto) {
            registro += `\n  TEXTO:\n`;
            registro += `  ${this._aTextoLegible(datos)}\n`;
        }

        // Hexadecimal
        if (this.logHex) {
            registro += `\n  HEXADECIMAL:\n`;
            registro += `${this._aHex(datos)}\n`;
        }

        // Protocolo detectado
        if (this.logProtocolo && infoProtocolo) {
            registro += `\n  PROTOCOLO DETECTADO: ${infoProtocolo.protocolo}\n`;
            if (infoProtocolo.version) {
                registro += `  VERSION: ${infoProtocolo.version}\n`;
            }
            if (infoProtocolo.detalles) {
                registro += `  DETALLES: ${infoProtocolo.detalles}\n`;
            }
            if (infoProtocolo.segmentos) {
                registro += `  SEGMENTOS: ${infoProtocolo.segmentos.join(', ')}\n`;
            }
        }

        registro += `${separador}\n`;

        // Log legible
        try { fs.appendFileSync(archivo, registro); } catch { }

        // Log raw (datos binarios puros para análisis posterior)
        const headerRaw = Buffer.from(`\n[${ts}][${direccion}][${tamano}]`);
        const buf = Buffer.isBuffer(datos) ? datos : Buffer.from(datos);
        try { fs.appendFileSync(archivoRaw, Buffer.concat([headerRaw, buf])); } catch { }

        // Log en consola (resumido)
        const resumen = this._aTextoLegible(datos).substring(0, 100);
        console.log(`[${ts}] [${direccion}] ${nombreEquipo}: ${resumen}${tamano > 100 ? '...' : ''}`);
    }

    /**
     * Registra un evento de conexión/desconexión
     */
    registrarEvento(nombreEquipo, evento, detalles = '') {
        const nombreSeguro = nombreEquipo.replace(/[^a-zA-Z0-9_-]/g, '_');
        const archivo = path.join(this.directorioLogs, `${nombreSeguro}_${this._fechaArchivo()}.log`);
        const linea = `[${this._timestamp()}] [EVENTO] ${evento}: ${detalles}\n`;
        try { fs.appendFileSync(archivo, linea); } catch { }
        this.info(`${nombreEquipo} — ${evento}: ${detalles}`);
    }
}

module.exports = Logger;
