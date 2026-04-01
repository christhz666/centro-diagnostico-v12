# Deploy Seguro + Rollback + Verificación Post-Deploy

Checklist operacional para producción luego del hardening.

## 1) Pre-deploy

- [ ] Backup reciente de MongoDB (`scripts/backupDatabase.js` o estrategia de infraestructura)
- [ ] Variables obligatorias definidas en entorno de deploy:
  - [ ] `MONGODB_URI`
  - [ ] `JWT_SECRET`
  - [ ] `OFFLINE_SYNC_KEY`
- [ ] Variables opcionales para release gate (si querés override explícito):
  - [ ] `RELEASE_GATE_JWT_SECRET`
  - [ ] `RELEASE_GATE_OFFLINE_SYNC_KEY`
- [ ] Variables recomendadas:
  - [ ] `CORS_ORIGINS`
  - [ ] `FRONTEND_URL`
  - [ ] `PUBLIC_API_URL`
  - [ ] `RATE_LIMIT_MAX`
  - [ ] `RATE_LIMIT_LOGIN_MAX`

## 2) Validación previa de código

- [ ] `npm test -- --runInBand --ci`
- [ ] `npm run release:gate` (tests + health + offline-sync 401/401/200)
- [ ] Revisar `release-gate-report.json` (`summary.exit_code = 0`, todas las etapas en `passed`)
- [ ] Confirmar que existen tests de seguridad en `tests/security/`
- [ ] Revisar diff de rutas críticas (`admin`, `citas`, `facturas`, `resultados`, `contabilidad`, `dashboard`, `caja`)

## 3) Migración de datos

- [ ] Ejecutar migración de hash para portal paciente:
  - `npm run migrate:factura-password-hash`
- [ ] Confirmar salida: `Migración completada` y conteo > 0 si había legacy

## 4) Deploy

- [ ] Deploy de backend
- [ ] Reinicio controlado del proceso (PM2/Systemd/Docker)
- [ ] Confirmar healthcheck:
  - `GET /api/health -> 200`

## 5) Verificación post-deploy (obligatoria)

### Seguridad
- [ ] `GET /api/admin/usuarios/offline-sync` sin header -> `401`
- [ ] mismo endpoint con header inválido -> `401`
- [ ] mismo endpoint con header correcto -> `200`

### Auth
- [ ] Login admin OK
- [ ] Endpoint protegido sin token devuelve `401`

### Negocio
- [ ] `GET /api/dashboard/stats` responde `success: true`
- [ ] Crear cita/factura/pago funciona en sucursal correcta
- [ ] Operación cross-sucursal restringida devuelve `403`
- [ ] Portal paciente QR: bloquea deuda (`402`) y permite pagada (`200`)

## 6) Rollback (si falla)

### Criterio de rollback inmediato
- Cualquier `500` sostenido en login, dashboard, facturación o resultados
- Falla de autenticación generalizada
- Errores de scoping que bloqueen operación normal en sucursal válida

### Pasos
- [ ] Detener despliegue actual
- [ ] Revertir a versión anterior estable
- [ ] Reiniciar servicio
- [ ] Ejecutar healthcheck y smoke mínimo
- [ ] Abrir incidente con hora, error y endpoint afectado

## 7) Evidencia mínima a guardar

- [ ] Resultado de `npm test`
- [ ] `release-gate-report.json`
- [ ] Resultado de migración
- [ ] Capturas/respuestas de health y offline-sync (401/401/200)
- [ ] Timestamp de deploy y versión liberada
