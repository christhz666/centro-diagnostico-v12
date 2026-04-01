#!/usr/bin/env node

/**
 * Release Gate automatizado
 *
 * Ejecuta, en orden:
 * 1) Tests automáticos (Jest)
 * 2) Health check del API
 * 3) Validación de offline-sync (401/401/200)
 *
 * Salidas:
 * - Texto (humana)
 * - JSON machine-readable
 * - Outputs para GitHub Actions (si GITHUB_OUTPUT está presente)
 *
 * Variables opcionales:
 * - RELEASE_GATE_HOST (default: 127.0.0.1)
 * - RELEASE_GATE_PORT (default: 5055)
 * - RELEASE_GATE_BASE_URL (si se define, ignora host/port)
 * - RELEASE_GATE_USE_EXISTING_SERVER=true (no levanta server.js)
 * - RELEASE_GATE_VERBOSE=true (muestra logs del server temporal)
 * - RELEASE_GATE_OUTPUT_FORMAT=text|json|both (default: both)
 * - RELEASE_GATE_OUTPUT_PATH=./release-gate-report.json
 * - RELEASE_GATE_JWT_SECRET=... (override para el gate)
 * - RELEASE_GATE_OFFLINE_SYNC_KEY=... (override para el gate)
 * - RELEASE_GATE_ALLOW_EPHEMERAL_KEY=true|false (default: true cuando NO usa server existente)
 * - RELEASE_GATE_ALLOW_EPHEMERAL_JWT=true|false (default: true cuando NO usa server existente)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const dotenv = require('dotenv');

const projectRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const GATE_HOST = process.env.RELEASE_GATE_HOST || '127.0.0.1';
const GATE_PORT = Number(process.env.RELEASE_GATE_PORT || 5055);
const BASE_URL = process.env.RELEASE_GATE_BASE_URL || `http://${GATE_HOST}:${GATE_PORT}`;
const USE_EXISTING_SERVER = String(process.env.RELEASE_GATE_USE_EXISTING_SERVER || 'false') === 'true';
const VERBOSE = String(process.env.RELEASE_GATE_VERBOSE || 'false') === 'true';

const OUTPUT_FORMAT = String(process.env.RELEASE_GATE_OUTPUT_FORMAT || 'both').toLowerCase(); // text|json|both
const OUTPUT_PATH = process.env.RELEASE_GATE_OUTPUT_PATH
    ? path.resolve(projectRoot, process.env.RELEASE_GATE_OUTPUT_PATH)
    : path.join(projectRoot, 'release-gate-report.json');

const EXIT_CODES = {
    PASS: 0,
    CONFIG_JWT_FAIL: 10,
    CONFIG_FAIL: 11,
    TESTS_FAIL: 21,
    HEALTH_FAIL: 31,
    OFFLINE_NO_HEADER_FAIL: 41,
    OFFLINE_BAD_KEY_FAIL: 42,
    OFFLINE_GOOD_KEY_FAIL: 43,
    UNKNOWN_FAIL: 99
};

const STAGE_CODES = {
    CONFIG_JWT_PASS: 'RG_CONFIG_JWT_SECRET_RESOLVED',
    CONFIG_JWT_FAIL: 'RG_CONFIG_JWT_SECRET_MISSING',

    CONFIG_KEY_PASS: 'RG_CONFIG_OFFLINE_KEY_RESOLVED',
    CONFIG_KEY_FAIL: 'RG_CONFIG_OFFLINE_KEY_MISSING',

    TESTS_PASS: 'RG_TESTS_PASS',
    TESTS_FAIL: 'RG_TESTS_FAIL',

    HEALTH_PASS: 'RG_HEALTH_PASS',
    HEALTH_FAIL: 'RG_HEALTH_FAIL',

    OFFLINE_NO_HEADER_PASS: 'RG_OFFLINE_NO_HEADER_401_PASS',
    OFFLINE_NO_HEADER_FAIL: 'RG_OFFLINE_NO_HEADER_401_FAIL',

    OFFLINE_BAD_KEY_PASS: 'RG_OFFLINE_BAD_KEY_401_PASS',
    OFFLINE_BAD_KEY_FAIL: 'RG_OFFLINE_BAD_KEY_401_FAIL',

    OFFLINE_GOOD_KEY_PASS: 'RG_OFFLINE_GOOD_KEY_200_PASS',
    OFFLINE_GOOD_KEY_FAIL: 'RG_OFFLINE_GOOD_KEY_200_FAIL'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const showText = OUTPUT_FORMAT === 'text' || OUTPUT_FORMAT === 'both';
const writeJson = OUTPUT_FORMAT === 'json' || OUTPUT_FORMAT === 'both';

function logText(message) {
    if (showText) {
        console.log(message);
    }
}

function logStep(step, msg) {
    logText(`\n[${step}] ${msg}`);
}

function maskSecret(secret = '') {
    if (!secret) return null;
    if (secret.length <= 8) return '****';
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function createReport() {
    return {
        started_at: new Date().toISOString(),
        finished_at: null,
        status: 'running',
        base_url: BASE_URL,
        use_existing_server: USE_EXISTING_SERVER,
        output_format: OUTPUT_FORMAT,
        output_path: OUTPUT_PATH,
        config: {
            host: GATE_HOST,
            port: GATE_PORT,
            jwt_secret_source: null,
            jwt_secret_masked: null,
            jwt_secret_ephemeral: false,
            offline_sync_key_source: null,
            offline_sync_key_masked: null,
            offline_sync_ephemeral: false
        },
        stages: [],
        summary: {
            total: 0,
            passed: 0,
            failed: 0,
            failed_stage_id: null,
            failed_stage_code: null,
            exit_code: null
        }
    };
}

function pushStage(report, stage) {
    report.stages.push(stage);
    report.summary.total = report.stages.length;
    report.summary.passed = report.stages.filter((s) => s.status === 'passed').length;
    report.summary.failed = report.stages.filter((s) => s.status === 'failed').length;
}

async function runStage(report, opts, fn) {
    const started = Date.now();
    try {
        const meta = await fn();
        const stage = {
            id: opts.id,
            name: opts.name,
            status: 'passed',
            code: opts.passCode,
            exit_code: 0,
            duration_ms: Date.now() - started,
            ...meta
        };
        pushStage(report, stage);
        return stage;
    } catch (error) {
        const meta = error && error.meta && typeof error.meta === 'object' ? error.meta : {};
        const stage = {
            id: opts.id,
            name: opts.name,
            status: 'failed',
            code: opts.failCode,
            exit_code: opts.failExitCode,
            duration_ms: Date.now() - started,
            error: error.message,
            ...meta
        };
        pushStage(report, stage);
        const wrapped = new Error(error.message);
        wrapped.stage = stage;
        throw wrapped;
    }
}

function writeReport(report) {
    if (!writeJson) return;
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
    if (showText) {
        console.log(`\n[report] JSON guardado en: ${OUTPUT_PATH}`);
    }
}

function writeGithubOutputs(report) {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (!outputFile) return;

    const lines = [
        `release_gate_status=${report.status}`,
        `release_gate_exit_code=${report.summary.exit_code ?? EXIT_CODES.UNKNOWN_FAIL}`,
        `release_gate_failed_stage_id=${report.summary.failed_stage_id || ''}`,
        `release_gate_failed_stage_code=${report.summary.failed_stage_code || ''}`,
        `release_gate_report_path=${OUTPUT_PATH}`
    ];

    fs.appendFileSync(outputFile, `${lines.join('\n')}\n`, 'utf8');
}

function runCommand(command, args, stepName) {
    logStep(stepName, `${command} ${args.join(' ')}`);
    let result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
        shell: false
    });

    // Fallback para Windows cuando el ejecutable es .cmd/.bat
    if (result.error && isWindows) {
        const cmdLine = `${command} ${args.join(' ')}`;
        result = spawnSync('cmd.exe', ['/d', '/s', '/c', cmdLine], {
            cwd: projectRoot,
            stdio: 'inherit',
            env: process.env,
            shell: false
        });
    }

    const rawStatus = result.status;
    const signal = result.signal || null;
    const resolvedStatus = rawStatus == null ? (signal ? 1 : 0) : rawStatus;

    if (resolvedStatus !== 0) {
        const err = new Error(`${stepName} falló con código ${resolvedStatus}`);
        err.meta = {
            command: `${command} ${args.join(' ')}`,
            process_exit_status: resolvedStatus,
            process_raw_status: rawStatus,
            process_signal: signal
        };
        throw err;
    }

    return {
        command: `${command} ${args.join(' ')}`,
        process_exit_status: resolvedStatus,
        process_raw_status: rawStatus,
        process_signal: signal
    };
}

async function fetchStatus(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response.status;
    } finally {
        clearTimeout(timeout);
    }
}

async function waitForHealth(url, timeoutMs = 45000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const status = await fetchStatus(url);
            if (status === 200) {
                return true;
            }
        } catch (_) {
            // servidor aún iniciando
        }
        await sleep(1000);
    }
    return false;
}

function createServerProcess() {
    const env = {
        ...process.env,
        HOST: GATE_HOST,
        PORT: String(GATE_PORT)
    };

    const server = spawn(process.execPath, ['server.js'], {
        cwd: projectRoot,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    server.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        if (VERBOSE) process.stdout.write(`[server] ${text}`);
    });

    server.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        if (VERBOSE) process.stderr.write(`[server:err] ${text}`);
    });

    return {
        server,
        getLogs: () => ({ stdout, stderr })
    };
}

async function stopServerProcess(serverCtx) {
    if (!serverCtx || !serverCtx.server || serverCtx.server.killed) return;

    const child = serverCtx.server;
    await new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };

        child.once('exit', finish);

        try {
            child.kill();
        } catch (_) {
            finish();
            return;
        }

        setTimeout(() => {
            if (!done) {
                try {
                    child.kill('SIGKILL');
                } catch (_) {}
                finish();
            }
        }, 3000);
    });
}

function resolveOfflineSyncKey() {
    const overrideKey = process.env.RELEASE_GATE_OFFLINE_SYNC_KEY;
    if (overrideKey) {
        process.env.OFFLINE_SYNC_KEY = overrideKey;
        return { key: overrideKey, source: 'RELEASE_GATE_OFFLINE_SYNC_KEY', ephemeral: false };
    }

    if (process.env.OFFLINE_SYNC_KEY) {
        return { key: process.env.OFFLINE_SYNC_KEY, source: 'OFFLINE_SYNC_KEY', ephemeral: false };
    }

    const allowEphemeralDefault = USE_EXISTING_SERVER ? 'false' : 'true';
    const allowEphemeral = String(process.env.RELEASE_GATE_ALLOW_EPHEMERAL_KEY || allowEphemeralDefault) === 'true';

    if (allowEphemeral && !USE_EXISTING_SERVER) {
        const generated = crypto.randomBytes(32).toString('hex');
        process.env.OFFLINE_SYNC_KEY = generated;
        return { key: generated, source: 'generated_ephemeral', ephemeral: true };
    }

    throw new Error(
        'OFFLINE_SYNC_KEY no está configurada. ' +
        'Defínela en .env o usa RELEASE_GATE_OFFLINE_SYNC_KEY=... (si usas RELEASE_GATE_USE_EXISTING_SERVER=true es obligatoria).'
    );
}

function resolveJwtSecret() {
    const overrideJwt = process.env.RELEASE_GATE_JWT_SECRET;
    if (overrideJwt) {
        process.env.JWT_SECRET = overrideJwt;
        return { key: overrideJwt, source: 'RELEASE_GATE_JWT_SECRET', ephemeral: false };
    }

    if (process.env.JWT_SECRET) {
        return { key: process.env.JWT_SECRET, source: 'JWT_SECRET', ephemeral: false };
    }

    const allowEphemeralDefault = USE_EXISTING_SERVER ? 'false' : 'true';
    const allowEphemeral = String(process.env.RELEASE_GATE_ALLOW_EPHEMERAL_JWT || allowEphemeralDefault) === 'true';

    if (allowEphemeral && !USE_EXISTING_SERVER) {
        const generated = crypto.randomBytes(48).toString('hex');
        process.env.JWT_SECRET = generated;
        return { key: generated, source: 'generated_ephemeral', ephemeral: true };
    }

    throw new Error(
        'JWT_SECRET no está configurado. ' +
        'Defínelo en .env o usa RELEASE_GATE_JWT_SECRET=... (si usas RELEASE_GATE_USE_EXISTING_SERVER=true es obligatoria).'
    );
}

async function expectHttpStatus(url, expectedStatus, headers = null) {
    let actualStatus;
    try {
        actualStatus = await fetchStatus(url, headers ? { headers } : {});
    } catch (error) {
        const err = new Error(`No se pudo obtener respuesta HTTP desde ${url}`);
        err.meta = {
            url,
            expected_status: expectedStatus,
            actual_status: null
        };
        throw err;
    }

    if (actualStatus !== expectedStatus) {
        const err = new Error(`Esperaba HTTP ${expectedStatus}, recibí ${actualStatus}`);
        err.meta = {
            url,
            expected_status: expectedStatus,
            actual_status: actualStatus
        };
        throw err;
    }

    return {
        url,
        expected_status: expectedStatus,
        actual_status: actualStatus
    };
}

async function main() {
    const report = createReport();
    let serverCtx = null;
    let finalExitCode = EXIT_CODES.PASS;

    try {
        const jwtMeta = await runStage(
            report,
            {
                id: 'config.jwt-secret',
                name: 'Resolver JWT_SECRET para validación',
                passCode: STAGE_CODES.CONFIG_JWT_PASS,
                failCode: STAGE_CODES.CONFIG_JWT_FAIL,
                failExitCode: EXIT_CODES.CONFIG_JWT_FAIL
            },
            async () => {
                const resolved = resolveJwtSecret();
                return {
                    jwt_secret_source: resolved.source,
                    jwt_secret_ephemeral: resolved.ephemeral,
                    jwt_secret_masked: maskSecret(resolved.key)
                };
            }
        );

        report.config.jwt_secret_source = jwtMeta.jwt_secret_source;
        report.config.jwt_secret_ephemeral = Boolean(jwtMeta.jwt_secret_ephemeral);
        report.config.jwt_secret_masked = jwtMeta.jwt_secret_masked;

        const keyMeta = await runStage(
            report,
            {
                id: 'config.offline-key',
                name: 'Resolver OFFLINE_SYNC_KEY para validación',
                passCode: STAGE_CODES.CONFIG_KEY_PASS,
                failCode: STAGE_CODES.CONFIG_KEY_FAIL,
                failExitCode: EXIT_CODES.CONFIG_FAIL
            },
            async () => {
                const resolved = resolveOfflineSyncKey();
                return {
                    offline_sync_key_source: resolved.source,
                    offline_sync_key_ephemeral: resolved.ephemeral,
                    offline_sync_key_masked: maskSecret(resolved.key)
                };
            }
        );

        report.config.offline_sync_key_source = keyMeta.offline_sync_key_source;
        report.config.offline_sync_ephemeral = Boolean(keyMeta.offline_sync_key_ephemeral);
        report.config.offline_sync_key_masked = keyMeta.offline_sync_key_masked;

        await runStage(
            report,
            {
                id: 'tests.jest',
                name: 'Ejecutar tests automáticos',
                passCode: STAGE_CODES.TESTS_PASS,
                failCode: STAGE_CODES.TESTS_FAIL,
                failExitCode: EXIT_CODES.TESTS_FAIL
            },
            async () => runCommand(npmCmd, ['test', '--', '--runInBand', '--ci'], '1) Tests')
        );

        if (!USE_EXISTING_SERVER) {
            logStep('2)', `Levantando servidor temporal en ${BASE_URL}`);
            serverCtx = createServerProcess();
        } else {
            logStep('2)', `Usando servidor existente en ${BASE_URL}`);
        }

        await runStage(
            report,
            {
                id: 'health.api',
                name: 'Validar /api/health = 200',
                passCode: STAGE_CODES.HEALTH_PASS,
                failCode: STAGE_CODES.HEALTH_FAIL,
                failExitCode: EXIT_CODES.HEALTH_FAIL
            },
            async () => {
                const ok = await waitForHealth(`${BASE_URL}/api/health`);
                if (!ok) {
                    const logs = serverCtx ? serverCtx.getLogs() : { stdout: '', stderr: '' };
                    const err = new Error('Health check no respondió 200 en tiempo esperado');
                    err.meta = {
                        health_url: `${BASE_URL}/api/health`,
                        server_stdout_tail: logs.stdout.slice(-2000),
                        server_stderr_tail: logs.stderr.slice(-2000)
                    };
                    throw err;
                }

                return {
                    health_url: `${BASE_URL}/api/health`,
                    actual_status: 200
                };
            }
        );

        const endpoint = `${BASE_URL}/api/admin/usuarios/offline-sync`;

        await runStage(
            report,
            {
                id: 'offline-sync.no-header',
                name: 'Offline sync sin header => 401',
                passCode: STAGE_CODES.OFFLINE_NO_HEADER_PASS,
                failCode: STAGE_CODES.OFFLINE_NO_HEADER_FAIL,
                failExitCode: EXIT_CODES.OFFLINE_NO_HEADER_FAIL
            },
            async () => expectHttpStatus(endpoint, 401)
        );

        await runStage(
            report,
            {
                id: 'offline-sync.bad-key',
                name: 'Offline sync con key inválida => 401',
                passCode: STAGE_CODES.OFFLINE_BAD_KEY_PASS,
                failCode: STAGE_CODES.OFFLINE_BAD_KEY_FAIL,
                failExitCode: EXIT_CODES.OFFLINE_BAD_KEY_FAIL
            },
            async () => expectHttpStatus(endpoint, 401, { 'x-offline-sync-key': 'invalid_release_gate_key' })
        );

        await runStage(
            report,
            {
                id: 'offline-sync.good-key',
                name: 'Offline sync con key válida => 200',
                passCode: STAGE_CODES.OFFLINE_GOOD_KEY_PASS,
                failCode: STAGE_CODES.OFFLINE_GOOD_KEY_FAIL,
                failExitCode: EXIT_CODES.OFFLINE_GOOD_KEY_FAIL
            },
            async () => expectHttpStatus(endpoint, 200, { 'x-offline-sync-key': process.env.OFFLINE_SYNC_KEY })
        );

        report.status = 'passed';
        report.finished_at = new Date().toISOString();
        report.summary.exit_code = EXIT_CODES.PASS;

        logText('\n✅ RELEASE GATE PASSED');
        logText('   - Tests: OK');
        logText('   - Health: OK');
        logText('   - Offline sync guard: 401 / 401 / 200');
    } catch (error) {
        const failedStage = error.stage || null;
        finalExitCode = failedStage?.exit_code || EXIT_CODES.UNKNOWN_FAIL;

        report.status = 'failed';
        report.finished_at = new Date().toISOString();
        report.summary.exit_code = finalExitCode;
        report.summary.failed_stage_id = failedStage?.id || null;
        report.summary.failed_stage_code = failedStage?.code || null;

        logText(`\n❌ RELEASE GATE FAILED: ${error.message}`);
        if (failedStage) {
            logText(`   - failed_stage_id: ${failedStage.id}`);
            logText(`   - failed_stage_code: ${failedStage.code}`);
            logText(`   - stage_exit_code: ${failedStage.exit_code}`);
        }
    } finally {
        await stopServerProcess(serverCtx);

        if (!report.finished_at) {
            report.finished_at = new Date().toISOString();
        }
        if (report.status === 'running') {
            report.status = 'failed';
        }
        if (report.summary.exit_code == null) {
            report.summary.exit_code = finalExitCode;
        }

        writeReport(report);
        writeGithubOutputs(report);

        // Si el formato es solo JSON, emitimos JSON compacto en stdout para pipes
        if (OUTPUT_FORMAT === 'json') {
            process.stdout.write(`${JSON.stringify(report)}\n`);
        }

        process.exitCode = report.summary.exit_code;
    }
}

main().catch((error) => {
    console.error(`\n❌ RELEASE GATE FAILED (UNCAUGHT): ${error.message}`);
    process.exitCode = EXIT_CODES.UNKNOWN_FAIL;
});
