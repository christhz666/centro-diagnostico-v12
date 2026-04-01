const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Formato personalizado
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
);

// Transport para consola (solo en desarrollo)
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
    )
});

// Transport rotativo para archivos de log
const fileTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../logs/application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d', // Mantener logs por 14 días
    format: customFormat
});

// Transport separado para errores
const errorTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d', // Errores se mantienen por 30 días
    level: 'error',
    format: customFormat
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'centro-diagnostico-api' },
    transports: [
        fileTransport,
        errorTransport,
        ...(process.env.NODE_ENV !== 'production' ? [consoleTransport] : [])
    ],
    exceptionHandlers: [
        new DailyRotateFile({
            filename: path.join(__dirname, '../logs/exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d'
        })
    ],
    rejectionHandlers: [
        new DailyRotateFile({
            filename: path.join(__dirname, '../logs/rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d'
        })
    ]
});

module.exports = logger;
