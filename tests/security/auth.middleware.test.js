jest.mock('jsonwebtoken', () => ({
    verify: jest.fn()
}));

jest.mock('../../models/User', () => ({
    findById: jest.fn()
}));

const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { protect } = require('../../middleware/auth');

const buildRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('middleware/auth.protect', () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    let consoleErrorSpy;

    beforeEach(() => {
        process.env.JWT_SECRET = 'test_jwt_secret_1234567890';
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    afterAll(() => {
        process.env.JWT_SECRET = originalJwtSecret;
    });

    test('retorna 401 cuando falta token', async () => {
        const req = { headers: {} };
        const res = buildRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('No autorizado')
        }));
        expect(next).not.toHaveBeenCalled();
    });

    test('retorna 500 cuando JWT_SECRET no está configurado', async () => {
        delete process.env.JWT_SECRET;
        const req = { headers: { authorization: 'Bearer token-demo' } };
        const res = buildRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Error de configuración del servidor'
        }));
        expect(next).not.toHaveBeenCalled();
    });

    test('inyecta req.user y llama next con token válido', async () => {
        const req = { headers: { authorization: 'Bearer token-demo' } };
        const res = buildRes();
        const next = jest.fn();

        jwt.verify.mockReturnValue({ id: '507f1f77bcf86cd799439011', iat: Math.floor(Date.now() / 1000) });

        const user = {
            _id: '507f1f77bcf86cd799439011',
            role: 'admin',
            activo: true,
            changedPasswordAfter: jest.fn().mockReturnValue(false)
        };

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(user)
        });

        await protect(req, res, next);

        expect(req.user).toBe(user);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});
