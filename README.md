# Centro Diagnóstico SaaS Template

Plantilla base para desplegar nuevas instancias SaaS del sistema de centro diagnóstico.

## Objetivo de esta plantilla

- Repositorio **sin datos de clientes**.
- Branding y configuración inicial en modo plantilla.
- Provisioning de instancia por comando único.

## Requisitos

- Node.js 18+
- npm 9+
- MongoDB accesible (local, Docker o servicio gestionado)
- Git

## Comandos principales

- `npm start` — iniciar backend
- `npm run dev` — backend con nodemon
- `npm test` — tests backend (Jest)
- `npm run env:prepare:prod` — generar/normalizar secretos críticos en `.env`
- `npm run template:saas:clean` — limpiar artefactos locales antes de publicar plantilla

## Ejecución local (sin Docker)

1. Configurar `.env` con valores reales (mínimo `MONGODB_URI`, `JWT_SECRET`, `OFFLINE_SYNC_KEY`).
2. Instalar dependencias:

```bash
npm install
npm --prefix frontend install
```

3. Iniciar backend:

```bash
npm start
```

4. (Opcional) Iniciar frontend en desarrollo:

```bash
npm --prefix frontend start
```

## Ejecución con Docker

Desde la carpeta `docker/`:

```bash
docker compose up -d --build
```

Servicios por defecto:
- Frontend: `http://localhost:3000`
- Backend/API: `http://localhost:5000`
- MongoDB: `localhost:27017`

Notas:
- El proyecto mantiene compatibilidad dual: funciona con y sin Docker.
- Para enlaces públicos (ej. instalador de agentes), definir `PUBLIC_API_URL` en entorno de backend.

## Provisioning en un comando (nueva instancia)

```bash
bash scripts/provision-saas.sh \
  --repo https://github.com/tu-org/centro-diagnostico-v11-main.git \
  --dir /opt/centros/cliente-a \
  --domain cliente-a.tu-dominio.com \
  --api-url https://cliente-a.tu-dominio.com/api \
  --mongo-uri mongodb://mongo:27017/centro_cliente_a \
  --admin-email admin@cliente-a.com
```

### Qué hace el script

1. Clona el repo en un directorio nuevo.
2. Ejecuta limpieza de plantilla (`template:saas:clean`).
3. Instala dependencias backend y frontend.
4. Genera secretos de producción (`JWT_SECRET`, `OFFLINE_SYNC_KEY`).
5. Escribe variables base de la instancia (`MONGODB_URI`, CORS, URLs).
6. Crea/actualiza admin inicial (opcional).

## Checklist rápido “SaaS vacío”

Antes de publicar release/template:

- [ ] No existe `.env` versionado.
- [ ] No existen carpetas runtime con datos (`uploads/`, `mongodb_data/`, `logs/`).
- [ ] No existen artefactos temporales (`release-gate-report.json`, `.vc/`, zips de trabajo).
- [ ] No hay scripts/documentación legacy de stacks no usados.
- [ ] `createAdmin.js` no usa credenciales hardcodeadas.
- [ ] Frontend no contiene dominios/branding de clientes anteriores.

## Variables críticas

- `MONGODB_URI` (obligatoria)
- `JWT_SECRET` (obligatoria, única por instancia)
- `OFFLINE_SYNC_KEY` (obligatoria para sync offline)
- `CORS_ORIGINS`
- `FRONTEND_URL`
- `PUBLIC_API_URL`

## Portabilidad entre plataformas (importante)

Este template está pensado para **no acoplarse a un solo proveedor**.

- Frontend (Vercel o equivalente):
  - Definir `BACKEND_URL` en entorno del frontend.
  - `frontend/vercel.json` usa `routes` con `${BACKEND_URL}` para proxy de `/api`, `/uploads` y `/public`.
  - Si cambiás de backend/provider, sólo cambiás `BACKEND_URL` (sin tocar código/rutas hardcodeadas).

- Backend + Mongo (Railway, VPS, Docker local, etc.):
  - Siempre configurar `MONGODB_URI` explícito por entorno.
  - En Docker Compose, `MONGODB_URI` ahora es sobreescribible por variable para soportar auth, `authSource`, replica set o servicios gestionados.
  - Si no se define, usa fallback local `mongodb://mongo:27017/centro_${CENTRO_ID:-default}` para desarrollo.

## Notas

- Este repo usa backend Node/Express (`server.js`) como runtime principal.
- No ejecutar seeds demo en producción.
- Seeds internas (solo demo): ver `docs/SEEDS_INTERNAL_ONLY.md`.
