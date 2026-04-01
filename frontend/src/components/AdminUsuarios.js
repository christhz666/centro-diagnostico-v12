import React, { useState, useEffect } from 'react';
import { FaUsers, FaPlus, FaEdit, FaToggleOn, FaToggleOff, FaKey, FaSpinner, FaSave, FaTimes, FaBuilding } from 'react-icons/fa';
import api from '../services/api';

const ROLES_DEFAULT = [
  { value: 'admin', label: 'Administrador' },
  { value: 'medico', label: 'Médico' },
  { value: 'recepcion', label: 'Recepcionista' },
  { value: 'laboratorio', label: 'Laboratorista' },
  { value: 'paciente', label: 'Paciente' }
];

const ROL_COLORS = {
  admin: '#e74c3c',
  'super-admin': '#8e44ad',
  medico: '#3498db',
  bioanalista: '#8e44ad',
  recepcionista: '#27ae60',
  recepcion: '#27ae60',
  laboratorio: '#9b59b6',
  paciente: '#f39c12'
};

const PERMISSION_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'registro', label: 'Registro' },
  { key: 'consulta', label: 'Consulta Rápida' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'medico', label: 'Portal Médico' },
  { key: 'resultados', label: 'Resultados' },
  { key: 'imagenologia', label: 'Imagenología' },
  { key: 'perfil', label: 'Perfil' },
  { key: 'adminPanel', label: 'Admin: Configuración' },
  { key: 'adminUsuarios', label: 'Admin: Usuarios' },
  { key: 'adminMedicos', label: 'Admin: Médicos' },
  { key: 'adminEquipos', label: 'Admin: Equipos' },
  { key: 'adminEstudios', label: 'Admin: Catálogo' },
  { key: 'contabilidad', label: 'Contabilidad' },
  { key: 'campanaWhatsapp', label: 'Campaña WhatsApp' },
  { key: 'descargarApp', label: 'Descargar App' },
  { key: 'deploy', label: 'Deploy Agentes' }
];

const BASE_PERMISSIONS = PERMISSION_OPTIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {});

const ROLE_PERMISSION_TEMPLATES = {
  'super-admin': Object.keys(BASE_PERMISSIONS).reduce((acc, k) => ({ ...acc, [k]: true }), {}),
  admin: Object.keys(BASE_PERMISSIONS).reduce((acc, k) => ({ ...acc, [k]: true }), {}),
  bioanalista: {
    ...BASE_PERMISSIONS,
    dashboard: true,
    consulta: true,
    resultados: true,
    perfil: true,
    imagenologia: true
  },
  laboratorio: {
    ...BASE_PERMISSIONS,
    dashboard: true,
    consulta: true,
    resultados: true,
    perfil: true
  },
  medico: {
    ...BASE_PERMISSIONS,
    dashboard: true,
    medico: true,
    resultados: true,
    imagenologia: true,
    perfil: true
  },
  recepcionista: {
    ...BASE_PERMISSIONS,
    dashboard: true,
    registro: true,
    consulta: true,
    facturas: true,
    perfil: true,
    imagenologia: true
  },
  recepcion: {
    ...BASE_PERMISSIONS,
    dashboard: true,
    registro: true,
    consulta: true,
    facturas: true,
    perfil: true,
    imagenologia: true
  },
  paciente: {
    ...BASE_PERMISSIONS,
    perfil: true
  }
};

const getPermissionsForRole = (role = 'recepcion') => {
  return { ...BASE_PERMISSIONS, ...(ROLE_PERMISSION_TEMPLATES[role] || {}) };
};

const theme = {
  surface: 'var(--background-drawer, #1e293b)',
  surfaceMuted: 'var(--surface-muted, #0f172a)',
  border: 'var(--border, #334155)',
  text: 'var(--text, #f8fafc)',
  textStrong: 'var(--text-strong, #ffffff)',
  textMuted: 'var(--text-muted, #94a3b8)',
  infoPanel: 'rgba(59, 130, 246, 0.1)'
};

const AdminUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [roles, setRoles] = useState(ROLES_DEFAULT);
  const [formData, setFormData] = useState({
    nombre: '', apellido: '', email: '', username: '', password: '',
    role: 'recepcion', telefono: '', especialidad: '', sucursal: '', permissions: getPermissionsForRole('recepcion')
  });

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
    fetchSucursales();
  }, []);

  const fetchSucursales = async () => {
    try {
      const res = await api.request('/sucursales');
      const lista = res?.data || res;
      setSucursales(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setSucursales([]);
    }
  };

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const response = await api.getUsuarios();
      const lista = response?.data || response || [];
      setUsuarios(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setError(err.message);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.getRoles();
      if (Array.isArray(response) && response.length > 0) setRoles(response);
    } catch (err) {
      // usar default
    }
  };

  const abrirCrear = () => {
    setEditando(null);
    setFormData({ nombre: '', apellido: '', email: '', username: '', password: '', role: 'recepcion', telefono: '', especialidad: '', sucursal: '', permissions: getPermissionsForRole('recepcion') });
    setShowModal(true);
  };

  const abrirEditar = (usuario) => {
    setEditando(usuario);
    const sucId = usuario.sucursal?._id || usuario.sucursal;
    setFormData({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      email: usuario.email || '',
      username: usuario.username || '',
      password: '',
      role: usuario.role || usuario.rol || 'recepcion',
      telefono: usuario.telefono || '',
      especialidad: usuario.especialidad || '',
      sucursal: sucId ? String(sucId) : '',
      permissions: { ...getPermissionsForRole(usuario.role || usuario.rol || 'recepcion'), ...(usuario.permissions || {}) }
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userData = { ...formData };
      // No enviar email/username vacíos o "null" para evitar errores de índice único
      if (!userData.email || userData.email === 'null' || String(userData.email).trim() === '') {
        delete userData.email;
      }
      if (!userData.username || userData.username === 'null' || String(userData.username).trim() === '') {
        delete userData.username;
      }
      // Apellido es opcional; no enviar cadena vacía
      if (!userData.apellido || String(userData.apellido).trim() === '') {
        delete userData.apellido;
      }
      // Para médicos: nombre es opcional (se deriva del username en el backend)
      if (userData.role === 'medico' && (!userData.nombre || String(userData.nombre).trim() === '')) {
        delete userData.nombre;
      }
      if (editando) {
        if (!userData.password) delete userData.password;
        if (!userData.sucursal) userData.sucursal = null;
        await api.updateUsuario(editando._id || editando.id, userData);
        alert('Usuario actualizado exitosamente');
      } else {
        if (!userData.sucursal) delete userData.sucursal;
        await api.createUsuario(userData);
        alert('Usuario creado exitosamente');
      }
      setShowModal(false);
      fetchUsuarios();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.toggleUsuario(id);
      fetchUsuarios();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleResetPassword = async (id) => {
    const newPass = prompt('Nueva contraseña (mínimo 6 caracteres):');
    if (newPass && newPass.length >= 6) {
      try {
        await api.resetPasswordUsuario(id, newPass);
        alert('Contraseña actualizada exitosamente');
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
  };

  const getRolLabel = (role) => {
    const r = roles.find(r => r.value === role);
    return r ? r.label : role;
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
      <FaSpinner style={{ fontSize: 40, animation: 'spin 1s linear infinite', color: '#3498db' }} />
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: theme.textStrong }}>
          <FaUsers /> Gestión de Usuarios
        </h1>
        <button onClick={abrirCrear} style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold' }}>
          <FaPlus /> Nuevo Usuario
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: 15, borderRadius: 8, marginBottom: 20, color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.28)' }}>{error}</div>}

      <div style={{ background: theme.surface, borderRadius: 10, overflow: 'hidden', border: `1px solid ${theme.border}`, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.surfaceMuted }}>
              <th style={{ padding: 15, textAlign: 'left', color: theme.textMuted, fontWeight: 600 }}>Nombre</th>
              <th style={{ padding: 15, textAlign: 'left', color: theme.textMuted, fontWeight: 600 }}>Usuario</th>
              <th style={{ padding: 15, textAlign: 'left', color: theme.textMuted, fontWeight: 600 }}>Teléfono</th>
              <th style={{ padding: 15, textAlign: 'left', color: theme.textMuted, fontWeight: 600 }}>Rol</th>
              <th style={{ padding: 15, textAlign: 'left', color: theme.textMuted, fontWeight: 600 }}>Sucursal</th>
              <th style={{ padding: 15, textAlign: 'center', color: theme.textMuted, fontWeight: 600 }}>Estado</th>
              <th style={{ padding: 15, textAlign: 'center', color: theme.textMuted, fontWeight: 600 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: 30, textAlign: 'center', color: theme.textMuted }}>No hay usuarios registrados</td></tr>
            ) : (
              usuarios.map((u) => {
                const rol = u.role || u.rol || 'recepcion';
                return (
                  <tr key={u._id || u.id} style={{ borderBottom: `1px solid ${theme.border}` }} className="hover-row">
                    <td style={{ padding: 15, fontWeight: 'bold', color: theme.text }}>{u.nombre} {u.apellido}</td>
                    <td style={{ padding: 15, color: theme.textMuted }}>{u.username || u.email || '-'}</td>
                    <td style={{ padding: 15, color: theme.textMuted }}>{u.telefono || '-'}</td>
                    <td style={{ padding: 15 }}>
                      <span style={{ background: ROL_COLORS[rol] || '#95a5a6', color: 'white', padding: '4px 10px', borderRadius: 15, fontSize: 12, fontWeight: 'bold' }}>
                        {getRolLabel(rol)}
                      </span>
                    </td>
                    <td style={{ padding: 15, color: theme.textMuted }}>{u.sucursal?.nombre || (u.sucursal ? 'Asignada' : '-')}</td>
                    <td style={{ padding: 15, textAlign: 'center' }}>
                      <span style={{ color: u.activo ? '#27ae60' : '#e74c3c', fontWeight: 'bold' }}>
                        {u.activo ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: 15, textAlign: 'center', display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => abrirEditar(u)} title="Editar" style={{ background: '#3498db', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                        <FaEdit />
                      </button>
                      <button onClick={() => handleToggle(u._id || u.id)} title={u.activo ? 'Desactivar' : 'Activar'} style={{ background: u.activo ? '#e74c3c' : '#27ae60', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                        {u.activo ? <FaToggleOn /> : <FaToggleOff />}
                      </button>
                      <button onClick={() => handleResetPassword(u._id || u.id)} title="Cambiar contraseña" style={{ background: '#f39c12', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                        <FaKey />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: theme.surface, padding: 30, borderRadius: 15, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: theme.textStrong }}>{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: theme.textMuted }}><FaTimes /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: 12 }}>
                {/* Selector de rol siempre visible primero */}
                <div>
                  <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 5, display: 'block' }}>Rol del usuario *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value, permissions: getPermissionsForRole(e.target.value) })}
                    required
                    style={inputStyle}
                  >
                    {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                {formData.role === 'medico' ? (
                  /* Formulario simplificado para médicos: solo usuario y contraseña */
                  <>
                    <div style={{ background: theme.infoPanel, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#60a5fa' }}>
                      Los médicos se identifican únicamente con <strong>nombre de usuario</strong> y <strong>contraseña</strong>.
                    </div>
                    <input
                      placeholder="Nombre de usuario * (obligatorio para médicos)"
                      type="text"
                      value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                      required
                      style={inputStyle}
                    />
                    <input
                      placeholder={editando ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña * (mínimo 6 caracteres)'}
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      required={!editando}
                      minLength={editando ? 0 : 6}
                      style={inputStyle}
                    />
                    <input
                      placeholder="Nombre del médico (opcional)"
                      value={formData.nombre}
                      onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                      style={inputStyle}
                    />
                    <input
                      placeholder="Especialidad médica"
                      value={formData.especialidad}
                      onChange={e => setFormData({ ...formData, especialidad: e.target.value })}
                      style={inputStyle}
                    />
                  </>
                ) : (
                  /* Formulario completo para otros roles */
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <input placeholder="Nombre *" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required style={inputStyle} />
                      <input placeholder="Apellido (opcional)" value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })} style={inputStyle} />
                    </div>
                    <input placeholder="Nombre de usuario (se genera automáticamente si se deja vacío)" type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} style={inputStyle} />
                    <input placeholder={editando ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña * (mínimo 6 caracteres)"} type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required={!editando} minLength={editando ? 0 : 6} style={inputStyle} />
                    <input placeholder="Teléfono" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} style={inputStyle} />
                    <div>
                      <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 5, display: 'block' }}><FaBuilding style={{ marginRight: 6 }} />Sucursal</label>
                      <select value={formData.sucursal} onChange={e => setFormData({ ...formData, sucursal: e.target.value })} style={inputStyle}>
                        <option value="">-- Sin sucursal --</option>
                        {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre} ({s.codigo || s._id})</option>)}
                      </select>
                      <small style={{ color: theme.textMuted, fontSize: 11 }}>Recomendado para Recepcionista y Laboratorista</small>
                    </div>

                    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12, background: theme.surfaceMuted }}>
                      <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 8, display: 'block' }}>Permisos por módulo</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {PERMISSION_OPTIONS.map(p => (
                          <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.text }}>
                            <input
                              type="checkbox"
                              checked={!!formData.permissions?.[p.key]}
                              onChange={(e) => setFormData({
                                ...formData,
                                permissions: {
                                  ...(formData.permissions || {}),
                                  [p.key]: e.target.checked
                                }
                              })}
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" style={{ flex: 1, padding: 12, background: '#27ae60', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <FaSave /> {editando ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, background: theme.surfaceMuted, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const inputStyle = { padding: 12, borderRadius: 8, border: '1px solid var(--legacy-border)', background: 'var(--legacy-surface)', color: 'var(--legacy-text)', width: '100%', fontSize: 14, boxSizing: 'border-box' };

export default AdminUsuarios;
