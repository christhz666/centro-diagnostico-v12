#!/usr/bin/env node

/**
 * Limpieza de plantilla SaaS (sin datos de instancia previa)
 *
 * Uso:
 *   npm run template:saas:clean
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

const RELATIVE_PATHS = [
  '.agents',
  '.skills',
  '.stitch',
  '.vscode',
  'app',
  'migrations',
  'start-server.sh',
  'start-servers.bat',
  'unignore-build.js',
  'mongodb_data',
  'uploads',
  'logs',
  'monitor-ui/logs',
  'monitor-comunicaciones/logs',
  'frontend/build',
  'frontend/node_modules/.cache',
  'cloudflared-frontend.log',
  'release-gate-report.json',
  'error.txt',
  'test-barcode.png',
  'stitch_medical_diagnostic_dashboard.zip',
  'stitch_medical_diagnostic_dashboard (1).zip',
  'temp_stitch_dashboard',
  'temp_stitch_registro',
  '.vc',
  'tests/error_log.txt',
  'tests/error_log_utf8.txt',
  'tests/error_log2.txt',
  'tests/error_log2_utf8.txt',
  'tests/output.txt',
  'tests/output_utf8.txt',
  'para cuando llegue la luz-1.txt'
];

function removePath(targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.warn(`⚠️ No se pudo eliminar ${path.relative(projectRoot, targetPath)}: ${error.code || error.message}`);
    return false;
  }
}

function main() {
  let removed = 0;

  for (const relative of RELATIVE_PATHS) {
    const absolute = path.join(projectRoot, relative);
    const didRemove = removePath(absolute);
    if (didRemove) {
      removed += 1;
      console.log(`🧹 Eliminado: ${relative}`);
    }
  }

  console.log(`\n✅ Limpieza SaaS completada. Elementos eliminados: ${removed}`);
  console.log('ℹ️  Recordatorio: este script NO modifica base de datos remota ni secretos de entorno.');
}

main();
