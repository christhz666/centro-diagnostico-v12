const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

function getArg(name) {
  const idx = process.argv.findIndex((arg) => arg === name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function randomPassword(length = 20) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

async function createOrResetAdmin() {
  const email = (getArg('--email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase() || undefined;
  const username = (getArg('--username') || process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = (getArg('--password') || process.env.ADMIN_PASSWORD || randomPassword()).trim();
  const nombre = (getArg('--nombre') || process.env.ADMIN_NOMBRE || 'Administrador').trim();
  const apellido = (getArg('--apellido') || process.env.ADMIN_APELLIDO || 'Sistema').trim();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no está configurado');
  }

  if (password.length < 10) {
    throw new Error('La contraseña del admin debe tener al menos 10 caracteres');
  }

  if (!email && !username) {
    throw new Error('Debe indicar --email o --username para crear el admin');
  }

  const query = { $or: [] };
  if (email) query.$or.push({ email });
  if (username) query.$or.push({ username });

  await mongoose.connect(process.env.MONGODB_URI);

  let admin = await User.findOne(query).select('+password');

  if (!admin) {
    admin = await User.create({
      nombre,
      apellido,
      username,
      email,
      password,
      role: 'admin',
      activo: true
    });
    console.log('✅ Admin creado correctamente.');
  } else {
    admin.nombre = nombre;
    admin.apellido = apellido;
    admin.username = username;
    admin.email = email;
    admin.password = password;
    admin.role = 'admin';
    admin.activo = true;
    await admin.save();
    console.log('✅ Admin existente actualizado y reactivado.');
  }

  console.log('--- CREDENCIALES INICIALES ---');
  console.log(`Usuario: ${username || '(no definido)'}`);
  if (email) console.log(`Email: ${email}`);
  console.log(`Contraseña: ${password}`);
}

createOrResetAdmin()
  .catch((error) => {
    console.error('❌ No se pudo crear/restablecer el admin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
