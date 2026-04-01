# Deployment SaaS (flujo recomendado)

## Enfoque

Este proyecto se distribuye como **plantilla SaaS vacía**.

- Sin datos de clientes previos.
- Sin `.env` productivo versionado.
- Secretos generados por instancia.

## 1) Publicar plantilla limpia en GitHub

Antes de tag/release:

```bash
npm run template:saas:clean
```

Luego validar checklist:

- `docs/SAAS_EMPTY_PRE_RELEASE_CHECKLIST.md`
- `docs/DEPLOY_SAFE_CHECKLIST.md`

## 2) Provisionar nueva instancia en 1 comando

```bash
bash scripts/provision-saas.sh \
  --repo https://github.com/tu-org/centro-diagnostico-v11-main.git \
  --dir /opt/centros/cliente-a \
  --domain cliente-a.tu-dominio.com \
  --api-url https://cliente-a.tu-dominio.com/api \
  --mongo-uri mongodb://mongo:27017/centro_cliente_a \
  --admin-email admin@cliente-a.com
```

## 3) Qué no hace el script

- No configura reverse proxy (nginx/traefik/caddy).
- No emite certificados TLS automáticamente.
- No despliega infraestructura (Docker Swarm/K8s/PM2/systemd).

Eso se mantiene en tu capa de infraestructura para no acoplar el template a un único provider.

## 4) Post-provision mínimo

- Levantar proceso backend (`npm start`, PM2 o contenedor).
- Verificar `GET /api/health`.
- Verificar login admin inicial.
