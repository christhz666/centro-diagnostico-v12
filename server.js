const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const os = require('os');
const mongoose = require('mongoose');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const logger = require('./utils/logger');

// Cargar variables de entorno
dotenv.config();

// Importar conexión DB
const connectDB = require('./config/db');

// Importar middleware de errores
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Inicializar Express
const app = express();
app.use(compression()); // Comprimir respuestas
app.set('trust proxy', 1);

// Ruta raíz - Página de bienvenida HTML
app.get('/', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Centro Diagnóstico MI ESPERANZA - API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            max-width: 600px;
            width: 100%;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            padding: 32px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .content { padding: 32px; }
        .status {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
        }
        .status.connected { background: #d1fae5; color: #065f46; }
        .status.disconnected { background: #fef3c7; color: #92400e; }
        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .status.connected .status-dot { background: #10b981; }
        .status.disconnected .status-dot { background: #f59e0b; }
        .links { display: flex; flex-direction: column; gap: 12px; }
        .link {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            background: #f8fafc;
            border-radius: 8px;
            text-decoration: none;
            color: #1e293b;
            transition: all 0.2s;
        }
        .link:hover { background: #e2e8f0; transform: translateX(4px); }
        .link-title { font-weight: 600; }
        .link-desc { font-size: 13px; color: #64748b; margin-top: 4px; }
        .arrow { color: #94a3b8; font-size: 20px; }
        .footer {
            padding: 16px 32px;
            background: #f8fafc;
            text-align: center;
            font-size: 13px;
            color: #64748b;
        }
        .version { 
            display: inline-block;
            background: #e2e8f0;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Centro Diagnostico MI ESPERANZA</h1>
            <p>Sistema de Gestion de Laboratorio Clinico</p>
        </div>
        <div class="content">
            <div class="status ${dbConnected ? 'connected' : 'disconnected'}">
                <div class="status-dot"></div>
                <div>
                    <strong>Base de datos: ${dbConnected ? 'Conectada' : 'No conectada'}</strong>
                    <p style="font-size: 13px; margin-top: 4px;">
                        ${dbConnected ? 'MongoDB funcionando correctamente' : 'Configura MONGODB_URI para habilitar todas las funciones'}
                    </p>
                </div>
            </div>
            <div class="links">
                <a href="/api/docs" class="link">
                    <div>
                        <div class="link-title">Documentacion API (Swagger)</div>
                        <div class="link-desc">Explora todos los endpoints disponibles</div>
                    </div>
                    <span class="arrow">→</span>
                </a>
                <a href="/api/health" class="link">
                    <div>
                        <div class="link-title">Estado del Servidor</div>
                        <div class="link-desc">Verifica el estado de salud de la API</div>
                    </div>
                    <span class="arrow">→</span>
                </a>
            </div>
        </div>
        <div class="footer">
            API REST v1.0.0 | ${new Date().toLocaleDateString('es-ES')}
            <div class="version">Servidor activo en puerto ${process.env.PORT || 5000}</div>
        </div>
    </div>
</body>
</html>`;
    res.type('html').send(html);
});

const getLocalIps = () => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    Object.values(interfaces).forEach((ifaces) => {
        (ifaces || []).forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
        });
    });
    return [...new Set(ips)];
};

const parseCorsOrigins = () => {
    let origins = [];
    if (!process.env.CORS_ORIGINS) {
        origins = [
            'http://localhost:3000',
            'http://localhost:5000',
            process.env.FRONTEND_URL
        ].filter(Boolean);
    } else {
        origins = process.env.CORS_ORIGINS
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }
    
    // Siempe permitir las aplicaciones nativas de escritorio (Tauri)
    origins.push('http://tauri.localhost');
    origins.push('tauri://localhost');
    
    return origins;
};

const isOrthancEnabledByEnv = () => {
    const mode = String(process.env.DICOM_MODE || 'none').trim().toLowerCase();
    return mode === 'orthanc';
};

const isOrthancEnabledByDb = async () => {
    try {
        const Configuracion = require('./models/Configuracion');
        const cfgDoc = await Configuracion.findOne({ clave: 'ris_config' }).lean();
        if (!cfgDoc || !cfgDoc.valor) return false;

        const parsed = JSON.parse(cfgDoc.valor);
        return Boolean(parsed?.orthanc?.habilitado);
    } catch {
        return false;
    }
};

const corsOrigins = parseCorsOrigins();

// ==========================================
// MIDDLEWARE DE SEGURIDAD
// ==========================================

// Helmet - headers de seguridad con CSP configurado
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'same-origin' }
}));

// Rate limiting - prevenir ataques de fuerza bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: Number(process.env.RATE_LIMIT_MAX || 2500),
    message: {
        success: false,
        message: 'Demasiadas peticiones desde esta IP. Intente en 15 minutos.'
    }
});
app.use('/api/', limiter);

// Rate limit estricto para login (previene fuerza bruta)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 100),
    message: {
        success: false,
        message: 'Demasiados intentos de login. Intente en 15 minutos.'
    }
});
app.use('/api/auth/login', loginLimiter);

// ==========================================
// MIDDLEWARE GENERAL
// ==========================================

app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-sucursal-id', 'x-offline-sync-key', 'x-equipo-api-key', 'x-api-key']
}));

// Input sanitization - prevenir NoSQL injection y XSS
app.use(mongoSanitize());
app.use(xss());

// Body parser - límites reducidos para seguridad
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging con Winston (rotación automática)
app.use(require('morgan')('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// Archivos estáticos - uploads protegidos con autenticación
const { protect } = require('./middleware/auth');
app.use('/uploads', protect, express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/imagenes', protect, express.static(path.join(__dirname, 'uploads', 'imagenes')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ==========================================
// RUTAS DE LA API
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    const dbStates = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    res.json({
        success: true,
        message: 'Centro Diagnóstico - API funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        host: process.env.HOST || '0.0.0.0',
        port: Number(process.env.PORT || 5000),
        public_url: process.env.PUBLIC_API_URL || null,
        local_ips: getLocalIps(),
        cors_origins: corsOrigins,
        database: {
            state: mongoose.connection.readyState,
            status: dbStates[mongoose.connection.readyState] || 'unknown',
            name: mongoose.connection.name || null
        }
    });
});

// Rutas principales
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/citas', require('./routes/citas'));
app.use('/api/ordenes', require('./routes/citas'));
app.use('/api/estudios', require('./routes/estudios'));
app.use('/api/resultados', require('./routes/resultados'));
app.use('/api/facturas', require('./routes/facturas'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reportes', require('./routes/dashboard'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/sucursales', require('./routes/sucursales'));
app.use('/api/caja', require('./routes/turnosCaja'));
app.use('/api/equipos', require('./routes/equipoRoutes'));
app.use('/api/barcodes', require('./routes/poolBarcodes'));
app.use('/api/contabilidad', require('./routes/contabilidad'));
app.use('/api/configuracion', require('./routes/configuracion'));
const deployRoutes = require('./routes/deploy');
app.use('/api/deploy', deployRoutes);
app.use('/api/downloads', require('./routes/downloads')); // No requiere autenticación
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/auditoria', require('./routes/auditoria'));
app.use('/api/imagenologia', require('./routes/imagenologia'));
app.use('/api/orthanc', require('./routes/orthanc')); // Proxy DICOM
app.use("/api/verificar", require("./routes/verificar"));
app.use("/verificar", require("./routes/verificar")); // Backward compatibility

// Documentación Swagger/OpenAPI
const { swaggerUi, specs } = require('./config/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));

// Visor de imágenes médicas (acceso directo por URL)
app.get('/visor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'visor-imagenes.html'));
});

// ==========================================
// SERVIR FRONTEND (React build)
// ==========================================

const frontendBuild = path.join(__dirname, 'frontend', 'build');
const fs = require('fs');

if (fs.existsSync(frontendBuild)) {
    app.use(express.static(frontendBuild));

    app.get('*', (req, res, next) => {
        if (req.originalUrl.startsWith('/api')) {
            return next();
        }

        return res.sendFile(path.join(frontendBuild, 'index.html'));
    });
}

// ==========================================
// MANEJO DE ERRORES
// ==========================================

app.use(notFound);
app.use(errorHandler);

// ==========================================
// INICIAR SERVIDOR
// ==========================================

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const autoStartEquipos = /^(1|true|yes|on)$/i.test(String(process.env.EQUIPOS_AUTO_START || 'false'));

const startServer = async () => {
    try {
        const requiredEnv = ['JWT_SECRET'];
        const missing = requiredEnv.filter((key) => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
        }

        // Intentar conectar a MongoDB, pero no fallar si no está disponible en desarrollo
        if (process.env.MONGODB_URI && process.env.MONGODB_URI !== 'mongodb://localhost:27017/centro_diagnostico') {
            try {
                await connectDB();
            } catch (dbError) {
                console.error('⚠️ No se pudo conectar a MongoDB:', dbError.message);
                console.log('ℹ️ El servidor continuará pero las funciones de base de datos no estarán disponibles.');
            }
        } else {
            console.log('ℹ️ MongoDB no configurado. Ejecutando en modo demo/documentación.');
            console.log('ℹ️ Para usar todas las funciones, configura MONGODB_URI con MongoDB Atlas o una instancia local.');
        }

        const server = app.listen(PORT, HOST, () => {
            const ips = getLocalIps();
            console.log('');
            console.log('+---------------------------------------------------+');
            console.log('¦  Centro Diagnóstico - API Server                 ¦');
            console.log(`¦  Host/Puerto: ${HOST}:${PORT}`);
            if (process.env.PUBLIC_API_URL) {
                console.log(`¦  Public API: ${process.env.PUBLIC_API_URL}`);
            }
            console.log(`¦  Local IPs: ${ips.join(', ') || 'N/A'}`);
            console.log(`¦  CORS: ${corsOrigins.join(', ') || 'N/A'}`);
            console.log('+---------------------------------------------------+');
            console.log('');
        });

        // Iniciar servicio de equipos (opcional por variable de entorno)
        // Para arquitectura con agentes remotos, mantener DESACTIVADO en servidor.
        if (autoStartEquipos) {
            const equipoService = require('./services/equipoService');
            setTimeout(() => {
                equipoService.iniciarTodos()
                    .then(() => console.log('✅ Servicio de equipos iniciado'))
                    .catch(err => console.error('⚠️ Error iniciando equipos:', err.message));
            }, 3000);
        } else {
            console.log('ℹ️ Auto-inicio de equipos deshabilitado en servidor (EQUIPOS_AUTO_START=false)');
        }

        // Iniciar polling de Orthanc SOLO cuando esté habilitado
        const shouldStartOrthancPolling = isOrthancEnabledByEnv() || await isOrthancEnabledByDb();
        if (shouldStartOrthancPolling) {
            const orthancService = require('./services/orthancService');
            setTimeout(() => {
                console.log('🔄 Iniciando sincronización en background con Servidor Orthanc...');
                setInterval(() => {
                    orthancService.sincronizarImagenesListas().catch(e => console.error(e));
                }, 30000); // Polling cada 30 segundos
            }, 5000);
        } else {
            console.log('ℹ️ Polling de Orthanc deshabilitado (DICOM_MODE!=orthanc y ris_config.orthanc.habilitado=false).');
        }

        // Graceful shutdown
        const shutdown = (signal) => {
            console.log(`${signal} recibido. Cerrando servidor...`);
            server.close(() => {
                console.log('Servidor HTTP cerrado.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        console.error('Error fatal al iniciar:', error.message);
        process.exit(1);
    }
};

startServer();

process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION:', err.message);
    if (err.stack) logger.error(err.stack);
});

process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION:', err.message);
    if (err.stack) logger.error(err.stack);
    process.exit(1);
});

module.exports = app;
