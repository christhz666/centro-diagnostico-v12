# Agente Conector API (Mindray ↔ Servidor)

## Objetivo
Este agente usa **API Key por equipo** (generada desde el panel) para:
- enviar heartbeat al servidor
- hacer pull de órdenes pendientes (`ordenes-pull`)
- confirmar descarga de lista (`ordenes-ack`)
- enviar resultados (`resultados-submit`)

En modo `manual_pull`, el equipo descarga manualmente la lista cuando el operador pulsa el botón del equipo.
La lista queda disponible y se actualiza con nuevos pendientes automáticamente.

## Instalación rápida
1. Copiar esta carpeta a la PC del equipo.
2. Copiar `config.example.json` como `config.json`.
3. Completar:
   - `equipoId`
   - `apiBaseUrl`
   - `apiKey` (generada en Admin Equipos)
   - `mindray.ip`
   - `modoOperacion: "manual_pull"`
4. Ejecutar:
   ```bash
   node agente-conector.js
   ```

## Seguridad
- La API key **se pega en el agente**, no en el frontend.
- En el backend se guarda hash, no la clave plana.
- Si se compromete, regenerar API key desde panel.
