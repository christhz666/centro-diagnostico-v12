/**
 * Migra facturas legacy para crear pacientePasswordHash cuando falta.
 *
 * Uso:
 *   node scripts/migrateFacturaPasswordHash.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Factura = require('../models/Factura');

dotenv.config();

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI no está configurado');
    }

    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB');

    const filter = {
        pacientePassword: { $exists: true, $ne: null, $ne: '' },
        $or: [
            { pacientePasswordHash: { $exists: false } },
            { pacientePasswordHash: null },
            { pacientePasswordHash: '' }
        ]
    };

    const total = await Factura.countDocuments(filter);
    console.log(`🔎 Facturas legacy a migrar: ${total}`);

    if (total === 0) {
        console.log('✅ No hay facturas pendientes de migración');
        await mongoose.disconnect();
        return;
    }

    const cursor = Factura.find(filter).cursor();
    let processed = 0;

    for await (const factura of cursor) {
        // Dispara hook pre-save que genera pacientePasswordHash
        await factura.save({ validateBeforeSave: false });
        processed += 1;

        if (processed % 100 === 0) {
            console.log(`⏳ Migradas ${processed}/${total}`);
        }
    }

    console.log(`✅ Migración completada. Total migradas: ${processed}`);
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('❌ Error en migración:', err.message);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
