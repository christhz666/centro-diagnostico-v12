#!/usr/bin/env node

/**
 * Prepara .env para producción REAL (sin valores de demo para secretos críticos).
 *
 * Qué hace:
 * - Genera JWT_SECRET si falta o está en placeholder inseguro
 * - Genera OFFLINE_SYNC_KEY si falta o está en placeholder inseguro
 * - Asegura defaults productivos básicos si faltan
 *
 * NO pisa credenciales externas reales (email/twilio/orthanc), solo advierte.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');

const PLACEHOLDER_REGEX = /(CAMBIAR|CHANGE_ME|REEMPLAZAR|TU_|tu_|xxxxxxxx|example|placeholder)/i;

function mask(value = '') {
    if (!value) return '(vacío)';
    if (value.length <= 8) return '********';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function generateSecretHex(bytes = 64) {
    return crypto.randomBytes(bytes).toString('hex');
}

function parseEnv(content) {
    const lines = content.split(/\r?\n/);
    const indexByKey = new Map();

    lines.forEach((line, index) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match) {
            indexByKey.set(match[1], index);
        }
    });

    const get = (key) => {
        const idx = indexByKey.get(key);
        if (idx == null) return undefined;
        const line = lines[idx] || '';
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) return undefined;
        return match[2];
    };

    const set = (key, value) => {
        const idx = indexByKey.get(key);
        const nextLine = `${key}=${value}`;
        if (idx == null) {
            lines.push(nextLine);
            indexByKey.set(key, lines.length - 1);
        } else {
            lines[idx] = nextLine;
        }
    };

    return {
        lines,
        get,
        set,
        toString: () => lines.join('\n')
    };
}

function isMissingOrInsecure(value) {
    if (value == null) return true;
    const v = String(value).trim();
    if (!v) return true;
    if (PLACEHOLDER_REGEX.test(v)) return true;
    if (v.length < 32) return true;
    return false;
}

function isExternalCredentialPlaceholder(value) {
    if (value == null) return true;
    const v = String(value).trim();
    if (!v) return true;
    return PLACEHOLDER_REGEX.test(v);
}

function main() {
    let baseContent = '';
    if (fs.existsSync(envPath)) {
        baseContent = fs.readFileSync(envPath, 'utf8');
    } else if (fs.existsSync(envExamplePath)) {
        baseContent = fs.readFileSync(envExamplePath, 'utf8');
    }

    const env = parseEnv(baseContent);
    const changes = [];
    const warnings = [];

    // Ajustes productivos base
    if (!env.get('NODE_ENV')) {
        env.set('NODE_ENV', 'production');
        changes.push('NODE_ENV=production (agregado)');
    }

    if (!env.get('JWT_EXPIRES_IN')) {
        env.set('JWT_EXPIRES_IN', '24h');
        changes.push('JWT_EXPIRES_IN=24h (agregado)');
    }

    if (!env.get('RATE_LIMIT_MAX')) {
        env.set('RATE_LIMIT_MAX', '500');
        changes.push('RATE_LIMIT_MAX=500 (agregado)');
    }

    if (!env.get('RATE_LIMIT_LOGIN_MAX')) {
        env.set('RATE_LIMIT_LOGIN_MAX', '20');
        changes.push('RATE_LIMIT_LOGIN_MAX=20 (agregado)');
    }

    // Secretos críticos del backend
    const currentJwt = env.get('JWT_SECRET');
    if (isMissingOrInsecure(currentJwt)) {
        const jwt = generateSecretHex(64);
        env.set('JWT_SECRET', jwt);
        changes.push(`JWT_SECRET generado (${mask(jwt)})`);
    }

    const currentOffline = env.get('OFFLINE_SYNC_KEY');
    if (isMissingOrInsecure(currentOffline)) {
        const offline = generateSecretHex(64);
        env.set('OFFLINE_SYNC_KEY', offline);
        changes.push(`OFFLINE_SYNC_KEY generado (${mask(offline)})`);
    }

    // Warnings de integraciones externas (no se pueden inventar en producción real)
    const externalKeys = [
        'EMAIL_USER',
        'EMAIL_PASS',
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'ORTHANC_USER',
        'ORTHANC_PASS'
    ];

    externalKeys.forEach((key) => {
        const v = env.get(key);
        if (isExternalCredentialPlaceholder(v)) {
            warnings.push(`${key} sigue en placeholder o vacío; requiere credencial REAL del proveedor.`);
        }
    });

    fs.writeFileSync(envPath, env.toString(), 'utf8');

    console.log('✅ .env actualizado para producción (secretos críticos listos).');
    if (changes.length) {
        console.log('Cambios aplicados:');
        changes.forEach((c) => console.log(` - ${c}`));
    } else {
        console.log('No hubo cambios: ya estaba correctamente configurado en secretos críticos.');
    }

    if (warnings.length) {
        console.log('\n⚠️ Pendientes manuales (integraciones externas):');
        warnings.forEach((w) => console.log(` - ${w}`));
    }
}

main();
