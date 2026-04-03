# Matriz exacta de variables (Híbrido C = A+B)

Este documento deja una configuración **portable** para 3 escenarios:

- **A (proxy):** frontend usa `/api` y el host frontend proxy/rewritea al backend.
- **B (directo):** frontend apunta directo al backend (`REACT_APP_API_URL=https://...`).
- **C (híbrido A+B):** usa directo como primario y proxy `/api` como fallback automático.

---

## 1) Escenario: Local sin Docker

### Backend (`.env` del root)

```dotenv
NODE_ENV=development
HOST=0.0.0.0
PORT=5000

# Mongo local sin auth (dev)
MONGODB_URI=mongodb://localhost:27017/centro_diagnostico

JWT_SECRET=change-me-local-jwt
JWT_EXPIRES_IN=24h
OFFLINE_SYNC_KEY=change-me-local-offline

# Frontend local CRA
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://tauri.localhost,tauri://localhost

# URL pública del backend (opcional en local)
PUBLIC_API_URL=http://localhost:5000

# Equipos / DICOM
EQUIPOS_AUTO_START=false
DICOM_MODE=none
ORTHANC_URL=http://localhost:8042
ORTHANC_USER=admin
ORTHANC_PASS=admin
```

### Frontend (`frontend/.env.local`)

#### Opción recomendada local (A proxy puro con CRA)
```dotenv
REACT_APP_API_URL=/api
REACT_APP_API_FALLBACK_PROXY=true
```

#### Opción local C híbrido (directo + fallback proxy)
```dotenv
REACT_APP_API_URL=http://localhost:5000
REACT_APP_API_FALLBACK_PROXY=true
```

---

## 2) Escenario: Docker Compose (local o VPS)

> Archivo base: `docker/docker-compose.yml`

### Variables del host para `docker compose`

```dotenv
# Identificador de instancia
CENTRO_ID=default

# Puertos publicados
PORT=5000
FRONTEND_PORT=3000
MONGO_PORT=27017

# Seguridad app
JWT_SECRET=change-me-docker-jwt
OFFLINE_SYNC_KEY=change-me-docker-offline

# CORS y URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://tauri.localhost,tauri://localhost
PUBLIC_API_URL=http://localhost:5000

# Mongo (sobrescribe fallback del compose)
# Dev sin auth:
MONGODB_URI=mongodb://mongo:27017/centro_default
# Prod/auth ejemplo:
# MONGODB_URI=mongodb://app_user:app_pass@mongo:27017/centro_default?authSource=admin

# Híbrido C en frontend container
REACT_APP_API_URL=/api
REACT_APP_API_FALLBACK_PROXY=true
```

> Nota: en este repo, `nginx.conf` del contenedor frontend ya proxyea `/api` a `backend:5000`.

---

## 3) Escenario: Cloud genérico (Railway/Vercel u otro)

## 3.1 Backend (servicio Node)

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=5000

# IMPORTANTE: ajustar usuario/clave/db/authSource según tu proveedor
MONGODB_URI=mongodb://<APP_USER>:<APP_PASSWORD>@<MONGO_HOST>:<MONGO_PORT>/<DB_NAME>?authSource=<AUTH_DB>

JWT_SECRET=<STRONG_SECRET>
JWT_EXPIRES_IN=24h
OFFLINE_SYNC_KEY=<STRONG_OFFLINE_KEY>

# Dominio público del frontend
FRONTEND_URL=https://<frontend-domain>
CORS_ORIGINS=https://<frontend-domain>,http://tauri.localhost,tauri://localhost

# Dominio público del backend
PUBLIC_API_URL=https://<backend-domain>

# Equipos / DICOM
EQUIPOS_AUTO_START=false
DICOM_MODE=orthanc
ORTHANC_URL=http://<orthanc-host>:8042
ORTHANC_USER=<orthanc-user>
ORTHANC_PASS=<orthanc-pass>
```

## 3.2 Frontend (build env)

### C híbrido recomendado (A+B)
```dotenv
# Primario directo al backend
REACT_APP_API_URL=https://<backend-domain>

# Si falla red/CORS del directo, reintenta por /api (proxy del host frontend)
REACT_APP_API_FALLBACK_PROXY=true
```

## 3.3 Frontend host con proxy `/api`

### Si usás Vercel (este repo)

Setear variable de entorno en el proyecto frontend:

```dotenv
BACKEND_URL=https://<backend-domain>
```

`frontend/vercel.json` ya está preparado para enrutar:

- `/api/*` → `${BACKEND_URL}/api/*`
- `/uploads/*` → `${BACKEND_URL}/uploads/*`
- `/public/*` → `${BACKEND_URL}/public/*`

---

## Reglas operativas (para evitar lock-in)

1. **Nunca hardcodear dominios** en frontend o Docker.
2. Usar siempre `MONGODB_URI` explícito por entorno.
3. En cloud, preferir **C híbrido**: directo + fallback por proxy.
4. Validación mínima post-deploy:
   - `GET /api/health`
   - `GET /api/configuracion/empresa`
   - `POST /api/auth/login`

---

## Snippets rápidos de verificación

```bash
curl -i https://<frontend-domain>/api/health
curl -i https://<frontend-domain>/api/configuracion/empresa
curl -i -X POST https://<frontend-domain>/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"<PASS>"}'
```
