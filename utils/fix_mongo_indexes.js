const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function fix() {
    try {
        await mongoose.connect('mongodb://localhost:27017/centro_diagnostico');
        console.log('MongoDB conectado');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const hasUsers = collections.some(c => c.name === 'users');

        if (hasUsers) {
            try {
                await db.collection('users').dropIndex('email_1');
                console.log('Índice email_1 eliminado.');
            } catch (e) {
                console.log('Índice email_1 no existía o ya eliminado:', e.message);
            }
            try {
                await db.collection('users').dropIndex('username_1');
                console.log('Índice username_1 eliminado.');
            } catch (e) {
                console.log('Índice username_1 no existía o ya eliminado:', e.message);
            }

            // Eliminar usuarios corruptos con null/vacío
            await db.collection('users').deleteMany({ email: null });
            await db.collection('users').deleteMany({ email: "null" });
            await db.collection('users').deleteMany({ username: null });
            await db.collection('users').deleteMany({ username: "null" });
            console.log('Usuarios con null limpiados.');
        }

        console.log('Sincronizando índices limpios...');
        const User = require('../models/User');
        await User.syncIndexes();
        console.log('Índices sincronizados (ahora son sparse: true).');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
fix();
