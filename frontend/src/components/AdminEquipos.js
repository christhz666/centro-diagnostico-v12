import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FaFlask, FaSync, FaPlus, FaEdit, FaTrash, FaPowerOff, FaPlay,
  FaStop, FaNetworkWired, FaUsb, FaFolder, FaBroadcastTower,
  FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaClock,
  FaDatabase, FaRedoAlt, FaKey
} from 'react-icons/fa';

const ESTADO_ICONO = {
  activo: { icon: <FaCheckCircle />, color: '#27ae60', label: 'Conectado' },
  inactivo: { icon: <FaPowerOff />, color: '#95a5a6', label: 'Inactivo' },
  mantenimiento: { icon: <FaClock />, color: '#f39c12', label: 'Mantenimiento' },
  error: { icon: <FaTimesCircle />, color: '#e74c3c', label: 'Error' },
  sin_puerto: { icon: <FaExclamationTriangle />, color: '#e67e22', label: 'Sin Puerto' },
  conectado: { icon: <FaCheckCircle />, color: '#27ae60', label: 'En Línea' }
};

const PROTO_ICONO = {
  ASTM: <FaBroadcastTower />,
  HL7: <FaNetworkWired />,
  SERIAL: <FaUsb />,
  TCP: <FaNetworkWired />,
  FILE: <FaFolder />
};

const TIPO_COLORES = {
  hematologia: '#e74c3c',
  quimica: '#3498db',
  orina: '#f1c40f',
  coagulacion: '#9b59b6',
  inmunologia: '#1abc9c',
  microbiologia: '#e67e22',
  imagenologia: '#2563eb',
  otro: '#95a5a6'
};

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`
});

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

/* ═══════════════════════════════════════════════════════════════ */
const AdminEquipos = () => {
  const [equipos, setEquipos] = useState([]);
  const [estadosLive, setEstadosLive] = useState([]);
  const [resultadosRecientes, setResultadosRecientes] = useState([]);
  const [colaPendiente, setColaPendiente] = useState(0);
  const [ordenesPendientesResumen, setOrdenesPendientesResumen] = useState(null);
  const [ordenesPendientes, setOrdenesPendientes] = useState([]);
  const [filtroEquipoOrdenes, setFiltroEquipoOrdenes] = useState('');
  const [logsEquipo, setLogsEquipo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', marca: '', modelo: '', tipo: 'hematologia',
    protocolo: 'ASTM', estado: 'activo',
    configuracion: { ip: '', puertoTcp: '', puerto: '', baudRate: 9600, rutaArchivos: '' }
  });
  const [risConfig, setRisConfig] = useState({
    risIn: { ip: '', puerto: '', habilitado: false, nombre: 'RIS-IN' },
    pacs: { ip: '', puerto: '', aeTitle: '', habilitado: false, nombre: 'PACS' },
    orthanc: { ip: '', puerto: '8042', usuario: '', password: '', aeTitle: '', habilitado: false, nombre: 'Orthanc' }
  });
  const [guardandoRis, setGuardandoRis] = useState(false);
  const [apiKeyGenerada, setApiKeyGenerada] = useState({});

  const cargarEquipos = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const headers = getAuthHeaders();
      const [respEquipos, respEstados] = await Promise.all([
        axios.get('/api/equipos', { headers }),
        axios.get('/api/equipos/estados', { headers }).catch(() => ({ data: [] }))
      ]);

      let lista = [];
      if (Array.isArray(respEquipos.data)) lista = respEquipos.data;
      else if (respEquipos.data?.data) lista = respEquipos.data.data;
      else if (respEquipos.data?.equipos) lista = respEquipos.data.equipos;
      setEquipos(lista);

      const estados = Array.isArray(respEstados.data) ? respEstados.data : (respEstados.data?.data || []);
      setEstadosLive(estados);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }, []);

  const cargarResultadosRecientes = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const resp = await axios.get('/api/equipos/resultados-recientes', { headers }).catch(() => ({ data: [] }));
      const data = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
      setResultadosRecientes(data);
      setColaPendiente(resp.data?.colaPendiente || 0);
    } catch { /* No critical */ }
  }, []);

  const cargarOrdenesPendientes = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const detalleParams = new URLSearchParams();
      detalleParams.set('limit', '1000');
      if (filtroEquipoOrdenes) detalleParams.set('equipoId', filtroEquipoOrdenes);

      const [resumenResp, detalleResp] = await Promise.all([
        axios.get('/api/equipos/ordenes-pendientes/resumen', { headers }).catch(() => ({ data: { data: null } })),
        axios.get(`/api/equipos/ordenes-pendientes?${detalleParams.toString()}`, { headers }).catch(() => ({ data: { data: [] } }))
      ]);

      setOrdenesPendientesResumen(resumenResp.data?.data || null);
      setOrdenesPendientes(detalleResp.data?.data || []);
    } catch {
      setOrdenesPendientesResumen(null);
      setOrdenesPendientes([]);
    }
  }, [filtroEquipoOrdenes]);

  const cargarLogsEquipo = useCallback(async (equipoId) => {
    try {
      const resp = await axios.get(`/api/equipos/${equipoId}/logs?limit=100`, { headers: getAuthHeaders() });
      setLogsEquipo(prev => ({ ...prev, [equipoId]: resp.data?.data || [] }));
    } catch {
      setLogsEquipo(prev => ({ ...prev, [equipoId]: [] }));
    }
  }, []);

  useEffect(() => {
    cargarEquipos();
    cargarResultadosRecientes();
    cargarOrdenesPendientes();
    // Load RIS config
    axios.get('/api/configuracion/', { headers: getAuthHeaders() }).then(resp => {
      const cfg = resp.data?.configuracion || resp.data || {};
      if (cfg.ris_config) {
        try { setRisConfig(JSON.parse(cfg.ris_config)); } catch { }
      }
    }).catch(() => { });
  }, [cargarEquipos, cargarResultadosRecientes, cargarOrdenesPendientes]);

  const guardarRisConfig = async () => {
    setGuardandoRis(true);
    try {
      await axios.put('/api/configuracion/', { ris_config: JSON.stringify(risConfig) }, { headers: getAuthHeaders() });
      alert('Configuración RIS/PACS guardada correctamente');
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
    finally { setGuardandoRis(false); }
  };

  // Polling cada 15 segundos para actualizar estados
  useEffect(() => {
    const interval = setInterval(() => {
      cargarResultadosRecientes();
      cargarOrdenesPendientes();
      axios.get('/api/equipos/estados', { headers: getAuthHeaders() }).then(r => {
        const estados = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        setEstadosLive(estados);
      }).catch(() => { });
    }, 15000);
    return () => clearInterval(interval);
  }, [cargarResultadosRecientes, cargarOrdenesPendientes]);

  const refresh = async () => {
    setRefreshing(true);
    await cargarEquipos();
    await cargarResultadosRecientes();
    await cargarOrdenesPendientes();
    setRefreshing(false);
  };

  const procesarCola = async () => {
    try {
      await axios.post('/api/equipos/procesar-cola', {}, { headers: getAuthHeaders() });
      alert('Cola procesada exitosamente');
      cargarResultadosRecientes();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };

  const reprocesarOrdenesPendientes = async () => {
    try {
      await axios.post('/api/equipos/ordenes-pendientes/reprocesar', {}, { headers: getAuthHeaders() });
      await cargarOrdenesPendientes();
      alert('Órdenes persistentes reprocesadas');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const reprocesarOrdenIndividual = async (ordenId) => {
    try {
      await axios.post(`/api/equipos/ordenes-pendientes/${ordenId}/reprocesar`, {}, { headers: getAuthHeaders() });
      await cargarOrdenesPendientes();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const guardarEquipo = async (e) => {
    e.preventDefault();
    try {
      const headers = getAuthHeaders();
      if (editando) {
        await axios.put(`/api/equipos/${editando._id}`, formData, { headers });
        alert('Equipo actualizado');
      } else {
        await axios.post('/api/equipos', formData, { headers });
        alert('Equipo creado');
      }
      setShowForm(false); setEditando(null);
      cargarEquipos();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };

  const toggleEquipo = async (id, accion) => {
    try {
      await axios.post(`/api/equipos/${id}/${accion}`, {}, { headers: getAuthHeaders() });
      cargarEquipos();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };

  const eliminarEquipo = async (id) => {
    if (!window.confirm('¿Eliminar este equipo?')) return;
    try {
      await axios.delete(`/api/equipos/${id}`, { headers: getAuthHeaders() });
      cargarEquipos();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };

  const abrirEditar = (eq) => {
    setEditando(eq);
    setFormData({
      nombre: eq.nombre, marca: eq.marca, modelo: eq.modelo,
      tipo: eq.tipo, protocolo: eq.protocolo, estado: eq.estado,
      configuracion: { ...eq.configuracion }
    });
    setShowForm(true);
  };

  const guardarIntegracionEquipo = async (equipo) => {
    try {
      const payload = {
        equipoIpMindray: equipo?.integracion?.equipoIpMindray || equipo?.configuracion?.ip || '',
        apiBaseUrl: equipo?.integracion?.apiBaseUrl || window.location.origin,
        agenteVersion: equipo?.integracion?.agenteVersion || '',
        modoEntrega: equipo?.integracion?.modoEntrega || 'manual_pull'
      };
      await axios.put(`/api/equipos/${equipo._id}/integracion`, payload, { headers: getAuthHeaders() });
      await cargarEquipos();
      alert('Integración guardada');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const generarApiKeyEquipo = async (equipoId) => {
    try {
      const resp = await axios.post(`/api/equipos/${equipoId}/generar-api-key`, {}, { headers: getAuthHeaders() });
      const apiKey = resp.data?.data?.apiKey;
      if (apiKey) {
        setApiKeyGenerada(prev => ({ ...prev, [equipoId]: apiKey }));
      }
      await cargarEquipos();
      alert('API key generada. Copiala ahora.');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const copiarApiKey = async (equipoId) => {
    const key = apiKeyGenerada[equipoId];
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      alert('API key copiada');
    } catch {
      alert('No se pudo copiar automáticamente');
    }
  };

  const getEstadoLive = (id) => estadosLive.find(e => e.id === id);
  const controlStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${theme.border}`, fontSize: 14, boxSizing: 'border-box', background: theme.surface, color: theme.text };
  const compactControlStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${theme.border}`, fontSize: 13, boxSizing: 'border-box', background: theme.surface, color: theme.text };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <FaFlask style={{ fontSize: 50, color: '#3498db', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: theme.textMuted, fontSize: 16 }}>Cargando equipos de laboratorio...</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', background: 'rgba(239, 68, 68, 0.14)', borderRadius: 16, maxWidth: 500, margin: '40px auto', border: '1px solid rgba(239, 68, 68, 0.24)' }}>
      <FaTimesCircle style={{ fontSize: 48, color: '#e74c3c', marginBottom: 16 }} />
      <h3 style={{ color: '#c0392b' }}>Error al cargar equipos</h3>
      <p style={{ color: theme.textMuted }}>{error}</p>
      <button onClick={cargarEquipos} style={{ padding: '10px 24px', background: '#3498db', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Reintentar</button>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: theme.textStrong, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FaFlask style={{ color: '#3498db' }} /> Equipos LIS
          </h1>
          <p style={{ margin: '4px 0 0', color: theme.textMuted, fontSize: 14 }}>
            Sistema de integración con equipos de laboratorio — {equipos.length} equipo(s) registrado(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} disabled={refreshing} style={{
            padding: '10px 16px', background: theme.surfaceMuted, border: `1.5px solid ${theme.border}`,
            borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: theme.text
          }}>
            <FaSync style={{ animation: refreshing ? 'spin 0.5s linear infinite' : 'none' }} /> Actualizar
          </button>
          <button onClick={() => { setEditando(null); setFormData({ nombre: '', marca: '', modelo: '', tipo: 'hematologia', protocolo: 'ASTM', estado: 'activo', configuracion: { ip: '', puertoTcp: '', puerto: '', baudRate: 9600, rutaArchivos: '' } }); setShowForm(true); }} style={{
            padding: '10px 16px', background: 'linear-gradient(135deg,#0f4c75,#1a6ba8)', color: 'white',
            border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600
          }}>
            <FaPlus /> Nuevo Equipo
          </button>
        </div>
      </div>

      {/* ── Resumen rápido de estados ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Equipos', value: equipos.length, color: '#3498db', icon: <FaFlask /> },
          { label: 'En Línea', value: estadosLive.filter(e => e.estado === 'conectado').length, color: '#27ae60', icon: <FaCheckCircle /> },
          { label: 'Cola Pendiente', value: colaPendiente, color: colaPendiente > 0 ? '#e74c3c' : '#27ae60', icon: <FaDatabase /> },
          { label: 'Últ. Resultado', value: resultadosRecientes.length > 0 ? 'Hoy' : '—', color: '#8e44ad', icon: <FaClock /> },
        ].map((item, i) => (
          <div key={i} style={{ background: theme.surface, borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, fontSize: 18 }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.textStrong }}>{item.value}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tarjetas de equipos ───────────────────────────────── */}
      {equipos.length === 0 ? (
        <div style={{ padding: 50, textAlign: 'center', background: theme.surfaceMuted, borderRadius: 16, border: `2px dashed ${theme.border}` }}>
          <FaFlask style={{ fontSize: 48, color: '#bbb', marginBottom: 16 }} />
          <h3 style={{ color: theme.text }}>No hay equipos registrados</h3>
          <p style={{ color: theme.textMuted }}>Registra tu primer equipo de laboratorio para comenzar a recibir resultados automáticamente.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 28 }}>
          {equipos.map((eq) => {
            const live = getEstadoLive(eq._id);
            const estadoInfo = ESTADO_ICONO[live?.estado || eq.estado] || ESTADO_ICONO.inactivo;
            const tipoColor = TIPO_COLORES[eq.tipo] || '#95a5a6';
            return (
              <div key={eq._id} style={{
                background: theme.surface, borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: `1px solid ${theme.border}`,
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}>
                {/* Header del equipo */}
                <div style={{ padding: '16px 20px', background: `linear-gradient(135deg, ${tipoColor}15, ${tipoColor}08)`, borderBottom: `3px solid ${tipoColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.textStrong }}>{eq.nombre}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: theme.textMuted }}>{eq.marca} — {eq.modelo}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${estadoInfo.color}15`, color: estadoInfo.color, fontSize: 11, fontWeight: 600 }}>
                      {estadoInfo.icon} {estadoInfo.label}
                    </div>
                  </div>
                </div>

                {/* Detalles */}
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                    <div><span style={{ color: theme.textMuted, fontWeight: 500 }}>Tipo:</span> <span style={{ fontWeight: 600, color: tipoColor, textTransform: 'capitalize' }}>{eq.tipo}</span></div>
                    <div><span style={{ color: theme.textMuted, fontWeight: 500 }}>Protocolo:</span> <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, color: theme.text }}>{PROTO_ICONO[eq.protocolo]} {eq.protocolo}</span></div>
                    {eq.configuracion?.ip && <div><span style={{ color: theme.textMuted, fontWeight: 500 }}>IP:</span> <code style={{ background: theme.surfaceMuted, padding: '2px 6px', borderRadius: 4, fontSize: 12, color: theme.textStrong }}>{eq.configuracion.ip}:{eq.configuracion.puertoTcp}</code></div>}
                    {eq.configuracion?.puerto && <div><span style={{ color: theme.textMuted, fontWeight: 500 }}>Puerto:</span> <code style={{ background: theme.surfaceMuted, padding: '2px 6px', borderRadius: 4, fontSize: 12, color: theme.textStrong }}>{eq.configuracion.puerto}</code></div>}
                    <div><span style={{ color: theme.textMuted, fontWeight: 500 }}>Resultados:</span> <span style={{ fontWeight: 700, color: theme.textStrong }}>{eq.estadisticas?.resultadosRecibidos || 0}</span></div>
                    <div><span style={{ color: theme.textMuted, fontWeight: 500 }}>Errores:</span> <span style={{ fontWeight: 600, color: (eq.estadisticas?.errores || 0) > 0 ? '#e74c3c' : '#27ae60' }}>{eq.estadisticas?.errores || 0}</span></div>
                  </div>
                  {eq.ultimoError && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#fff3f3', borderRadius: 8, fontSize: 11, color: '#c0392b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FaExclamationTriangle /> {eq.ultimoError}
                    </div>
                  )}

                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#f4f9ff', border: '1px solid #d6e9ff', borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f4c75', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FaNetworkWired /> Interfaz de comunicación equipo-servidor
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: theme.textMuted }}>IP equipo (Mindray)</label>
                        <input
                          value={eq.integracion?.equipoIpMindray || ''}
                          onChange={(e) => setEquipos(prev => prev.map(item => item._id === eq._id ? {
                            ...item,
                            integracion: { ...(item.integracion || {}), equipoIpMindray: e.target.value }
                          } : item))}
                          placeholder="192.168.1.120"
                          style={{ ...compactControlStyle, marginTop: 2 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: theme.textMuted }}>Modo entrega</label>
                        <select
                          value={eq.integracion?.modoEntrega || 'manual_pull'}
                          onChange={(e) => setEquipos(prev => prev.map(item => item._id === eq._id ? {
                            ...item,
                            integracion: { ...(item.integracion || {}), modoEntrega: e.target.value }
                          } : item))}
                          style={{ ...compactControlStyle, marginTop: 2 }}
                        >
                          <option value="manual_pull">Manual pull (descarga lista desde equipo)</option>
                          <option value="push_socket">Push socket (enviar directo)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: theme.textMuted }}>API servidor</label>
                        <input
                          value={eq.integracion?.apiBaseUrl || ''}
                          onChange={(e) => setEquipos(prev => prev.map(item => item._id === eq._id ? {
                            ...item,
                            integracion: { ...(item.integracion || {}), apiBaseUrl: e.target.value }
                          } : item))}
                          placeholder="https://tu-dominio.com/api"
                          style={{ ...compactControlStyle, marginTop: 2 }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>
                      API Key: {eq.integracion?.apiKeyUltimos4 ? `••••${eq.integracion.apiKeyUltimos4}` : 'No generada'}
                    </div>

                    <div style={{ marginTop: 4, fontSize: 11, color: theme.textMuted }}>
                      Pull URL (agente):
                      <code style={{ marginLeft: 6 }}>
                        {`${(eq.integracion?.apiBaseUrl || window.location.origin).replace(/\/$/, '')}/api/equipos/${eq._id}/ordenes-pull?limit=1000`}
                      </code>
                    </div>

                    <div style={{ marginTop: 4, fontSize: 11, color: theme.textMuted }}>
                      ⚠️ En modo manual_pull, la lista queda siempre disponible para descarga manual desde el equipo.
                    </div>

                    <div style={{ marginTop: 4, fontSize: 11, color: theme.textMuted }}>
                      Heartbeat URL (agente):
                      <code style={{ marginLeft: 6 }}>
                        {`${(eq.integracion?.apiBaseUrl || window.location.origin).replace(/\/$/, '')}/api/equipos/${eq._id}/heartbeat`}
                      </code>
                    </div>

                    <div style={{ marginTop: 4, fontSize: 11, color: theme.textMuted }}>
                      ACK URL (agente):
                      <code style={{ marginLeft: 6 }}>
                        {`${(eq.integracion?.apiBaseUrl || window.location.origin).replace(/\/$/, '')}/api/equipos/${eq._id}/ordenes-ack`}
                      </code>
                    </div>

                    <div style={{ marginTop: 4, fontSize: 11, color: theme.textMuted }}>
                      Submit resultados URL:
                      <code style={{ marginLeft: 6 }}>
                        {`${(eq.integracion?.apiBaseUrl || window.location.origin).replace(/\/$/, '')}/api/equipos/${eq._id}/resultados-submit`}
                      </code>
                    </div>

                    {apiKeyGenerada[eq._id] && (
                      <div style={{ marginTop: 6, padding: '6px 8px', background: '#fff', border: '1px dashed #90caf9', borderRadius: 8, fontSize: 11 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Nueva API Key (copiala ahora):</div>
                        <code style={{ wordBreak: 'break-all', display: 'block' }}>{apiKeyGenerada[eq._id]}</code>
                      </div>
                    )}

                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => guardarIntegracionEquipo(eq)}
                        style={{ padding: '6px 10px', border: 'none', borderRadius: 7, background: '#1976d2', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                      >
                        Guardar interfaz
                      </button>
                      <button
                        onClick={() => generarApiKeyEquipo(eq._id)}
                        style={{ padding: '6px 10px', border: 'none', borderRadius: 7, background: '#2e7d32', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <FaKey /> Generar API Key
                      </button>
                      {apiKeyGenerada[eq._id] && (
                        <button
                          onClick={() => copiarApiKey(eq._id)}
                          style={{ padding: '6px 10px', border: 'none', borderRadius: 7, background: '#455a64', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                        >
                          Copiar API Key
                        </button>
                      )}
                      <button
                        onClick={() => cargarLogsEquipo(eq._id)}
                        style={{ padding: '6px 10px', border: 'none', borderRadius: 7, background: '#0d47a1', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                      >
                        Ver logs agente
                      </button>

                      <button
                        onClick={() => {
                          const txt = [
                            `equipoId=${eq._id}`,
                            `apiBaseUrl=${(eq.integracion?.apiBaseUrl || window.location.origin).replace(/\/$/, '')}`,
                            `mindrayIp=${eq.integracion?.equipoIpMindray || eq.configuracion?.ip || ''}`,
                            `pullUrl=${(eq.integracion?.apiBaseUrl || window.location.origin).replace(/\/$/, '')}/api/equipos/${eq._id}/ordenes-pull?limit=1000`,
                            `heartbeatUrl=${(eq.integracion?.apiBaseUrl || window.location.origin).replace(/\/$/, '')}/api/equipos/${eq._id}/heartbeat`
                          ].join('\n');
                          navigator.clipboard.writeText(txt).then(() => alert('Instrucciones copiadas para el agente')).catch(() => alert('No se pudo copiar'));
                        }}
                        style={{ padding: '6px 10px', border: 'none', borderRadius: 7, background: '#6a1b9a', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                      >
                        Copiar setup agente
                      </button>
                    </div>

                    {Array.isArray(logsEquipo[eq._id]) && logsEquipo[eq._id].length > 0 && (
                      <div style={{ marginTop: 8, background: '#0b1020', color: '#d7e3ff', borderRadius: 8, padding: 8, maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11 }}>
                        {logsEquipo[eq._id].map((l) => (
                          <div key={l._id} style={{ marginBottom: 4 }}>
                            [{new Date(l.timestamp || l.createdAt).toLocaleString()}] [{String(l.level || 'info').toUpperCase()}] {l.event}: {l.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ padding: '10px 20px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => abrirEditar(eq)} style={{ flex: 1, padding: '8px', background: '#eaf2fc', color: '#2980b9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><FaEdit /> Editar</button>
                  <button onClick={() => toggleEquipo(eq._id, eq.estado === 'activo' ? 'detener' : 'iniciar')} style={{ flex: 1, padding: '8px', background: eq.estado === 'activo' ? '#fdf0e0' : '#e8f8ee', color: eq.estado === 'activo' ? '#e67e22' : '#27ae60', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    {eq.estado === 'activo' ? <><FaStop /> Detener</> : <><FaPlay /> Iniciar</>}
                  </button>
                  <button onClick={() => eliminarEquipo(eq._id)} style={{ padding: '8px 10px', background: '#fee', color: '#e74c3c', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}><FaTrash /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Cola pendiente + Resultados recientes ──────────────── */}
      {colaPendiente > 0 && (
        <div style={{ background: '#fff8e1', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #ffe082' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FaExclamationTriangle style={{ color: '#f57f17', fontSize: 20 }} />
            <div>
              <strong style={{ color: '#e65100' }}>{colaPendiente} resultado(s) en cola</strong>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.textMuted }}>Resultados recibidos de equipos pero sin paciente vinculado. Pueden ser códigos ID aún no facturados.</p>
            </div>
          </div>
          <button onClick={procesarCola} style={{ padding: '8px 16px', background: '#f57f17', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <FaRedoAlt /> Reprocesar
          </button>
        </div>
      )}

      {/* ── Órdenes persistentes pendientes ───────────────────── */}
      {(ordenesPendientesResumen?.pendientes || 0) > 0 && (
        <div style={{ background: '#eef7ff', borderRadius: 14, padding: '16px 20px', marginBottom: 20, border: '1px solid #bbdefb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: '#0d47a1' }}>
                {ordenesPendientesResumen.pendientes} orden(es) persistentes pendientes de envío/completitud
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: theme.textMuted }}>
                Equipos bidireccionales: las pruebas se reintentan hasta completarse.
              </p>
            </div>
            <button onClick={reprocesarOrdenesPendientes} style={{ padding: '8px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FaRedoAlt /> Reprocesar órdenes
            </button>
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: theme.textMuted }}>Filtrar por equipo:</label>
            <select
              value={filtroEquipoOrdenes}
              onChange={(e) => setFiltroEquipoOrdenes(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #90caf9', fontSize: 12 }}
            >
              <option value="">Todos</option>
              {equipos.map(eq => (
                <option key={eq._id} value={eq._id}>{eq.nombre}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              Mostrando {ordenesPendientes.length} orden(es)
            </span>
          </div>

          {ordenesPendientes.length > 0 && (
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#e3f2fd' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Equipo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Factura</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Código ID</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Estado</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Intentos</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Pruebas pendientes</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesPendientes.map((o) => {
                    const pendientesPruebas = (o.pruebas || []).filter(p => !p.completada).length;
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #dbeafe' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{o.equipo?.nombre || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{o.factura?.numero || '—'}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{o.factura?.codigoId || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{o.estado || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{o.intentos || 0}</td>
                        <td style={{ padding: '8px 10px' }}>{pendientesPruebas}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <button
                            onClick={() => reprocesarOrdenIndividual(o.id)}
                            style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: 'none', background: '#1e88e5', color: 'white', cursor: 'pointer' }}
                          >
                            Reintentar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {resultadosRecientes.length > 0 && (
        <div style={{ background: theme.surface, borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: `1px solid ${theme.border}`, marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: theme.textStrong, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaClock style={{ color: '#8e44ad' }} /> Últimos Resultados Recibidos
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: theme.surfaceMuted, textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Equipo</th>
                  <th style={{ padding: '10px 14px', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Paciente</th>
                  <th style={{ padding: '10px 14px', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Código ID</th>
                  <th style={{ padding: '10px 14px', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Parámetros</th>
                  <th style={{ padding: '10px 14px', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {resultadosRecientes.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.borderSoft}` }} className="hover-row">
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: theme.textStrong }}>{r.equipo || '—'}</td>
                    <td style={{ padding: '10px 14px', color: theme.text }}>{r.paciente || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.codigoId ? (
                        <span style={{ background: theme.surfaceMuted, padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontFamily: 'monospace', fontSize: 14, color: theme.textStrong }}>{r.codigoId}</span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: theme.text }}>{r.parametros || '—'}</td>
                    <td style={{ padding: '10px 14px', color: theme.textMuted, fontSize: 12 }}>{r.fecha ? new Date(r.fecha).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Configuración RIS / Worklist / PACS ──────────────── */}
      <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-md dark:shadow-none mb-7 border border-gray-100 dark:border-gray-700">
        <h3 className="text-gray-900 dark:text-white" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaBroadcastTower style={{ color: '#e67e22' }} /> Configuración RIS / Worklist / PACS
        </h3>
        <p className="text-gray-500 dark:text-gray-400" style={{ margin: '0 0 20px', fontSize: 13 }}>Configure la conexión para enviar worklists a equipos de rayos X y recibir imágenes DICOM.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* RIS-IN Module */}
          <div className="bg-orange-50 dark:bg-white/5 rounded-xl p-5 border border-orange-200 dark:border-gray-600">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 className="text-orange-600 dark:text-orange-400" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><FaNetworkWired /> RIS-IN (Worklist)</h4>
              <label className="text-gray-600 dark:text-gray-300" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={risConfig.risIn.habilitado} onChange={e => setRisConfig({ ...risConfig, risIn: { ...risConfig.risIn, habilitado: e.target.checked } })} />
                Habilitado
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Dirección IP</label>
                <input value={risConfig.risIn.ip} placeholder="192.168.1.50" onChange={e => setRisConfig({ ...risConfig, risIn: { ...risConfig.risIn, ip: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Puerto</label>
                <input type="number" value={risConfig.risIn.puerto} placeholder="104" onChange={e => setRisConfig({ ...risConfig, risIn: { ...risConfig.risIn, puerto: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
            </div>
            <p className="text-gray-400 dark:text-gray-500" style={{ margin: '10px 0 0', fontSize: 11 }}>Módulo que envía la worklist al equipo de Rayos X vía DICOM MWL. Solo envía estudios de imagenología.</p>
          </div>

          {/* PACS Module */}
          <div className="bg-blue-50 dark:bg-white/5 rounded-xl p-5 border border-blue-200 dark:border-gray-600">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 className="text-blue-600 dark:text-blue-400" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><FaDatabase /> PACS (Imágenes)</h4>
              <label className="text-gray-600 dark:text-gray-300" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={risConfig.pacs.habilitado} onChange={e => setRisConfig({ ...risConfig, pacs: { ...risConfig.pacs, habilitado: e.target.checked } })} />
                Habilitado
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Dirección IP</label>
                <input value={risConfig.pacs.ip} placeholder="192.168.1.100" onChange={e => setRisConfig({ ...risConfig, pacs: { ...risConfig.pacs, ip: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Puerto</label>
                <input type="number" value={risConfig.pacs.puerto} placeholder="4242" onChange={e => setRisConfig({ ...risConfig, pacs: { ...risConfig.pacs, puerto: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div>
              <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>AE Title</label>
              <input value={risConfig.pacs.aeTitle} placeholder="ORTHANC" onChange={e => setRisConfig({ ...risConfig, pacs: { ...risConfig.pacs, aeTitle: e.target.value } })}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
            </div>
            <p className="text-gray-400 dark:text-gray-500" style={{ margin: '10px 0 0', fontSize: 11 }}>Servidor PACS que almacena y distribuye las imágenes DICOM.</p>
          </div>

          {/* Orthanc Module */}
          <div className="bg-green-50 dark:bg-white/5 rounded-xl p-5 border border-green-200 dark:border-gray-600" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 className="text-green-700 dark:text-green-400" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><FaDatabase /> Orthanc (Servidor VPS)</h4>
              <label className="text-gray-600 dark:text-gray-300" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={risConfig.orthanc?.habilitado || false} onChange={e => setRisConfig({ ...risConfig, orthanc: { ...(risConfig.orthanc || {}), habilitado: e.target.checked } })} />
                Habilitado
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>IP del VPS (Orthanc)</label>
                <input value={risConfig.orthanc?.ip || ''} placeholder="123.45.67.89" onChange={e => setRisConfig({ ...risConfig, orthanc: { ...(risConfig.orthanc || {}), ip: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Puerto</label>
                <input type="number" value={risConfig.orthanc?.puerto || ''} placeholder="8042" onChange={e => setRisConfig({ ...risConfig, orthanc: { ...(risConfig.orthanc || {}), puerto: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Usuario</label>
                <input value={risConfig.orthanc?.usuario || ''} placeholder="admin" onChange={e => setRisConfig({ ...risConfig, orthanc: { ...(risConfig.orthanc || {}), usuario: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Contraseña</label>
                <input type="password" value={risConfig.orthanc?.password || ''} placeholder="••••••" onChange={e => setRisConfig({ ...risConfig, orthanc: { ...(risConfig.orthanc || {}), password: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>AE Title</label>
                <input value={risConfig.orthanc?.aeTitle || ''} placeholder="CS7_KONICA" onChange={e => setRisConfig({ ...risConfig, orthanc: { ...(risConfig.orthanc || {}), aeTitle: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white" />
              </div>
            </div>
            <p className="text-gray-400 dark:text-gray-500" style={{ margin: '10px 0 0', fontSize: 11 }}>Configuración del servidor Orthanc en el VPS para enviar imágenes DICOM y recibir worklists. La IP y puerto deben apuntar al servidor VPS.</p>
          </div>
        </div>

        <button onClick={guardarRisConfig} disabled={guardandoRis} style={{
          marginTop: 20, padding: '12px 24px', background: 'linear-gradient(135deg,#e67e22,#f39c12)', color: 'white',
          border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8
        }}>
          {guardandoRis ? <FaSync style={{ animation: 'spin 0.5s linear infinite' }} /> : <FaCheckCircle />}
          {guardandoRis ? 'Guardando...' : 'Guardar Configuración RIS/PACS'}
        </button>
      </div>

      {/* ── Modal Crear/Editar ─────────────────────────────────── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: theme.surface, borderRadius: 20, padding: 30, width: '100%', maxWidth: 550, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${theme.border}` }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: theme.textStrong }}>
              {editando ? '✏️ Editar Equipo' : '➕ Nuevo Equipo'}
            </h2>
            <form onSubmit={guardarEquipo}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                {[
                  { label: 'Nombre', key: 'nombre', placeholder: 'Ej: Mindray BC-6800', span: 2 },
                  { label: 'Marca', key: 'marca', placeholder: 'Mindray' },
                  { label: 'Modelo', key: 'modelo', placeholder: 'BC-6800' },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.span === 2 ? '1/-1' : undefined }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 4 }}>{f.label}</label>
                    <input value={formData[f.key]} placeholder={f.placeholder} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} required
                      style={controlStyle} />
                  </div>
                ))}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 4 }}>Tipo</label>
                  <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                    style={controlStyle}>
                    {Object.keys(TIPO_COLORES).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 4 }}>Protocolo</label>
                  <select value={formData.protocolo} onChange={e => setFormData({ ...formData, protocolo: e.target.value })}
                    style={controlStyle}>
                    {['ASTM', 'HL7', 'SERIAL', 'TCP', 'FILE'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Configuración según protocolo */}
              <div style={{ marginTop: 16, padding: '14px 16px', background: theme.surfaceMuted, borderRadius: 12, border: `1px solid ${theme.border}` }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, color: theme.text }}>⚙️ Configuración de Conexión</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                  {(formData.protocolo === 'TCP' || formData.protocolo === 'HL7' || formData.protocolo === 'ASTM') && (
                    <>
                      <div>
                        <label style={{ fontSize: 11, color: theme.textMuted }}>Dirección IP</label>
                        <input value={formData.configuracion.ip || ''} placeholder="192.168.1.100" onChange={e => setFormData({ ...formData, configuracion: { ...formData.configuracion, ip: e.target.value } })}
                          style={compactControlStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: theme.textMuted }}>Puerto TCP</label>
                        <input type="number" value={formData.configuracion.puertoTcp || ''} placeholder="2575" onChange={e => setFormData({ ...formData, configuracion: { ...formData.configuracion, puertoTcp: parseInt(e.target.value) || '' } })}
                          style={compactControlStyle} />
                      </div>
                    </>
                  )}
                  {formData.protocolo === 'SERIAL' && (
                    <>
                      <div>
                        <label style={{ fontSize: 11, color: theme.textMuted }}>Puerto COM</label>
                        <input value={formData.configuracion.puerto || ''} placeholder="COM3" onChange={e => setFormData({ ...formData, configuracion: { ...formData.configuracion, puerto: e.target.value } })}
                          style={compactControlStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: theme.textMuted }}>Baud Rate</label>
                        <select value={formData.configuracion.baudRate || 9600} onChange={e => setFormData({ ...formData, configuracion: { ...formData.configuracion, baudRate: parseInt(e.target.value) } })}
                          style={compactControlStyle}>
                          {[2400, 4800, 9600, 19200, 38400, 57600, 115200].map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {formData.protocolo === 'FILE' && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ fontSize: 11, color: theme.textMuted }}>Ruta de Archivos</label>
                      <input value={formData.configuracion.rutaArchivos || ''} placeholder="C:\lab\resultados" onChange={e => setFormData({ ...formData, configuracion: { ...formData.configuracion, rutaArchivos: e.target.value } })}
                        style={compactControlStyle} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => { setShowForm(false); setEditando(null); }} style={{ flex: 1, padding: '12px', background: theme.surfaceMuted, border: `1px solid ${theme.border}`, borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: theme.text }}>Cancelar</button>
                <button type="submit" style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg,#0f4c75,#1a6ba8)', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  {editando ? 'Actualizar' : 'Crear Equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEquipos;
