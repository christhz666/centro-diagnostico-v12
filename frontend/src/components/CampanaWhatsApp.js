import React, { useState, useEffect } from 'react';
import { FaWhatsapp, FaPaperPlane, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import api from '../services/api';

const theme = {
  surface: 'var(--legacy-surface)',
  surfaceMuted: 'var(--legacy-surface-muted)',
  panel: 'var(--legacy-surface-panel)',
  border: 'var(--legacy-border)',
  borderSoft: 'var(--legacy-border-soft)',
  text: 'var(--legacy-text)',
  textStrong: 'var(--legacy-text-strong)',
  textMuted: 'var(--legacy-text-muted)'
};

const CampanaWhatsApp = () => {
  // Estado para credenciales
  const [credenciales, setCredenciales] = useState({
    twilio: { accountSid: '', authToken: '', from: '' },
    meta: { phoneNumberId: '', accessToken: '' }
  });
  const [credencialesMsg, setCredencialesMsg] = useState('');
  const [mostrarCredenciales, setMostrarCredenciales] = useState(false);
  const [credencialesStatus, setCredencialesStatus] = useState(null);
  const [whatsappMode, setWhatsappMode] = useState('twilio');
  // Eliminado: lógica de rol/esAdmin. El botón y formulario serán visibles para todos.
    // Cargar estado actual de credenciales (sin exponer secretos)
    useEffect(() => {
      const cargarCredenciales = async () => {
        try {
          const resp = await api.getWhatsappCredenciales();
          const data = resp?.data || resp;

          if (data) {
            setCredencialesStatus(data);
            setWhatsappMode(data?.mode || 'twilio');
            setCredenciales(prev => ({
              twilio: {
                accountSid: '',
                authToken: '',
                from: data?.twilio?.from || prev.twilio.from
              },
              meta: {
                phoneNumberId: '',
                accessToken: ''
              }
            }));
          }
        } catch (e) {
          // no-op
        }
      };

      cargarCredenciales();
    }, []);

    const handleCredencialesChange = (e) => {
      const { name, value, dataset } = e.target;
      setCredenciales(prev => ({
        ...prev,
        [dataset.tipo]: {
          ...prev[dataset.tipo],
          [name]: value
        }
      }));
    };

    const guardarCredenciales = async (e) => {
      e.preventDefault();
      setCredencialesMsg('');
      try {
        const payload = {
          mode: whatsappMode,
          twilio: credenciales.twilio,
          meta: credenciales.meta
        };

        const d = await api.updateWhatsappCredenciales(payload);
        if (d.success) {
          setCredencialesMsg('Credenciales actualizadas y guardadas permanentemente en .env');
          setCredencialesStatus(d.data || null);
          setCredenciales(prev => ({
            twilio: { ...prev.twilio, accountSid: '', authToken: '' },
            meta: { ...prev.meta, phoneNumberId: '', accessToken: '' }
          }));
        } else {
          setCredencialesMsg(d.error || d.message || 'Error al actualizar credenciales');
        }
      } catch (e) {
        setCredencialesMsg('Error de conexión: ' + e.message);
      }
    };
  const [mensaje, setMensaje] = useState('Hola {nombre}, 👋\n\n🏥 *Centro Diagnóstico* le recuerda que tenemos:\n\n✅ [Describa su oferta aquí]\n\n📞 Llámenos al [TELÉFONO] o visítenos.\n\n¡Gracias por su preferencia!');
  const [segmento, setSegmento] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    cargarStats();
  }, []);

  const cargarStats = async () => {
    try {
      const r = await fetch('/api/whatsapp/estadisticas', {
        headers: api.getHeaders()
      });
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch (e) {}
  };

  const verPreview = async () => {
    try {
      setLoading(true);
      const r = await fetch(`/api/whatsapp/preview?segmento=${segmento}&limit=3`, {
        headers: api.getHeaders()
      });
      const d = await r.json();
      if (d.success) setPreview(d.data);
    } catch (e) {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const enviarCampana = async () => {
    if (!mensaje.trim() || mensaje.length < 10) {
      alert('El mensaje es muy corto');
      return;
    }
    if (!window.confirm(`¿Enviar campaña a ${preview?.total || 'todos los'} pacientes?`)) return;
    
    setLoading(true);
    setResultado(null);
    try {
      const r = await fetch('/api/whatsapp/campana', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ mensaje, segmento })
      });
      const d = await r.json();
      setResultado(d);
    } catch (e) {
      setResultado({ success: false, message: 'Error de conexión: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const colorWA = '#25D366';

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, color: theme.textStrong, marginBottom: 5 }}>
        <FaWhatsapp style={{ color: colorWA }} /> Campañas de WhatsApp
      </h2>
      <p style={{ color: theme.textMuted, marginBottom: 25 }}>Envíe promociones y ofertas a su base de datos de pacientes</p>

      {/* Estadísticas */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, marginBottom: 25 }}>
          {[
            { label: 'Total Pacientes', value: stats.total, color: '#3498db' },
          { label: 'Con Teléfono', value: stats.conTelefono, color: colorWA },
          { label: 'Sin Teléfono', value: stats.sinTelefono, color: '#e74c3c' }
          ].map(s => (
            <div key={s.label} style={{ background: theme.surface, borderRadius: 12, padding: 20, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderTop: `4px solid ${s.color}`, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 30, fontWeight: 'bold', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: theme.textMuted }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Panel izquierdo: configurar */}
        <div style={{ background: theme.surface, borderRadius: 15, padding: 25, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', border: `1px solid ${theme.border}` }}>
                      {/* Botón y formulario de credenciales */}
                    <>
                        <button onClick={() => setMostrarCredenciales(v => !v)} style={{ marginBottom: 15, background: theme.surfaceMuted, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                          {mostrarCredenciales ? 'Ocultar' : 'Configurar credenciales WhatsApp'}
                        </button>
                        {mostrarCredenciales && (
                          <form onSubmit={guardarCredenciales} style={{ background: theme.surfaceMuted, borderRadius: 10, padding: 15, marginBottom: 15, border: `1px solid ${theme.border}` }}>
                            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: theme.surface, border: `1px solid ${theme.border}` }}>
                              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}><strong>Estado actual (persistido en .env)</strong></div>
                              <div style={{ fontSize: 12, color: theme.text }}>
                                Modo: <strong>{credencialesStatus?.mode || 'twilio'}</strong>
                              </div>
                              <div style={{ fontSize: 12, color: theme.text }}>
                                Twilio: <strong>{credencialesStatus?.twilio?.configured ? 'Configurado' : 'Incompleto'}</strong>
                              </div>
                              <div style={{ fontSize: 12, color: theme.text }}>
                                Meta: <strong>{credencialesStatus?.meta?.configured ? 'Configurado' : 'Incompleto'}</strong>
                              </div>
                            </div>

                            <h4 style={{ margin: '0 0 10px', color: theme.textStrong }}>Credenciales Twilio</h4>
                            <select
                              name="mode"
                              value={whatsappMode}
                              onChange={(e) => setWhatsappMode(e.target.value)}
                              style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }}
                            >
                              <option value="twilio">twilio</option>
                              <option value="meta">meta</option>
                            </select>
                            <input name="accountSid" data-tipo="twilio" placeholder={credencialesStatus?.twilio?.accountSidMasked ? `Actual: ${credencialesStatus.twilio.accountSidMasked}` : 'Account SID'} value={credenciales.twilio.accountSid} onChange={handleCredencialesChange} style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }} />
                            <input name="authToken" data-tipo="twilio" placeholder={credencialesStatus?.twilio?.authTokenMasked ? `Actual: ${credencialesStatus.twilio.authTokenMasked}` : 'Auth Token'} value={credenciales.twilio.authToken} onChange={handleCredencialesChange} style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }} />
                            <input name="from" data-tipo="twilio" placeholder="WhatsApp From (ej: whatsapp:+14155238886)" value={credenciales.twilio.from} onChange={handleCredencialesChange} style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }} />
                            <h4 style={{ margin: '10px 0 10px', color: theme.textStrong }}>Credenciales Meta WhatsApp</h4>
                            <input name="phoneNumberId" data-tipo="meta" placeholder={credencialesStatus?.meta?.phoneNumberIdMasked ? `Actual: ${credencialesStatus.meta.phoneNumberIdMasked}` : 'Phone Number ID'} value={credenciales.meta.phoneNumberId} onChange={handleCredencialesChange} style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }} />
                            <input name="accessToken" data-tipo="meta" placeholder={credencialesStatus?.meta?.accessTokenMasked ? `Actual: ${credencialesStatus.meta.accessTokenMasked}` : 'Access Token'} value={credenciales.meta.accessToken} onChange={handleCredencialesChange} style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }} />
                            <button type="submit" style={{ background: colorWA, color: 'white', border: 'none', borderRadius: 8, padding: 10, fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>Guardar Credenciales</button>
                            {credencialesMsg && <div style={{ marginTop: 10, color: credencialesMsg.includes('correctamente') ? 'green' : 'red', fontSize: 13 }}>{credencialesMsg}</div>}
                          </form>
                        )}
                      </>
          <h3 style={{ margin: '0 0 20px', color: theme.textStrong }}>⚙️ Configurar Campaña</h3>
          
          <div style={{ marginBottom: 15 }}>
            <label style={{ fontSize: 13, color: theme.text, marginBottom: 6, display: 'block', fontWeight: 'bold' }}>Segmento de Destinatarios</label>
            <select value={segmento} onChange={e => setSegmento(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text }}>
              <option value="todos">🌐 Todos los pacientes</option>
              <option value="con_seguro">🏥 Pacientes con seguro</option>
              <option value="sin_seguro">👤 Pacientes sin seguro</option>
            </select>
          </div>

          <div style={{ marginBottom: 15 }}>
            <label style={{ fontSize: 13, color: theme.text, marginBottom: 6, display: 'block', fontWeight: 'bold' }}>Mensaje</label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={10}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 13, boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical', background: theme.surface, color: theme.text }}
            />
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 5 }}>
              Variables: <code style={{ background: theme.surfaceMuted, padding: '2px 4px', borderRadius: 3 }}>{'{nombre}'}</code>, <code style={{ background: theme.surfaceMuted, padding: '2px 4px', borderRadius: 3 }}>{'{apellido}'}</code>, <code style={{ background: theme.surfaceMuted, padding: '2px 4px', borderRadius: 3 }}>{'{nombreCompleto}'}</code>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={verPreview} disabled={loading} style={{ flex: 1, padding: '10px', background: theme.surfaceMuted, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 'bold' }}>
              <FaEye /> Preview
            </button>
            <button onClick={enviarCampana} disabled={loading} style={{ flex: 2, padding: '10px', background: colorWA, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 'bold' }}>
              {loading ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> : <FaPaperPlane />}
              Enviar Campaña
            </button>
          </div>
        </div>

        {/* Panel derecho: preview / resultado */}
        <div>
          {/* Preview */}
          {preview && (
            <div style={{ background: theme.surface, borderRadius: 15, padding: 25, marginBottom: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', border: `1px solid ${theme.border}` }}>
              <h4 style={{ margin: '0 0 15px', color: '#27ae60' }}>👥 {preview.total} destinatarios</h4>
              {preview.muestra.map((p, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${theme.borderSoft}`, fontSize: 13 }}>
                  <strong>{p.nombre} {p.apellido}</strong><br />
                  <span style={{ color: theme.textMuted }}>📱 {p.telefono}</span>
                </div>
              ))}
              {preview.total > preview.muestra.length && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 10 }}>y {preview.total - preview.muestra.length} más...</div>
              )}
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div style={{ background: resultado.success ? '#d4edda' : '#f8d7da', borderRadius: 15, padding: 25, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
              <h4 style={{ margin: '0 0 10px', color: resultado.success ? '#155724' : '#721c24', display: 'flex', alignItems: 'center', gap: 8 }}>
                {resultado.success ? <FaCheckCircle /> : <FaExclamationTriangle />}
                {resultado.success ? 'Campaña Enviada' : 'Error'}
              </h4>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: resultado.success ? '#155724' : '#721c24' }}>{resultado.message}</p>
              {resultado.demo && (
                <div style={{ background: '#fff3cd', padding: 12, borderRadius: 8, fontSize: 13, color: '#856404' }}>
                  ⚙️ Para activar el envío real, configure las credenciales de WhatsApp en el archivo <code>.env</code> del servidor.
                </div>
              )}
              {resultado.data && (
                <div style={{ fontSize: 13, color: theme.text }}>
                  <div>✅ Enviados: {resultado.data.enviados}</div>
                  <div>❌ Fallidos: {resultado.data.fallidos}</div>
                </div>
              )}
            </div>
          )}

          {/* Instrucciones de configuración */}
          {!preview && !resultado && (
            <div style={{ background: theme.panel, borderRadius: 15, padding: 25, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', border: `1px solid ${theme.border}` }}>
              <h4 style={{ margin: '0 0 15px', color: '#1a5276' }}>📋 Configuración Requerida</h4>
              <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.6 }}>Podés configurar credenciales desde esta misma pantalla (se guardan en <code>.env</code>):</p>
              <div style={{ background: '#2c3e50', color: '#ecf0f1', padding: 15, borderRadius: 8, fontSize: 12, fontFamily: 'monospace', marginTop: 10 }}>
                <div style={{ color: '#95a5a6' }}># Opción 1: Twilio</div>
                <div>WHATSAPP_MODE=twilio</div>
                <div>TWILIO_ACCOUNT_SID=ACxxxxx</div>
                <div>TWILIO_AUTH_TOKEN=xxxxx</div>
                <div>TWILIO_WHATSAPP_FROM=whatsapp:+14155238886</div>
                <br />
                <div style={{ color: '#95a5a6' }}># Opción 2: Meta WhatsApp Business</div>
                <div>WHATSAPP_MODE=meta</div>
                <div>META_PHONE_NUMBER_ID=xxxxx</div>
                <div>META_ACCESS_TOKEN=xxxxx</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampanaWhatsApp;
