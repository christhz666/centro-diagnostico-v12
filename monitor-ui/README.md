# 📡 Monitor de Comunicaciones — Lab v2.0

Programa para monitorear en tiempo real los datos que envían los equipos
de laboratorio, con **interfaz gráfica web** y **sin interferir** con
el software existente.

## ✅ Requisitos

- **Node.js 16 o superior** — Descargar en: https://nodejs.org (versión LTS)
- Windows 7/10/11 (64-bit)
- Navegador web moderno (Chrome, Edge, Firefox)

## 🚀 Inicio rápido

### 1. Primera vez (cualquier PC)

1. Copiar toda la carpeta `monitor-ui/` a la PC destino
2. Doble clic en **`iniciar.bat`**
3. Esperar que instale dependencias (solo la primera vez, ~1 min)
4. Abrir el navegador en **http://localhost:3000**

### 2. Prueba sin máquinas (verificar que funciona)

Doble clic en **`iniciar-test.bat`** → Abre el navegador en http://localhost:3000

Verás mensajes simulados de ASTM y HL7 llegar en tiempo real.

## ⚙️ Configuración

Editar `config.json` o usar la sección **"Configuración"** en la interfaz web.

### Para equipos TCP (ej: Mindray BC-6800)

```
Máquina Labs → Puerto Monitor (ej: 9201) → Agente Lab (ej: 9100)
                       ↓ copia
                  Interfaz Web (puerto 3000)
```

Configurar el equipo para enviar al puerto del monitor (9201).
El monitor lo reenvía automáticamente al agente-laboratorio (9100).

### Para equipos Serial (ej: Mindray BS-200, ABX Micros 60)

Configurar el puerto COM correcto en `config.json` o la interfaz web.
El monitor solo **lee** el puerto (no envía nada).

⚠️ **Nota Windows Serial**: Si otro programa ya abrió el puerto COM,
el monitor no podrá abrirlo también (limitación del sistema operativo).
En ese caso usa el modo TCP proxy si el equipo lo permite.

## 📂 Estructura de archivos

```
monitor-ui/
├── iniciar.bat          ← Doble clic para empezar
├── iniciar-test.bat     ← Prueba con datos simulados
├── server.js            ← Servidor backend
├── config.json          ← Configuración de equipos
├── package.json         ← Dependencias Node.js
├── public/
│   └── index.html       ← Interfaz web
├── lib/
│   ├── logger.js        ← Sistema de logs
│   ├── protocol-detector.js  ← Detecta ASTM / HL7 / RAW
│   ├── tcp-proxy.js     ← Proxy TCP transparente
│   └── serial-proxy.js  ← Lectura de puerto serial
└── logs/                ← Logs guardados aquí
```

## 🔍 Protocolos detectados automáticamente

| Protocolo | Color | Descripción |
|-----------|-------|-------------|
| **ASTM** | Azul | ASTM E1381/E1394 — Hematología, Química |
| **HL7** | Verde | HL7 v2.x — Analizadores de imagen, LIS |
| **RAW** | Naranja | Protocolo propietario no reconocido |
| **HANDSHAKE** | Amarillo | ENQ / ACK / NAK / EOT |

## ⚠️ Principio de no interferencia

| ✅ Hace | ❌ No hace |
|---------|-----------|
| Observa y registra | Modifica datos |
| Reenvía datos intactos (TCP) | Envía comandos a equipos |
| Guarda logs en disco | Bloquea comunicación existente |
| Detecta el protocolo | Interrumpe otros programas |

## 🌐 API REST (para integración)

- `GET  /api/status`   — Estado del monitor
- `GET  /api/mensajes` — Mensajes capturados (filtros: equipo, protocolo)
- `GET  /api/logs`     — Lista de archivos de log
- `GET  /api/config`   — Configuración actual
- `POST /api/config`   — Guardar nueva configuración
- `POST /api/simular`  — Generar datos de prueba
