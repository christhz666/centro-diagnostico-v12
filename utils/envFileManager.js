const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');

function parseEnv(content) {
    const lines = content.split(/\r?\n/);
    const indexByKey = new Map();

    lines.forEach((line, index) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match) {
            indexByKey.set(match[1], index);
        }
    });

    const set = (key, value) => {
        const line = `${key}=${value}`;
        if (indexByKey.has(key)) {
            lines[indexByKey.get(key)] = line;
            return;
        }
        lines.push(line);
        indexByKey.set(key, lines.length - 1);
    };

    return {
        set,
        toString: () => lines.join('\n')
    };
}

function readBaseEnvContent() {
    if (fs.existsSync(envPath)) return fs.readFileSync(envPath, 'utf8');
    if (fs.existsSync(envExamplePath)) return fs.readFileSync(envExamplePath, 'utf8');
    return '';
}

function setEnvVariables(pairs = {}) {
    if (!pairs || typeof pairs !== 'object') {
        throw new Error('setEnvVariables requiere un objeto de pares clave/valor');
    }

    const content = readBaseEnvContent();
    const env = parseEnv(content);

    Object.entries(pairs).forEach(([key, value]) => {
        if (!key || typeof key !== 'string') return;
        if (value === undefined || value === null) return;

        const normalized = String(value).replace(/\r?\n/g, ' ').trim();
        env.set(key, normalized);
    });

    fs.writeFileSync(envPath, env.toString(), 'utf8');
}

module.exports = {
    setEnvVariables
};
