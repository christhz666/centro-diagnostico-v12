const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const CONFIG_PATH = path.join(APP_DIR, 'config.json');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(path.join(APP_DIR, 'agente-conector.log'), line + '\n');
  } catch {}
}

async function enviarLogsServidor(cfg, logs) {
  if (!logs || logs.length === 0) return;
  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/equipos/${cfg.equipoId}/logs`;

  try {
    await requestJson({
      method: 'POST',
      url,
      headers: {
        'x-equipo-api-key': cfg.apiKey
      },
      body: { logs }
    });
  } catch (err) {
    log(`⚠️ No se pudo enviar logs al servidor: ${err.message}`);
  }
}

function cargarConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('No existe config.json. Copiá config.example.json como config.json');
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function requestJson({ method, url, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const transport = u.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const req = transport.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (!data) return resolve({ status: res.statusCode, data: {} });
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          reject(new Error(`Respuesta no JSON (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function enviarHeartbeat(cfg) {
  const url = `${cfg.apiBaseUrl.replace(/\/$/, '')}/api/equipos/${cfg.equipoId}/heartbeat`;
  const resp = await requestJson({
    method: 'POST',
    url,
    headers: {
      'x-equipo-api-key': cfg.apiKey
    },
    body: {
      equipoIpMindray: cfg.mindray?.ip || '',
      agenteVersion: cfg.agenteVersion || '1.0.0'
    }
  });
  if (resp.status >= 400 || resp.data?.success === false) {
    throw new Error(resp.data?.message || `heartbeat error ${resp.status}`);
  }

  await enviarLogsServidor(cfg, [{
    level: 'info',
    event: 'agente.heartbeat.ok',
    message: 'Heartbeat enviado correctamente',
    payload: {
      equipoIpMindray: cfg.mindray?.ip || null,
      agenteVersion: cfg.agenteVersion || '1.0.0'
    }
  }]);
}

async function pullOrdenes(cfg) {
  if ((cfg.modoOperacion || 'manual_pull') !== 'manual_pull') {
    return [];
  }

  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/equipos/${cfg.equipoId}/ordenes-pull?limit=1000`;
  const resp = await requestJson({
    method: 'GET',
    url,
    headers: {
      'x-equipo-api-key': cfg.apiKey
    }
  });

  if (resp.status >= 400 || resp.data?.success === false) {
    throw new Error(resp.data?.message || `ordenes-pull error ${resp.status}`);
  }

  const ordenes = resp.data?.data?.ordenes || [];

  await enviarLogsServidor(cfg, [{
    level: 'info',
    event: 'agente.pull.ok',
    message: `Ordenes reclamadas: ${ordenes.length}`,
    payload: {
      count: ordenes.length,
      orderIds: ordenes.map(o => o.ordenId)
    }
  }]);

  return ordenes;
}

async function ackOrdenes(cfg, orderIds = []) {
  if (!orderIds.length) return;
  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/equipos/${cfg.equipoId}/ordenes-ack`;

  const resp = await requestJson({
    method: 'POST',
    url,
    headers: {
      'x-equipo-api-key': cfg.apiKey
    },
    body: { orderIds }
  });

  await enviarLogsServidor(cfg, [{
    level: 'info',
    event: 'agente.ack.ok',
    message: 'ACK de órdenes enviado',
    payload: {
      orderIds,
      acked: resp?.data?.data?.acked || null
    }
  }]);
}

async function submitResultadoDemo(cfg, orden) {
  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/equipos/${cfg.equipoId}/resultados-submit`;

  const primerCodigo = orden?.pruebas?.[0]?.codigo || 'TEST';

  const resp = await requestJson({
    method: 'POST',
    url,
    headers: {
      'x-equipo-api-key': cfg.apiKey
    },
    body: {
      ordenId: orden.ordenId,
      codigoId: orden.codigoId,
      resultados: [
        {
          codigoEquipo: primerCodigo,
          valor: '1.0',
          unidad: 'U/L',
          estado: 'normal'
        }
      ]
    }
  });

  await enviarLogsServidor(cfg, [{
    level: 'info',
    event: 'agente.submit.demo.ok',
    message: 'Resultado demo enviado al servidor',
    payload: {
      ordenId: orden.ordenId,
      status: resp?.status || null
    }
  }]);
}

async function ciclo() {
  const cfg = cargarConfig();

  if (!cfg.equipoId || !cfg.apiBaseUrl || !cfg.apiKey) {
    throw new Error('config.json incompleto: equipoId, apiBaseUrl y apiKey son obligatorios');
  }

  await enviarHeartbeat(cfg);
  const ordenes = await pullOrdenes(cfg);

  if (ordenes.length > 0) {
    log(`📥 Órdenes recibidas: ${ordenes.length}`);
    await ackOrdenes(cfg, ordenes.map(o => o.ordenId));
    for (const o of ordenes) {
      const codigos = (o.pruebas || []).map(p => p.codigo).join(', ');
      log(` - Orden ${o.ordenId} | Paciente: ${o.paciente?.nombre || 'N/A'} | Pruebas: ${codigos}`);

      if (cfg.enviarDemoAutomatico === true) {
        await submitResultadoDemo(cfg, o);
        log(`   ↳ Resultado demo enviado para orden ${o.ordenId}`);
      }
    }
  } else {
    log('⏳ Sin órdenes pendientes');
  }
}

async function main() {
  log('🚀 Iniciando agente-conector-api...');
  const cfg = cargarConfig();
  const pollingMs = Number(cfg.pollingMs || 5000);

  const run = async () => {
    try {
      await ciclo();
    } catch (err) {
      log(`❌ ${err.message}`);
    }
  };

  await run();
  setInterval(run, pollingMs);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
