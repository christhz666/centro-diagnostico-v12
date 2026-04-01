# Reporte de Compatibilidad — Comunicación con Equipos de Laboratorio

## Fecha: Marzo 2026

## Resumen

Este documento identifica los problemas de compatibilidad detectados en el sistema de
comunicación con los equipos de laboratorio del Centro Diagnóstico.

---

## 1. Problemas de Compatibilidad — Puerto Serial (COM / RS-232)

### 1.1 Acceso exclusivo al puerto serial

| Problema | Descripción |
|----------|-------------|
| **Severidad** | ALTA |
| **Equipos afectados** | Mindray BS-200, ABX Micros 60, DET D20 CEM |
| **Descripción** | Los puertos seriales (COM) en Windows y Linux solo permiten **un programa** a la vez. Si el `agente-laboratorio` tiene abierto COM3, ningún otro programa puede leer de ese mismo puerto simultáneamente. |
| **Impacto** | No se puede monitorear/depurar la comunicación serial mientras el agente está activo sin desconectarlo. |
| **Solución** | Usar un **proxy serial transparente** que lea del puerto real, registre los datos, y los reenvíe a un puerto virtual (PTY en Linux o COM virtual en Windows). |

### 1.2 Configuración de baudRate fija

| Problema | Descripción |
|----------|-------------|
| **Severidad** | MEDIA |
| **Equipos afectados** | Todos los equipos seriales |
| **Descripción** | Todos los equipos están configurados a 9600 baud. Algunos equipos modernos soportan velocidades mayores (19200, 38400, 115200). La configuración de paridad es siempre `none` pero algunos equipos usan `even`. |
| **Impacto** | Comunicación puede fallar si un equipo nuevo tiene configuración diferente. |
| **Solución** | El monitor incluye **auto-detección de baudRate** probando múltiples velocidades. |

### 1.3 Caracteres de control ASTM

| Problema | Descripción |
|----------|-------------|
| **Severidad** | MEDIA |
| **Equipos afectados** | Equipos con protocolo ASTM (Mindray BS-200, BC-6800) |
| **Descripción** | El protocolo ASTM usa caracteres de control (STX=0x02, ETX=0x03, ENQ=0x05, ACK=0x06, NAK=0x15, EOT=0x04) para el handshake. El agente actual no responde con ACK/NAK según el estándar ASTM E1381, lo que puede causar retransmisiones o pérdida de datos en algunos equipos. |
| **Impacto** | Equipos que requieren confirmación ACK estricta podrían no enviar datos correctamente. |
| **Solución** | El monitor registra todos los caracteres de control para identificar si el equipo espera respuestas de handshake. |

---

## 2. Problemas de Compatibilidad — TCP/IP

### 2.1 Modelo servidor vs. cliente

| Problema | Descripción |
|----------|-------------|
| **Severidad** | MEDIA |
| **Equipos afectados** | Mindray BC-6800 (TCP) |
| **Descripción** | El agente actual actúa como **servidor TCP** (escucha conexiones entrantes). Algunos equipos de laboratorio esperan conectarse como **cliente** TCP al servidor. Otros equipos actúan como servidor y esperan que el LIS se conecte a ellos. El agente no soporta el modo cliente TCP. |
| **Impacto** | Equipos que actúan como servidor TCP no pueden ser conectados. |
| **Solución** | El monitor soporta ambos modos: servidor (escuchar) y cliente (conectar). |

### 2.2 Puerto TCP compartido

| Problema | Descripción |
|----------|-------------|
| **Severidad** | BAJA |
| **Equipos afectados** | Equipos TCP |
| **Descripción** | Solo un programa puede escuchar en un puerto TCP específico. Si el agente escucha en el puerto 9100, el monitor no puede escuchar en el mismo puerto. |
| **Impacto** | Requiere usar modo proxy TCP para monitorear sin interferir. |
| **Solución** | Modo proxy TCP transparente: el monitor escucha en un puerto diferente y reenvía al puerto del agente. |

---

## 3. Problemas de Compatibilidad — Protocolos de Datos

### 3.1 Variantes de HL7

| Problema | Descripción |
|----------|-------------|
| **Severidad** | MEDIA |
| **Descripción** | HL7 v2.x tiene múltiples sub-versiones (2.3, 2.3.1, 2.4, 2.5, 2.5.1). Cada equipo puede usar una versión diferente con campos opcionales distintos. El parser actual no valida la versión del mensaje. |
| **Impacto** | Campos de datos podrían estar en posiciones inesperadas según la versión HL7. |

### 3.2 Codificación de caracteres

| Problema | Descripción |
|----------|-------------|
| **Severidad** | BAJA |
| **Descripción** | Los datos pueden venir en ASCII, UTF-8, o Latin-1 (ISO-8859-1). Caracteres especiales como ñ, acentos, o símbolos de unidades (µ, ³) pueden corromperse si la codificación no coincide. |
| **Impacto** | Nombres de pacientes con caracteres especiales pueden aparecer incorrectos. |

### 3.3 Formatos propietarios

| Problema | Descripción |
|----------|-------------|
| **Severidad** | ALTA |
| **Descripción** | Algunos equipos (como ABX Micros 60 y DET D20 CEM) usan protocolos propietarios basados en serial que no son estrictamente ASTM ni HL7. El agente actual intenta parsear todo como ASTM, lo que puede fallar silenciosamente. |
| **Impacto** | Resultados de estos equipos podrían no ser capturados correctamente. |
| **Solución** | El monitor registra los datos RAW en hexadecimal y texto para identificar el formato real de cada equipo. |

---

## 4. Problemas de Compatibilidad — Sistema Operativo

### 4.1 Nombres de puertos

| SO | Formato | Ejemplo |
|----|---------|---------|
| Windows | `COMn` | `COM1`, `COM3` |
| Linux | `/dev/ttyUSBn` o `/dev/ttySn` | `/dev/ttyUSB0`, `/dev/ttyS0` |
| macOS | `/dev/tty.usbserial-*` | `/dev/tty.usbserial-1410` |

El agente tiene configurados puertos en formato Windows (`COM1`, `COM3`).
Al correr en Linux se deben cambiar a formato `/dev/ttyUSBn`.

### 4.2 Permisos en Linux

En Linux, acceder a puertos seriales requiere que el usuario pertenezca al grupo `dialout`:
```bash
sudo usermod -a -G dialout $USER
```

### 4.3 Drivers USB-Serial

Muchos equipos se conectan por adaptadores USB-Serial. Algunos requieren drivers específicos:
- **FTDI** (FT232R): Driver incluido en Windows 10+ y Linux
- **Prolific** (PL2303): Requiere driver específico, problemas conocidos con chips clonados
- **CH340/CH341**: Requiere driver adicional en Windows, incluido en Linux

---

## 5. Equipos Configurados — Estado de Compatibilidad

| Equipo | Protocolo | Puerto | Compatibilidad | Notas |
|--------|-----------|--------|----------------|-------|
| Mindray BS-200 | ASTM/Serial | COM1 | ✅ Compatible | Protocolo ASTM estándar |
| Mindray BC-6800 | ASTM/TCP | Puerto 9100 | ✅ Compatible | Verificar modo servidor/cliente |
| ABX Micros 60 | Serial propietario | COM3 | ⚠️ Parcial | Formato puede no ser ASTM puro |
| DET D20 CEM | Serial propietario | COM4 | ⚠️ Parcial | Verificar formato de datos |
| SD BIOSENSOR F200 | Archivo (FILE) | N/A | ✅ Compatible | Monitoreo de archivos |
| DAWEI F5 | DICOM (FILE) | N/A | ✅ Compatible | Imágenes DICOM |

---

## 6. Solución: Monitor de Comunicaciones

Para resolver estos problemas de compatibilidad y poder identificar los métodos de comunicación
reales de cada equipo, se ha creado el programa **Monitor de Comunicaciones** en la carpeta
`monitor-comunicaciones/`.

Este programa:
- ✅ **No interfiere** con el software existente (modo proxy transparente)
- ✅ Registra **todos** los datos transmitidos y recibidos
- ✅ Detecta automáticamente el **protocolo** utilizado (ASTM, HL7, raw)
- ✅ Guarda logs detallados con **timestamps** y datos en **hexadecimal + texto**
- ✅ Permite identificar el formato real de comunicación de cada equipo

Ver: [`monitor-comunicaciones/README.md`](monitor-comunicaciones/README.md)
