jest.mock('../../models/Paciente', () => ({
    findById: jest.fn()
}));

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Paciente = require('../../models/Paciente');
const Factura = require('../../models/Factura');
const ContadorFactura = mongoose.models.ContadorFactura || mongoose.model('ContadorFactura');

// Registrar modelo Paciente para mongoose.model('Paciente') usado en hooks de Factura
const pacienteSchemaForHook = new mongoose.Schema({
    nombre: String,
    apellido: String
}, { strict: false });

if (!mongoose.models.Paciente) {
    mongoose.model('Paciente', pacienteSchemaForHook);
}

describe('Factura paciente password hash', () => {
    beforeEach(() => {
        jest.spyOn(ContadorFactura, 'findByIdAndUpdate').mockResolvedValue({ seq: 123 });
        jest.spyOn(mongoose.models.Paciente, 'findById').mockImplementation(Paciente.findById);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('genera pacientePasswordHash para factura nueva', async () => {
        Paciente.findById.mockResolvedValue({
            nombre: 'Juan',
            apellido: 'Pérez'
        });

        const factura = new Factura({
            paciente: new mongoose.Types.ObjectId(),
            subtotal: 100,
            total: 100
        });

        await factura.validate();

        expect(factura.pacientePassword).toBeTruthy();
        expect(factura.pacientePasswordHash).toBeTruthy();
        expect(factura.pacientePasswordHash).not.toBe(factura.pacientePassword);

        const ok = await bcrypt.compare(factura.pacientePassword, factura.pacientePasswordHash);
        expect(ok).toBe(true);
    });

    test('comparePassword usa hash cuando existe', async () => {
        const plain = 'apellido';
        const hash = await bcrypt.hash(plain, 12);

        const factura = new Factura({
            paciente: new mongoose.Types.ObjectId(),
            subtotal: 50,
            total: 50,
            pacientePasswordHash: hash,
            pacientePassword: 'valor_legacy_ignorado'
        });

        await expect(factura.comparePassword('apellido')).resolves.toBe(true);
        await expect(factura.comparePassword('otra')).resolves.toBe(false);
    });
});
