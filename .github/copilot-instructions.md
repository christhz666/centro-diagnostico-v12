# Copilot Instructions for `centro-diagnostico-v11-main`

## Build, test, and lint commands

### Main app (root: Express API + React build serving)
- Install backend deps: `npm install`
- Run backend in dev mode: `npm run dev`
- Run backend in prod mode: `npm start`
- Build frontend from root: `npm run frontend:build`
- Create initial admin user: `node createAdmin.js`
- Package backend exe (Windows): `npm run build:backend`

### Frontend (`frontend\`, Create React App)
- Install deps: `cd frontend && npm install`
- Dev server: `cd frontend && npm start`
- Production build: `cd frontend && npm run build`
- Full frontend tests: `cd frontend && npm test`
- Single test file: `cd frontend && npm test -- --watchAll=false src/App.test.js`

### Other subprojects in this repo
- `monitor-comunicaciones\`: `npm install`, `npm start`, `npm test`
- `agentes\agente-laboratorio\`: `npm install`, `npm start`, `npm test`
- `apps-escritorio\App-Offline\` (Vite/Tauri): `npm install`, `npm run dev`, `npm run build`, `npm run lint`

### Current state of lint/test coverage
- Root `package.json` has no backend lint or backend automated test script.
- `tests\*.py` and root `test_*.js` files are ad-hoc/integration scripts (run directly with Python/Node), not wired into a unified test runner.

## High-level architecture

- **Primary backend runtime is Node/Express (`server.js`)**, not `run.py`.  
  `server.js` bootstraps env, security middleware, MongoDB connection, API routes, static file serving, and centralized error handling.

- **Layering pattern:** `routes/` -> `controllers/` -> `models/` + `services/`.  
  Controllers contain business logic and usually respond with `{ success, message?, data? }`.

- **MongoDB/Mongoose data model** lives in `models/` with hooks and virtuals (users, pacientes, facturas, resultados, etc.).  
  `config/db.js` also performs startup index checks/repairs for `User` unique sparse fields.

- **Frontend is a React SPA (`frontend/src/App.js`)** with role-based navigation and a public patient portal route (`/mis-resultados`).  
  In production, Express serves `frontend/build` if present.

- **Frontend API access is centralized in `frontend/src/services/api.js`**.  
  It injects auth token + `x-sucursal-id`, handles 401 globally, and normalizes both current and legacy backend response shapes.

- **Background integrations start from backend startup**:
  - `services/equipoService.js`: lab equipment protocol listeners (ASTM/HL7/TCP/SERIAL/FILE)
  - `services/orthancService.js`: DICOM/Orthanc worklist send + periodic sync

## Key conventions specific to this codebase

- **Edit the route files actually mounted by `server.js`.**  
  There are duplicate/legacy route files (`*Routes.js` and plural variants). Canonical mounts are in `server.js` (for example `/api/pacientes` uses `routes/pacientes.js`).

- **Auth and authorization flow:** use `protect` first, then `authorize(...)` where needed.  
  Route-level auth patterns are standardized in `routes/*.js`.

- **Sucursal scoping is first-class.**  
  Frontend sends `x-sucursal-id`; backend `requireSucursal` injects `req.sucursalId` and populates `req.body.sucursal` on POST/PUT. Admin/super-admin/medico have bypass logic.

- **Preserve response compatibility.**  
  Preferred backend envelope is `{ success: true, data: ... }`, but frontend currently supports multiple legacy keys (`pacientes`, `facturas`, `usuario`, etc.) via normalizers in `api.js`.

- **Error handling pattern:** controllers should `next(error)` for unexpected failures and let `middleware/errorHandler.js` format responses.  
  For expected business errors, return explicit JSON with `success: false` + message.

- **Optional unique user identifiers (`email`, `username`) are sparse-index sensitive.**  
  `models/User.js` removes empty/null values in pre-validate, and `config/db.js` auto-recreates non-sparse unique indexes as sparse at startup.

- **Public patient-result flow depends on exact routes and env vars:**
  - `GET /api/verificar/:codigo` validates QR
  - `POST /api/resultados/acceso-paciente` validates patient credentials
  - `GET /api/resultados/acceso-qr/:codigoQR` returns QR results (blocks on unpaid invoices)
  - `routes/verificar.js` uses `PUBLIC_API_URL` for API links and `FRONTEND_URL` for portal redirect (`/mis-resultados?qr=...`)
  - Backward-compat verifier route is mounted at both `/api/verificar` and `/verificar`

- **Offline app bootstrap exception:** `GET /api/admin/usuarios/offline-sync` remains before `router.use(protect)` in `routes/admin.js`, but now requires `OFFLINE_SYNC_KEY` in server env and request header `x-offline-sync-key`.
