const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const BASE_URL = process.env.PUBLIC_API_URL || 'http://127.0.0.1:5000';

const Equipo = require('../models/Equipo');
const Estudio = require('../models/Estudio');
const Paciente = require('../models/Paciente');
const Cita = require('../models/Cita');
const Factura = require('../models/Factura');
const OrdenEquipo = require('../models/OrdenEquipo');
const Resultado = require('../models/Resultado');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch (_) {
      // retry
    }
    await wait(1000);
  }
  throw new Error('Servidor no respondió /api/health a tiempo');
}

async function api(pathname, options = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`${pathname} -> HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no está configurado en .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server-err] ${d}`));

  try {
    await waitForServer();

    // Login web/admin
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'Admin123456!'
      }
    });

    const token = login?.token || login?.access_token;
    if (!token) throw new Error('No se obtuvo token de login');

    const authHeaders = { Authorization: `Bearer ${token}` };

    // Crear equipo desde la web/API
    const createEquipo = await api('/api/equipos', {
      method: 'POST',
      headers: authHeaders,
      body: {
        nombre: `E2E-Mindray-${Date.now()}`,
        marca: 'Mindray',
        modelo: 'BC-6800',
        tipo: 'hematologia',
        protocolo: 'HL7',
        estado: 'activo'
      }
    });

    const equipo = createEquipo;
    const equipoId = equipo?._id;
    if (!equipoId) throw new Error('No se creó equipo en /api/equipos');

    // Integración + API key
    await api(`/api/equipos/${equipoId}/integracion`, {
      method: 'PUT',
      headers: authHeaders,
      body: {
        equipoIpMindray: '192.168.1.120',
        apiBaseUrl: BASE_URL,
        agenteVersion: 'verify-script',
        modoEntrega: 'manual_pull'
      }
    });

    const keyResp = await api(`/api/equipos/${equipoId}/generar-api-key`, {
      method: 'POST',
      headers: authHeaders
    });

    const apiKey = keyResp?.data?.apiKey;
    if (!apiKey) throw new Error('No se pudo generar API key para el equipo');

    // Datos clínicos mínimos para validar submit real
    const base = Date.now();
    const estudio = await Estudio.create({
      nombre: `E2E Estudio ${base}`,
      codigo: `E2E${base.toString().slice(-6)}`,
      codigoLIS: 'GLU',
      categoria: 'Laboratorio Clínico',
      precio: 100
    });

    const paciente = await Paciente.create({
      nombre: 'Paciente',
      apellido: 'E2E',
      cedula: `E2E-${base}`,
      fechaNacimiento: new Date('1990-01-01'),
      sexo: 'M',
      telefono: '8090000000'
    });

    const cita = await Cita.create({
      paciente: paciente._id,
      estudios: [{ estudio: estudio._id, precio: 100 }],
      fecha: new Date(),
      horaInicio: '08:00',
      estado: 'completada'
    });

    const factura = await Factura.create({
      paciente: paciente._id,
      cita: cita._id,
      items: [{
        descripcion: estudio.nombre,
        estudio: estudio._id,
        cantidad: 1,
        precioUnitario: 100,
        subtotal: 100
      }],
      subtotal: 100,
      total: 100,
      montoPagado: 100,
      pagado: true
    });

    if (!factura.codigoId || factura.codigoId < 1000) {
      factura.codigoId = 1000 + Math.floor(Math.random() * 80000);
      await factura.save();
    }

    const orden = await OrdenEquipo.create({
      equipo: equipoId,
      factura: factura._id,
      cita: cita._id,
      paciente: paciente._id,
      pacienteNombre: `${paciente.nombre} ${paciente.apellido}`,
      codigoId: factura.codigoId,
      estado: 'pendiente',
      pruebas: [{
        estudio: estudio._id,
        codigo: 'GLU',
        codigoEquipo: 'GLU',
        nombre: estudio.nombre,
        completada: false
      }]
    });

    // AGENTE pide lista (manual pull)
    const pull = await api(`/api/equipos/${equipoId}/ordenes-pull?limit=1000`, {
      headers: { 'x-equipo-api-key': apiKey }
    });

    const ordenes = pull?.data?.ordenes || [];
    if (!ordenes.some(o => String(o.ordenId) === String(orden._id))) {
      throw new Error('ordenes-pull no devolvió la orden esperada');
    }

    // AGENTE confirma descarga
    const ack = await api(`/api/equipos/${equipoId}/ordenes-ack`, {
      method: 'POST',
      headers: { 'x-equipo-api-key': apiKey },
      body: { orderIds: [orden._id.toString()] }
    });

    if ((ack?.data?.acked || 0) < 1) {
      throw new Error('ordenes-ack no marcó ninguna orden');
    }

    // AGENTE envía resultado real
    await api(`/api/equipos/${equipoId}/resultados-submit`, {
      method: 'POST',
      headers: { 'x-equipo-api-key': apiKey },
      body: {
        ordenId: orden._id.toString(),
        codigoId: factura.codigoId,
        resultados: [{
          codigoEquipo: 'GLU',
          valor: '98',
          unidad: 'mg/dL',
          estado: 'normal'
        }]
      }
    });

    await wait(500);

    const ordenFinal = await OrdenEquipo.findById(orden._id).lean();
    const completa = ordenFinal?.pruebas?.every(p => p.completada);
    if (!completa) {
      throw new Error('La orden no quedó marcada como completada tras resultados-submit');
    }

    const resultadoCreado = await Resultado.findOne({
      factura: factura._id,
      paciente: paciente._id
    }).sort({ createdAt: -1 }).lean();

    if (!resultadoCreado) {
      throw new Error('No se creó Resultado en la base de datos');
    }

    console.log('\n✅ VERIFICACIÓN E2E EXITOSA');
    console.log(`   Equipo ID: ${equipoId}`);
    console.log(`   Factura códigoId: ${factura.codigoId}`);
    console.log(`   Orden pull/ack/submit OK: ${orden._id}`);
    console.log(`   Resultado creado: ${resultadoCreado._id}`);
  } finally {
    child.kill('SIGINT');
    await wait(500);
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error(`\n❌ FALLÓ VERIFICACIÓN E2E: ${err.message}`);
  process.exit(1);
});
