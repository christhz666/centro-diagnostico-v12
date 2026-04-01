const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 7+ no necesita estas opciones, pero por compatibilidad:
        });

        console.log(`✅ MongoDB conectado: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

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
