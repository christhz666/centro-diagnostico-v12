const mongoose = require('mongoose');

const isMongoAuthError = (error) => {
    const msg = String(error?.message || '').toLowerCase();
    return (
        msg.includes('requires authentication') ||
        msg.includes('authentication failed') ||
        msg.includes('not authorized') ||
        msg.includes('auth failed') ||
        msg.includes('scram')
    );
};

const verifyAppReadPermissions = async () => {
    const Configuracion = require('../models/Configuracion');
    // Debe poder leer configuración pública; si falla por auth, la app no funcionará.
    await Configuracion.findOne({ clave: 'empresa_nombre' }).lean();
};

const isStrictMongoStartupCheckEnabled = () => {
    return /^(1|true|yes|on)$/i.test(String(process.env.MONGODB_STRICT_STARTUP_CHECK || 'false'));
};

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 7+ no necesita estas opciones, pero por compatibilidad:
        });

        console.log(`✅ MongoDB conectado: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

        // Verificación de permisos mínimos de la app para fallar rápido en producción
        try {
            await verifyAppReadPermissions();
            console.log('✅ Verificación de permisos MongoDB OK (lectura de configuración)');
        } catch (permError) {
            if (isMongoAuthError(permError)) {
                const strictStartup = isStrictMongoStartupCheckEnabled();
                console.error('❌ MongoDB autenticó conexión pero no tiene permisos suficientes para consultas de la app.');
                console.error('   Revisá MONGODB_URI (usuario/clave/db/authSource) y roles del usuario en la base de datos objetivo.');

                if (strictStartup) {
                    console.error('🛑 MONGODB_STRICT_STARTUP_CHECK=true, abortando arranque por error de permisos MongoDB.');
                    throw permError;
                }

                console.warn('⚠️  MONGODB_STRICT_STARTUP_CHECK=false, continuando arranque para evitar downtime.');
                console.warn('⚠️  Algunas rutas que consultan Mongo pueden fallar hasta corregir credenciales/permisos.');
                return conn;
            }
            // Otros errores (ej. colección vacía/no inicializada) no deben tumbar el arranque.
            console.warn(`⚠️  Verificación de permisos MongoDB omitida: ${permError.message}`);
        }

        // Asegurar que los índices unique de email y username sean sparse
        // (documentos sin email/username no deben causar duplicado null)
        void (async () => {
            try {
                const User = require('../models/User');
                const indexes = await User.collection.indexes();
                const nonSparseUnique = indexes.filter(idx =>
                    idx.key && (idx.key.email !== undefined || idx.key.username !== undefined) &&
                    idx.unique && !idx.sparse
                );
                for (const idx of nonSparseUnique) {
                    await User.collection.dropIndex(idx.name);
                    console.log(`✅ Índice no-sparse eliminado para recrear como sparse: ${idx.name}`);
                }
                if (nonSparseUnique.length > 0) {
                    await User.ensureIndexes();
                    console.log('✅ Índices de usuario recreados con sparse:true');
                }
            } catch (e) {
                console.warn(`⚠️  Verificación de índices de usuario: ${e.message}`);
            }
        })();
        
        // Eventos de conexión
        mongoose.connection.on('error', (err) => {
            console.error(`❌ Error de MongoDB: ${err.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB desconectado');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconectado');
        });

        return conn;
    } catch (error) {
        console.error(`❌ Error conectando a MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
