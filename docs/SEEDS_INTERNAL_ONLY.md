# Seeds internas (solo demo/desarrollo)

Este proyecto conserva utilidades de seed por pedido del equipo, pero **no forman parte del flujo de provisioning SaaS**.

## Archivos

- `utils/seed.internal.demo.js`
- `utils/seedPacientes.internal.demo.js`

## Regla de uso

- ✅ Permitido: ambientes locales de demo/desarrollo.
- ❌ Prohibido: producción, plantillas SaaS publicadas y nuevas instancias de clientes.

## Razón

Las seeds incluyen datos demo y credenciales de prueba. Ejecutarlas en una instancia de cliente rompe la política de “SaaS vacío”.

## Salvaguardas actuales

- No existe script `npm run seed` en `package.json`.
- `scripts/provision-saas.sh` no ejecuta seeds.
