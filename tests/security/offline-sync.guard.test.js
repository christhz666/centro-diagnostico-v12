const fs = require('fs');
const path = require('path');

describe('offline sync guard contract', () => {
    test('route exige header x-offline-sync-key y OFFLINE_SYNC_KEY', () => {
        const adminRoutePath = path.join(__dirname, '../../routes/admin.js');
        const code = fs.readFileSync(adminRoutePath, 'utf8');

        expect(code).toContain("process.env.OFFLINE_SYNC_KEY");
        expect(code).toContain("req.headers['x-offline-sync-key']");
        expect(code).toContain('crypto.timingSafeEqual');
        expect(code).toContain("'/usuarios/offline-sync'");
    });
});
