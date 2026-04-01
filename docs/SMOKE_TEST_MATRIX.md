# Smoke Test Matrix por Rol

Este documento valida el flujo mínimo operativo luego del hardening de seguridad y multi-sucursal.

## Precondiciones

- `.env` configurado con:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `OFFLINE_SYNC_KEY`
- Servidor levantado (`npm start` o `npm run dev`)
- Al menos una sucursal creada
- Usuarios existentes por rol: `admin`, `recepcion/recepcionista`, `medico`

## 1) Admin

### 1.1 Login
- Endpoint: `POST /api/auth/login`
- Esperado: `200`, token JWT, usuario con role admin

### 1.2 Dashboard global
- Endpoint: `GET /api/dashboard/stats` con Bearer token
- Esperado: `200`, `success: true`, objeto `data.facturacion`

### 1.3 Offline Sync protegido
- Endpoint: `GET /api/admin/usuarios/offline-sync`
- Casos:
  - Sin header `x-offline-sync-key` -> `401`
  - Header incorrecto -> `401`
  - Header correcto -> `200`

### 1.4 Facturación desde orden
- Endpoint: `POST /api/facturas/crear-desde-orden/:ordenId`
- Esperado: `201`, factura creada con `numero`, `total`, `data`

## 2) Recepción / Recepcionista

> Debe enviar header `x-sucursal-id` cuando el usuario no tenga sucursal fija.

### 2.1 Citas por sucursal
- Endpoint: `GET /api/citas`
- Esperado: solo citas de su sucursal

### 2.2 Crear cita
- Endpoint: `POST /api/citas`
- Esperado: `201`, cita creada con `sucursal` correcta

### 2.3 Facturas por sucursal
- Endpoint: `GET /api/facturas`
- Esperado: solo facturas de su sucursal

### 2.4 Registrar pago
- Endpoint: `POST /api/facturas/:id/pagar`
- Esperado:
  - Factura misma sucursal -> `200`
  - Factura otra sucursal -> `403`

### 2.5 Contabilidad
- Endpoints:
  - `GET /api/contabilidad/resumen`
  - `GET /api/contabilidad/facturacion-dia`
- Esperado: agregados de su sucursal

## 3) Médico

### 3.1 Login y dashboard
- Endpoint: `POST /api/auth/login`, `GET /api/dashboard/stats`
- Esperado: acceso ok, estadísticas disponibles

### 3.2 Resultados asignados
- Endpoint: `GET /api/resultados?estado=pendiente`
- Esperado: resultados visibles según permisos/scoping

### 3.3 Validar/Firmar resultado
- Endpoints:
  - `PUT /api/resultados/:id/validar`
  - `PUT /api/resultados/:id/firma`
- Esperado: requiere firma digital; respuesta `200` cuando firma existe

## 4) Portal Paciente

### 4.1 Acceso por QR
- Endpoint: `GET /api/resultados/acceso-qr/:codigoQR`
- Esperado:
  - Factura con deuda -> `402`, `blocked: true`
  - Factura pagada -> `200`, `blocked: false`, lista de resultados

### 4.2 Acceso por usuario/clave
- Endpoint: `POST /api/resultados/acceso-paciente`
- Esperado:
  - credenciales correctas -> `200`
  - incorrectas -> `401`

## Criterio de salida

Release apto cuando:

- Todas las pruebas anteriores pasan.
- No hay respuestas `500` en flujos críticos.
- Offline sync solo responde `200` con `x-offline-sync-key` correcto.
