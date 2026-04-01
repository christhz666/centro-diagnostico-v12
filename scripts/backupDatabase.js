/**
 * Script de backup automático de MongoDB
 * Ejecutar con: node scripts/backupDatabase.js
 * O programar con cron: 0 2 * * * cd /ruta && node scripts/backupDatabase.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configuración
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/centro_diagnostico';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 7;

// Crear directorio de backups si no existe
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function createBackup() {
    const timestamp = getTimestamp();
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    
    console.log(`[Backup] Iniciando backup: ${backupName}`);
    
    try {
        // Extraer nombre de la base de datos de la URI
        const dbName = MONGODB_URI.split('/').pop().split('?')[0];
        
        // Ejecutar mongodump
        const cmd = `mongodump --uri="${MONGODB_URI}" --out="${backupPath}" --gzip`;
        execSync(cmd, { stdio: 'inherit' });
        
        // Crear archivo comprimido
        const zipPath = `${backupPath}.zip`;
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        return new Promise((resolve, reject) => {
            output.on('close', () => {
                // Eliminar directorio temporal
                fs.rmSync(backupPath, { recursive: true, force: true });
                
                const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
                console.log(`[Backup] ✅ Completado: ${zipPath} (${sizeMB} MB)`);
                
                cleanOldBackups();
                resolve(zipPath);
            });
            
            archive.on('error', (err) => {
                reject(err);
            });
            
            archive.pipe(output);
            archive.directory(backupPath, false);
            archive.finalize();
        });
        
    } catch (error) {
        console.error('[Backup] ❌ Error:', error.message);
        throw error;
    }
}

function cleanOldBackups() {
    console.log('[Backup] Limpiando backups antiguos...');
    
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
        .map(f => ({
            name: f,
            path: path.join(BACKUP_DIR, f),
            time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Más reciente primero
    
    // Mantener solo los últimos RETENTION_DAYS backups
    const toDelete = files.slice(RETENTION_DAYS);
    
    for (const file of toDelete) {
        try {
            fs.unlinkSync(file.path);
            console.log(`[Backup] Eliminado: ${file.name}`);
        } catch (e) {
            console.error(`[Backup] Error eliminando ${file.name}:`, e.message);
        }
    }
    
    console.log(`[Backup] Retenidos ${Math.min(files.length, RETENTION_DAYS)} backups`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
    createBackup()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { createBackup, cleanOldBackups };
