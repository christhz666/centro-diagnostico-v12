# Checklist “SaaS VACÍO” (pre-release)

Checklist obligatorio para publicar una plantilla limpia y reusable por cliente.

## 1) Código y estructura

- [ ] Runtime principal: Node/Express (`server.js`) únicamente.
- [ ] Sin restos de stack legacy no utilizado (scripts/docs/config de Python/Flask u otros).
- [ ] Documentación de despliegue unificada en el flujo actual.

## 2) Datos locales y artefactos

- [ ] No hay `mongodb_data/` dentro del repo publicado.
- [ ] No hay `uploads/` con archivos de instancia anterior.
- [ ] No hay `logs/` ni dumps temporales.
- [ ] No hay `release-gate-report.json` ni reportes locales residuales.
- [ ] No hay carpetas temporales (`temp_*`, `.vc/`, zips de diseño/workbench).

## 3) Seguridad por instancia

- [ ] `.env` NO versionado.
- [ ] `.env.example` con placeholders (sin secretos reales).
- [ ] `JWT_SECRET` se genera único por instancia.
- [ ] `OFFLINE_SYNC_KEY` se genera único por instancia.
- [ ] `MONGODB_URI` parametrizable por tenant.

## 4) Branding y textos neutrales

- [ ] Sin nombres de clientes anteriores en frontend/backend.
- [ ] Sin dominios hardcodeados de instancias previas.
- [ ] Logos por defecto genéricos (placeholder), no de cliente real.

## 5) Provisioning “one-command”

- [ ] Script canónico disponible (`scripts/provision-saas.sh`).
- [ ] Script valida parámetros obligatorios (repo, dir, domain, api-url, mongo-uri).
- [ ] Script prepara `.env`, secretos y admin inicial opcional.
- [ ] Script no ejecuta seed demo automáticamente.

## 6) Smoke funcional mínimo

- [ ] `GET /api/health` responde 200.
- [ ] Login funciona con admin inicial provisionado.
- [ ] Endpoint protegido sin token devuelve 401.
- [ ] Offline sync sin key devuelve 401/503 según configuración.

## 7) Gate de entrega

Liberar template solo si TODO está en ✅.
