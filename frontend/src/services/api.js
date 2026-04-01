// Detección robusta de entorno Tauri — funciona en dev y en producción
const isTauri = Boolean(
  window.__TAURI_INTERNALS__ ||
  window.__TAURI__ ||
  window.location.protocol === 'tauri:' ||
  window.location.hostname === 'tauri.localhost'
);
// REACT_APP_API_URL se inyecta en compilación para builds de escritorio
// Si no está definido, la detección de Tauri aplica como fallback
const API_URL = process.env.REACT_APP_API_URL || '/api';
const VERSION = '1.1.5-PREMIUM';

// ── Interceptor global de fetch ──────────────────────────────────────────────
// Redirige cualquier petición a /api/... hacia la URL absoluta del VPS
// cuando la app corre dentro de Tauri (desktop). Esto soluciona todos los
// componentes que usan fetch('/api/...') nativo sin modificarlos individualmente.
if (isTauri || process.env.REACT_APP_API_URL) {
  const _originalFetch = window.fetch.bind(window);
  const VPS_BASE = (process.env.REACT_APP_API_URL || '/api')
    .replace(/\/api$/, ''); // quitar /api al final para tener solo la base
  window.fetch = (input, init) => {
    let url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = VPS_BASE + url;
      input = typeof input === 'string' ? url : new Request(url, input);
    }
    return _originalFetch(input, init);
  };
}


class ApiService {
    getToken() { return localStorage.getItem('token') || sessionStorage.getItem('token'); }

    getStoredUser() { return localStorage.getItem('user') || sessionStorage.getItem('user'); }

    clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        try {
            let token = this.getToken();
            if (token && token !== 'undefined' && token !== 'null' && typeof token === 'string') {
                headers['Authorization'] = 'Bearer ' + token.trim();
            }

            // Inyectar sucursalId si existe
            const userStr = this.getStoredUser();
            if (userStr && userStr !== 'undefined' && userStr !== 'null') {
                const user = JSON.parse(userStr);
                if (user && user.sucursal) {
                    headers['x-sucursal-id'] = user.sucursal;
                }
            }
        } catch (e) {
            console.error(`[API ${VERSION}] Headers Error:`, e);
        }

        return headers;
    }

    async request(endpoint, options = {}) {
        const url = API_URL + endpoint;
        const headers = this.getHeaders();
        const config = { headers, ...options };

        console.log(`[API ${VERSION}] Request: ${endpoint}`, {
            method: options.method || 'GET',
            hasAuth: !!headers['Authorization'],
            tokenLength: headers['Authorization'] ? headers['Authorization'].length : 0
        });

        let response;
        try {
            response = await fetch(url, config);
        } catch (fetchError) {
            console.error(`[API ${VERSION}] Network Error for ${endpoint}:`, fetchError);
            throw new Error('Error de conexión a la red');
        }

        if (response.status === 401) {
            let detail = 'Desconocido';
            try {
                const errData = await response.json();
                detail = errData.message || errData.mensaje || JSON.stringify(errData);
            } catch (e) { detail = 'No se pudo leer el cuerpo del error 401'; }

            console.error(`[API ${VERSION}] 401 UNAUTHORIZED for ${endpoint}:`, { detail });

            this.clearSession();
            window.dispatchEvent(new CustomEvent('session-expired', { detail: { reason: detail } }));
            throw new Error(`Sesión expirada: ${detail}`);
        }

        let raw;
        try {
            raw = await response.json();
        } catch (e) {
            if (!response.ok) throw new Error('Error ' + response.status);
            return null;
        }

        if (!response.ok) {
            const error = new Error(raw.message || raw.error || raw.mensaje || 'Error ' + response.status);
            error.response = { data: raw, status: response.status };
            throw error;
        }

        // Normalización de respuestas del NUEVO backend v8
        // El nuevo backend usa: { success: true, data: {...} }
        if (raw && typeof raw === 'object') {
            if (raw.success && raw.data !== undefined) {
                if (options.noUnwrap) return raw.data;
                const d = raw.data;
                if (d && typeof d === 'object' && !Array.isArray(d)) {
                    if (Array.isArray(d.pacientes)) return d.pacientes;
                    if (Array.isArray(d.citas)) return d.citas;
                    if (Array.isArray(d.resultados)) return d.resultados;
                    if (Array.isArray(d.facturas)) return d.facturas;
                    if (Array.isArray(d.estudios)) return d.estudios;
                    if (Array.isArray(d.usuarios)) return d.usuarios;
                    if (Array.isArray(d.movimientos)) return d.movimientos;
                }
                return d;
            }
            // Respuestas legacy directas
            if ('facturas' in raw && Array.isArray(raw.facturas)) return raw.facturas;
            if ('pacientes' in raw && Array.isArray(raw.pacientes)) return raw.pacientes;
            if ('resultados' in raw && Array.isArray(raw.resultados)) return raw.resultados;
            if ('ordenes' in raw && Array.isArray(raw.ordenes)) return raw.ordenes;
            if ('estudios' in raw && Array.isArray(raw.estudios)) return raw.estudios;
            if ('usuarios' in raw && Array.isArray(raw.usuarios)) return raw.usuarios;
            if ('citas' in raw && Array.isArray(raw.citas)) return raw.citas;
            if ('paciente' in raw && raw.paciente) return raw.paciente;
            if ('cita' in raw && raw.cita) return raw.cita;
            if ('resultado' in raw && raw.resultado) return raw.resultado;
            if ('factura' in raw && raw.factura) return raw.factura;
            if ('estudio' in raw && raw.estudio) return raw.estudio;
            if ('usuario' in raw && raw.usuario) return raw.usuario;
        }
        return raw;
    }

    // AUTH
    async login(credentials) {
        console.log(`[API ${VERSION}] Attempting login...`);
        const body = {
            username: credentials.username || credentials.email,
            email: credentials.username || credentials.email,
            password: credentials.password
        };

        try {
            const response = await fetch(API_URL + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.message || data.error || data.mensaje || `Error ${response.status}`;
                throw new Error(errorMsg);
            }

            const token = data.token || data.access_token || data.data?.token || data.data?.access_token;
            const user = data.usuario || data.user || data.data?.usuario || data.data?.user;

            if (token && typeof token === 'string' && token !== 'undefined') {
                return { ...data, user, token };
            } else {
                console.error(`[API ${VERSION}] Login failed: Valid token not found in response`, data);
                throw new Error('Token no válido en la respuesta del servidor');
            }
        } catch (err) {
            console.error(`[API ${VERSION}] Login Catch:`, err);
            throw err;
        }
    }

    forceLogin(user, token, persist = true) {
        console.log(`[API ${VERSION}] Sync Session (persist: ${persist})...`);
        const storage = persist ? localStorage : sessionStorage;
        if (token) storage.setItem('token', token);
        if (user) storage.setItem('user', JSON.stringify(user));

        // Si no se persiste, limpiar el otro storage para evitar conflictos
        if (!persist) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        } else {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
        }
    }

    logout() {
        this.clearSession();
        window.location.href = '/';
    }

    isAuthenticated() { return !!this.getToken(); }

    getUser() {
        const u = this.getStoredUser();
        try { return u ? JSON.parse(u) : null; } catch { return null; }
    }

    async getMe() { return this.request('/auth/me'); }
    async updateProfile(data) { return this.request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }); }
    async changePassword(currentPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    // DASHBOARD
    async getDashboardStats() {
        return this.request('/dashboard/stats');
    }

    async getNotificaciones() {
        return this.request('/dashboard/notificaciones');
    }

    async getCitasHoy() {
        const data = await this.request('/citas/hoy');
        if (Array.isArray(data)) return data;
        return data.data || data.citas || [];
    }

    async getCitasGrafica() { return this.request('/dashboard/citas-grafica'); }
    async getTopEstudios() { return this.request('/dashboard/top-estudios'); }

    // PACIENTES
    async getPacientes(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/pacientes/?' + query);
    }
    async getPaciente(id) { return this.request('/pacientes/' + id); }
    async getPacienteByCedula(ced) { return this.request('/pacientes/cedula/' + ced); }
    async createPaciente(data) { return this.request('/pacientes', { method: 'POST', body: JSON.stringify(data) }); }
    async updatePaciente(id, data) { return this.request('/pacientes/' + id, { method: 'PUT', body: JSON.stringify(data) }); }
    async deletePaciente(id) { return this.request('/pacientes/' + id, { method: 'DELETE' }); }
    async getHistorialPaciente(id) { return this.request('/pacientes/' + id + '/historial'); }
    async buscarHistorialPaciente(q) { 
        const res = await this.getPacientes({ search: q });
        return { pacientes: res?.data || res || [] };
    }

    // ESTUDIOS
    async getEstudios(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/estudios/?' + query);
    }
    async getEstudio(id) { return this.request('/estudios/' + id); }
    async getCategorias() { return this.request('/estudios/categorias'); }
    async createEstudio(data) { return this.request('/estudios', { method: 'POST', body: JSON.stringify(data) }); }
    async updateEstudio(id, d) { return this.request('/estudios/' + id, { method: 'PUT', body: JSON.stringify(d) }); }
    async deleteEstudio(id) { return this.request('/estudios/' + id, { method: 'DELETE' }); }

    // CITAS / ORDENES
    async getCitas(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/citas/?' + query);
    }
    async getCita(id) { return this.request('/citas/' + id); }
    async getOrden(id) { return this.request('/citas/' + id); }

    async createCita(data) {
        const ordenData = {
            paciente: data.paciente,
            fecha: data.fecha || new Date().toISOString().split('T')[0],
            horaInicio: data.horaInicio || new Date().toTimeString().split(' ')[0].substring(0, 5),
            medico_referente: data.medico_referente || '',
            estado: data.estado || 'programada',
            metodoPago: data.metodoPago || 'pendiente',
            subtotal: data.subtotal || 0,
            descuentoTotal: data.descuentoTotal || 0,
            total: data.total || 0,
            pagado: data.pagado || false,
            seguroAplicado: data.seguroAplicado,
            estudios: (data.estudios || []).map(e => ({
                estudio: e.estudio || e.id || e._id,
                precio: e.precio || 0,
                descuento: e.descuento || 0
            }))
        };
        return this.request('/citas/', { method: 'POST', body: JSON.stringify(ordenData) });
    }

    async updateCita(id, data) {
        return this.request('/citas/' + id, { method: 'PUT', body: JSON.stringify(data) });
    }

    async cambiarEstadoCita(id, estado, notas) {
        return this.request('/citas/' + id + '/estado', {
            method: 'PATCH',
            body: JSON.stringify({ estado, notas })
        });
    }

    async buscarRegistroPorIdOCodigo(registroId) {
        return this.request('/citas/registro/' + encodeURIComponent(registroId));
    }

    async buscarHistorialPaciente(query) {
        return this.request('/citas/busqueda/paciente?query=' + encodeURIComponent(query), { noUnwrap: true });
    }

    // FACTURAS
    async getFacturas(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/facturas/?' + query);
    }
    async getResumenFacturas() { return this.request('/facturas/resumen'); }
    async getFactura(id) { return this.request('/facturas/' + id); }

    async createFactura(data) {
        if (data.items && data.items.length > 0 && !data.cita) {
            return this.request('/facturas', { method: 'POST', body: JSON.stringify(data) });
        }
        if (data.cita || data.orden_id) {
            const ordenId = data.cita || data.orden_id;
            try {
                const facturaResp = await this.request('/facturas/crear-desde-orden/' + ordenId, {
                    method: 'POST',
                    body: JSON.stringify({
                        tipo_comprobante: 'B02',
                        forma_pago: data.metodoPago || 'efectivo',
                        descuento_global: data.descuento || 0,
                        incluir_itbis: false
                    })
                });
                const factura = (facturaResp && facturaResp.factura) ? facturaResp.factura : facturaResp;
                const montoPagado = data.montoPagado || 0;
                if (montoPagado > 0 && factura && (factura._id || factura.id)) {
                    try {
                        await this.request('/facturas/' + (factura._id || factura.id) + '/pagar', {
                            method: 'POST',
                            body: JSON.stringify({ monto: montoPagado, metodo_pago: data.metodoPago || 'efectivo' })
                        });
                    } catch (e) { console.error('Error registrando pago:', e); }
                }
                return factura;
            } catch (e) {
                console.warn('crear-desde-orden falló, intentando POST directo:', e.message);
            }
        }
        return this.request('/facturas', { method: 'POST', body: JSON.stringify(data) });
    }

    // CAJAS (Turnos de facturación diaria)
    async getTurnoActivo() { return this.request('/caja/activa'); }
    async abrirTurnoCaja() { return this.request('/caja/abrir', { method: 'POST' }); }
    async cerrarTurnoCaja(id) { return this.request('/caja/cerrar', { method: 'POST' }); }

    async anularFactura(id, motivo) {
        return this.request('/facturas/' + id + '/anular', {
            method: 'PATCH', body: JSON.stringify({ motivo })
        });
    }

    async pagarFactura(id, monto, metodoPago) {
        return this.request('/facturas/' + id + '/pagar', {
            method: 'POST', body: JSON.stringify({ monto, metodo_pago: metodoPago })
        });
    }

    // RESULTADOS
    async getResultados(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/resultados/?' + query);
    }
    async getResultado(id) { return this.request('/resultados/' + id); }
    async getResultadosPorPaciente(pid) { return this.request('/resultados/paciente/' + pid); }
    async getResultadoPorCodigoMuestra(c) { return this.request('/resultados/muestra/' + c); }
    async getResultadosPorFactura(num) { return this.request('/resultados/factura/' + num); }
    async createResultado(data) { return this.request('/resultados', { method: 'POST', body: JSON.stringify(data) }); }
    async updateResultado(id, data) { return this.request('/resultados/' + id, { method: 'PUT', body: JSON.stringify(data) }); }
    async actualizarResultado(id, data) { return this.updateResultado(id, data); }
    async validarResultado(id, data) {
        return this.request('/resultados/' + id + '/validar', {
            method: 'PATCH', body: JSON.stringify(data)
        });
    }
    async firmarResultado(id, data = {}) {
        return this.request('/resultados/' + id + '/firma', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // IMAGENOLOGÍA
    async getImagenologiaLista(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/imagenologia/lista?' + query);
    }
    async getImagenologiaWorkspace(rid) { return this.request('/imagenologia/workspace/' + rid); }
    async updateImagenologiaWorkspace(rid, d) {
        return this.request('/imagenologia/workspace/' + rid, { method: 'PUT', body: JSON.stringify(d) });
    }
    async getImagenologiaPlantillas() { return this.request('/imagenologia/plantillas'); }
    async finalizarReporteImagenologia(rid) {
        return this.request('/imagenologia/reporte/' + rid + '/finalizar', { method: 'POST' });
    }
    async getWorklistDicom(citaId) { return this.request('/imagenologia/worklist/' + citaId); }

    // ADMIN / USUARIOS
    async getUsuarios(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/admin/usuarios?' + query);
    }
    async getUsuario(id) { return this.request('/admin/usuarios/' + id); }
    async getMedicos() { return this.request('/admin/medicos'); }
    async getRoles() { return this.request('/admin/roles'); }
    async createUsuario(data) {
        const d = { ...data, role: data.role || data.rol || 'recepcion' };
        // No enviar email/username/apellido vacíos o "null" - evita errores de validación
        if (!d.email || d.email === 'null' || String(d.email).trim() === '') delete d.email;
        if (!d.username || d.username === 'null' || String(d.username).trim() === '') delete d.username;
        if (!d.apellido || String(d.apellido).trim() === '') delete d.apellido;
        return this.request('/admin/usuarios', { method: 'POST', body: JSON.stringify(d) });
    }
    async updateUsuario(id, data) {
        const d = { ...data, role: data.role || data.rol };
        return this.request('/admin/usuarios/' + id, { method: 'PUT', body: JSON.stringify(d) });
    }
    async toggleUsuario(id) {
        return this.request('/admin/usuarios/' + id + '/toggle', { method: 'PATCH' });
    }
    async resetPasswordUsuario(id, newPassword) {
        return this.request('/admin/usuarios/' + id + '/reset-password', {
            method: 'PATCH', body: JSON.stringify({ newPassword })
        });
    }

    // EQUIPOS
    async getEquipos() { return this.request('/equipos'); }
    async createEquipo(data) { return this.request('/equipos', { method: 'POST', body: JSON.stringify(data) }); }
    async updateEquipo(id, d) { return this.request('/equipos/' + id, { method: 'PUT', body: JSON.stringify(d) }); }
    async deleteEquipo(id) { return this.request('/equipos/' + id, { method: 'DELETE' }); }

    // CONTABILIDAD
    async getMovimientosContables(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('/contabilidad?' + query);
    }
    async createMovimientoContable(data) { return this.request('/contabilidad', { method: 'POST', body: JSON.stringify(data) }); }
    async getResumenContable() { return this.request('/contabilidad/resumen'); }
    async getFlujoCaja() { return this.request('/contabilidad/flujo-caja'); }
    async deleteMovimientoContable(id) { return this.request('/contabilidad/' + id, { method: 'DELETE' }); }

    // CONFIGURACIÓN
    async getConfiguracion() { return this.request('/configuracion/'); }
    async updateConfiguracion(data) { return this.request('/configuracion/', { method: 'PUT', body: JSON.stringify(data) }); }
    async getEmpresaInfo() { return this.request('/configuracion/empresa'); }
    async getEmpresaConfig() { return this.request('/configuracion/empresa'); }

    // DEPLOY
    async escanearRed() { return this.request('/deploy/scan'); }
    async getAgentesInstalados() { return this.request('/deploy/agents'); }
    async deployAgente(ip, hostname) { return this.request('/deploy/install', { method: 'POST', body: JSON.stringify({ ip, hostname }) }); }
    async verificarAgenteEstado(ip) { return this.request('/deploy/status/' + ip); }

    // WHATSAPP
    async getWhatsappEstadisticas() { return this.request('/whatsapp/estadisticas'); }
    async enviarCampanaWhatsApp(data) { return this.request('/whatsapp/campana', { method: 'POST', body: JSON.stringify(data) }); }
    async getWhatsappCredenciales() { return this.request('/whatsapp/credenciales'); }
    async updateWhatsappCredenciales(data) { return this.request('/whatsapp/credenciales', { method: 'POST', body: JSON.stringify(data) }); }

    // HEALTH
    async healthCheck() { return this.request('/health'); }
}

const api = new ApiService();
export default api;
