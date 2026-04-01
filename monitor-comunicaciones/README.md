# 📡 Monitor de Comunicaciones — Laboratorio

Monitor **pasivo** de comunicaciones para equipos de laboratorio clínico.
Registra todos los datos transmitidos y recibidos **sin interferir** con el
software existente (`agente-laboratorio`).

## 🎯 Propósito

Este programa permite:

- **Identificar** el protocolo de comunicación real de cada equipo (ASTM, HL7, propietario)
- **Registrar** todos los datos transmitidos con timestamp preciso
- **Analizar** los datos en formato hexadecimal y texto legible
- **Detectar** caracteres de control y handshake del protocolo ASTM
- **No interferir** con el flujo de datos existente

## ⚠️ Principio de No-Interferencia

Este programa está diseñado para ser un **observador pasivo**:

| Característica | Descripción |
|----------------|-------------|
| **No modifica datos** | Los datos se reenvían exactamente como se reciben |
| **No intercepta** | Actúa como puente transparente, no como intermediario |
| **No requiere cambios** | El agente-laboratorio sigue funcionando igual |
| **No envía datos** | Solo lee y registra, nunca envía comandos a los equipos |

## 📦 Instalación

```bash
cd monitor-comunicaciones
npm install
```

## 🚀 Uso

### Modo Normal (Producción)

```bash
node monitor.js
```

### Modo Test (Simulación)

```bash
node monitor.js --test
```

Genera datos simulados de prueba (ASTM, HL7, RAW) para verificar que el
sistema de registro funciona correctamente.

### Ver Estadísticas

```bash
node monitor.js --stats
```

Muestra los archivos de log disponibles y sus tamaños.

## 🔧 Configuración

Editar `config.json`:

```json
{
    "modo": "proxy",
    "directorioLogs": "./logs",
    "equipos": [
        {
            "nombre": "Mindray BC-6800",
            "tipo": "hematologia",
            "protocolo": "TCP",
            "activo": true,
            "tcp": {
                "modo": "proxy",
                "puertoEscucha": 9200,
                "destinoIp": "127.0.0.1",
                "destinoPuerto": 9100
            }
        },
        {
            "nombre": "Mindray BS-200",
            "tipo": "quimica",
            "protocolo": "SERIAL",
            "activo": true,
            "serial": {
                "puertoReal": "COM3",
                "baudRate": 9600,
                "dataBits": 8,
                "stopBits": 1,
                "parity": "none"
            }
        }
    ],
    "opciones": {
        "logHexadecimal": true,
        "logTexto": true,
        "logProtocolo": true,
        "maxTamanoLogMB": 50,
        "rotarLogs": true
    }
}
```

### Configuración TCP (Proxy Transparente)

Para equipos TCP, el monitor actúa como proxy transparente:

```
Equipo Lab ──TCP──► Monitor (9200) ──TCP──► Agente-Lab (9100)
                        │
                        └── LOG (registra todo)
```

1. Configurar el equipo de laboratorio para enviar al puerto del monitor (ej: 9200)
2. El monitor reenvía automáticamente al agente-laboratorio (ej: 9100)
3. Todo queda registrado sin modificar

### Configuración Serial

Para puertos seriales, el monitor lee los datos del puerto configurado:

- En Linux, para un proxy serial completo, se recomienda usar `socat` para
  crear puertos virtuales
- El monitor proporciona las instrucciones necesarias al iniciar

## 📂 Archivos de Log

Los logs se guardan en el directorio `./logs/` con la siguiente estructura:

| Archivo | Contenido |
|---------|-----------|
| `monitor.log` | Log general del monitor (eventos, errores) |
| `{equipo}_{fecha}.log` | Log detallado por equipo (texto + hex + protocolo) |
| `{equipo}_{fecha}.raw` | Datos binarios puros (para análisis posterior) |

### Ejemplo de Log

```
──────────────────────────────────────────────────────────────────────
[2026-03-15T12:00:00.123Z] [RECIBIDO] Mindray BS-200 (245 bytes)
──────────────────────────────────────────────────────────────────────

  TEXTO:
  H|\^&|||Mindray BS-200|||||LIS|||LIS2-A|20260315120000
  P|1||0011234567||García^Juan||19850315|M
  R|1|^^^GLU|95.5|mg/dL||N||F||||20260315120000
  L|1|N

  HEXADECIMAL:
  000000  48 7c 5c 5e 26 7c 7c 7c 4d 69 6e 64 72 61 79 20  |H|\^&|||Mindray |
  000010  42 53 2d 32 30 30 7c 7c 7c 7c 7c 4c 49 53 7c 7c  |BS-200|||||LIS||
  ...

  PROTOCOLO DETECTADO: ASTM
  VERSION: ASTM E1394 (sin framing)
  DETALLES: Registros: H, P, R, L — 1 resultado(s)
──────────────────────────────────────────────────────────────────────
```

## 🔍 Protocolos Detectados

| Protocolo | Características Detectadas |
|-----------|---------------------------|
| **ASTM E1381** | Caracteres STX/ETX, registros H\|P\|O\|R\|L, handshake ENQ/ACK |
| **ASTM E1394** | Registros sin framing de control |
| **HL7 v2.x** | Segmentos MSH\|PID\|OBR\|OBX, wrapping VT/FS |
| **RAW** | Datos no reconocidos, análisis de delimitadores y encoding |
| **Handshake** | Caracteres ENQ, ACK, NAK, EOT individuales |

## 🏥 Equipos Soportados

Este monitor funciona con cualquier equipo que se comunique por:

- **Puerto Serial (COM/RS-232)**: Mindray BS-200, ABX Micros 60, DET D20 CEM, etc.
- **TCP/IP**: Mindray BC-6800, Sysmex, Beckman Coulter, etc.
- Cualquier equipo que use ASTM, HL7, o protocolos propietarios seriales/TCP

## 📋 Ver También

- [`../COMPATIBILIDAD.md`](../COMPATIBILIDAD.md) — Reporte de problemas de compatibilidad
- [`../agentes/agente-laboratorio/`](../agentes/agente-laboratorio/) — Agente principal de recolección
- [`../utils/equipos-config.js`](../utils/equipos-config.js) — Configuraciones predefinidas de equipos
