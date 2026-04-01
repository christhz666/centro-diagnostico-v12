#!/usr/bin/env bash

set -euo pipefail

log() { printf '%s\n' "$1"; }

usage() {
  cat <<'EOF'
Uso:
  bash scripts/provision-saas.sh \
    --repo <url-git> \
    --dir <directorio-destino> \
    --domain <dominio-publico> \
    --api-url <url-api-publica> \
    --mongo-uri <mongodb-uri> \
    [--admin-email <email>] \
    [--admin-username <usuario>] \
    [--admin-password <password>] \
    [--skip-npm-install] \
    [--skip-admin]

Ejemplo:
  bash scripts/provision-saas.sh \
    --repo https://github.com/tu-org/centro-diagnostico-v11-main.git \
    --dir /opt/centros/centro-nuevo \
    --domain centro.cliente.com \
    --api-url https://centro.cliente.com/api \
    --mongo-uri mongodb://mongo:27017/centro_cliente \
    --admin-email admin@cliente.com
EOF
}

require_non_empty() {
  local flag_name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    log "❌ El parámetro $flag_name no puede estar vacío"
    exit 1
  fi
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "❌ Falta dependencia requerida: $cmd"
    exit 1
  fi
}

REPO_URL=""
TARGET_DIR=""
DOMAIN=""
API_URL=""
MONGO_URI=""
ADMIN_EMAIL=""
ADMIN_USERNAME="admin"
ADMIN_PASSWORD=""
SKIP_NPM_INSTALL="false"
SKIP_ADMIN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --repo"; usage; exit 1; fi
      REPO_URL="$2"; require_non_empty "--repo" "$REPO_URL"; shift 2 ;;
    --dir)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --dir"; usage; exit 1; fi
      TARGET_DIR="$2"; require_non_empty "--dir" "$TARGET_DIR"; shift 2 ;;
    --domain)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --domain"; usage; exit 1; fi
      DOMAIN="$2"; require_non_empty "--domain" "$DOMAIN"; shift 2 ;;
    --api-url)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --api-url"; usage; exit 1; fi
      API_URL="$2"; require_non_empty "--api-url" "$API_URL"; shift 2 ;;
    --mongo-uri)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --mongo-uri"; usage; exit 1; fi
      MONGO_URI="$2"; require_non_empty "--mongo-uri" "$MONGO_URI"; shift 2 ;;
    --admin-email)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --admin-email"; usage; exit 1; fi
      ADMIN_EMAIL="$2"; require_non_empty "--admin-email" "$ADMIN_EMAIL"; shift 2 ;;
    --admin-username)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --admin-username"; usage; exit 1; fi
      ADMIN_USERNAME="$2"; require_non_empty "--admin-username" "$ADMIN_USERNAME"; shift 2 ;;
    --admin-password)
      if [[ $# -lt 2 ]]; then log "❌ Falta valor para --admin-password"; usage; exit 1; fi
      ADMIN_PASSWORD="$2"; require_non_empty "--admin-password" "$ADMIN_PASSWORD"; shift 2 ;;
    --skip-npm-install) SKIP_NPM_INSTALL="true"; shift 1 ;;
    --skip-admin) SKIP_ADMIN="true"; shift 1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      log "❌ Opción desconocida: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$REPO_URL" || -z "$TARGET_DIR" || -z "$DOMAIN" || -z "$API_URL" || -z "$MONGO_URI" ]]; then
  log "❌ Faltan parámetros obligatorios"
  usage
  exit 1
fi

require_command git
require_command node
require_command npm
require_command bash

if [[ -e "$TARGET_DIR" ]]; then
  if [[ -d "$TARGET_DIR" ]]; then
    if [[ -n "$(ls -A "$TARGET_DIR")" ]]; then
      log "❌ El directorio destino no está vacío: $TARGET_DIR"
      exit 1
    fi
  else
    log "❌ El destino existe y no es un directorio: $TARGET_DIR"
    exit 1
  fi
else
  mkdir -p "$TARGET_DIR"
fi

log "📥 Clonando repositorio en $TARGET_DIR"
git clone "$REPO_URL" "$TARGET_DIR"

cd "$TARGET_DIR"

log "🧹 Limpiando artefactos de plantilla SaaS"
npm run template:saas:clean

if [[ "$SKIP_NPM_INSTALL" != "true" ]]; then
  log "📦 Instalando dependencias backend"
  npm install

  if [[ -d "frontend" && -f "frontend/package.json" ]]; then
    log "📦 Instalando dependencias frontend"
    npm --prefix frontend install
  fi
fi

export MONGODB_URI="$MONGO_URI"
export CORS_ORIGINS="https://$DOMAIN,http://localhost:3000,http://tauri.localhost,tauri://localhost"
export FRONTEND_URL="https://$DOMAIN"
export PUBLIC_API_URL="$API_URL"

log "🔐 Preparando .env para producción"
npm run env:prepare:prod

node <<'EOF'
const { setEnvVariables } = require('./utils/envFileManager');
setEnvVariables({
  MONGODB_URI: process.env.MONGODB_URI,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  FRONTEND_URL: process.env.FRONTEND_URL,
  PUBLIC_API_URL: process.env.PUBLIC_API_URL,
  NODE_ENV: 'production'
});
console.log('✅ Variables base de instancia aplicadas en .env');
EOF

if [[ "$SKIP_ADMIN" != "true" ]]; then
  ADMIN_ARGS=(--username "$ADMIN_USERNAME")

  if [[ -n "$ADMIN_EMAIL" ]]; then
    ADMIN_ARGS+=(--email "$ADMIN_EMAIL")
  fi

  if [[ -n "$ADMIN_PASSWORD" ]]; then
    ADMIN_ARGS+=(--password "$ADMIN_PASSWORD")
  fi

  log "👤 Creando/actualizando admin inicial"
  node createAdmin.js "${ADMIN_ARGS[@]}"
fi

log ""
log "✅ Provisioning SaaS completado"
log "📁 Directorio: $TARGET_DIR"
log "🌐 Dominio: https://$DOMAIN"
log "🔌 API: $API_URL"
log "🧪 Próximo paso: iniciar servicios (docker/pm2/systemd según infraestructura)"
