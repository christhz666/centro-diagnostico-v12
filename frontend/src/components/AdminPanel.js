import React, { useState, useEffect, useRef } from 'react';
import {
  FaPalette, FaSave, FaSpinner, FaBuilding, FaImage,
  FaUpload, FaCheck, FaEye, FaTrash, FaCogs
} from 'react-icons/fa';
import api from '../services/api';
import AdminSucursales from './AdminSucursales';

/* ── Componente de carga de logo ────────────────────────────── */
function LogoUploader({ label, descripcion, fieldKey, value, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || '');
  const [drag, setDrag] = useState(false);

  useEffect(() => { setPreview(value || ''); }, [value]);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes (PNG, JPG, SVG, WebP)'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const b64 = canvas.toDataURL('image/webp', 0.8);
        setPreview(b64);
        onChange(fieldKey, b64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const limpiar = () => { setPreview(''); onChange(fieldKey, ''); inputRef.current && (inputRef.current.value = ''); };

  return (
    <div className="mb-6">
      <label className="block text-[#e1e2eb] font-semibold mb-1 text-sm">{label}</label>
      <p className="text-gray-600 dark:text-[#bacac7] text-xs mb-3">{descripcion}</p>

      {/* Área de drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed ${drag ? 'border-[#4afdef] bg-[#4afdef]/5' : 'border-gray-200 dark:border-white/10 bg-[#1d2026]/50'} rounded-xl p-5 text-center cursor-pointer hover:bg-white/5 transition-all flex flex-col items-center justify-center min-h-[120px] gap-4`}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt={label} className="max-h-20 max-w-[200px] object-contain rounded-lg shadow-lg" />
            <div className="flex items-center gap-4">
              <span className="text-xs text-[#00e0d3] font-bold flex items-center gap-1"><FaCheck /> Uploaded</span>
              <button type="button" onClick={e => { e.stopPropagation(); limpiar(); }} className="bg-[#93000a]/20 text-[#ffb4ab] border border-[#93000a]/50 rounded px-3 py-1 text-xs flex items-center gap-2 hover:bg-[#93000a]/40 transition-colors">
                <FaTrash /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="text-gray-600 dark:text-[#bacac7]">
            <FaUpload className="text-3xl mb-2 mx-auto opacity-50" />
            <div className="text-sm font-semibold text-[#e1e2eb]">Click or drag an image here</div>
            <div className="text-xs opacity-70 mt-1">PNG, JPG, SVG, WebP — Max 5MB</div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />

      {/* URL alternativa */}
      <input
        type="url"
        placeholder="Or paste image URL: https://..."
        value={preview.startsWith('data:') ? '' : preview}
        onChange={e => { setPreview(e.target.value); onChange(fieldKey, e.target.value); }}
        className="w-full mt-3 px-4 py-2.5 rounded-lg border-none bg-gray-100 dark:bg-[#32353c] text-sm text-[#e1e2eb] focus:ring-2 focus:ring-[#4afdef] transition-all placeholder:text-gray-600 dark:text-[#bacac7]/50"
      />
    </div>
  );
}

/* ── Sección contenedor ─────────────────────────────────────── */
function Seccion({ titulo, icono, children }) {
  return (
    <div className="bg-[rgba(29,32,38,0.7)] backdrop-blur-[24px] rounded-xl p-8 mb-6 border border-gray-200 dark:border-white/5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]">
      <h3 className="mb-6 text-[#e1e2eb] text-lg font-bold flex items-center gap-3 font-headline border-b border-gray-200 dark:border-white/5 pb-4">
        <span className="text-[#00e0d3] text-xl">{icono}</span> {titulo}
      </h3>
      {children}
    </div>
  );
}

/* ── Campo de texto ─────────────────────────────────────────── */
function Campo({ label, fieldKey, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="mb-4">
      <label className="block text-gray-600 dark:text-[#bacac7] font-semibold mb-2 text-xs uppercase tracking-wider">{label}</label>
      <input
        type={type} value={value || ''} placeholder={placeholder}
        onChange={e => onChange(fieldKey, e.target.value)}
        className="w-full px-4 py-3 rounded-lg border-none bg-gray-100 dark:bg-[#32353c] text-sm text-[#e1e2eb] focus:ring-2 focus:ring-[#4afdef]/50 outline-none transition-colors placeholder:text-gray-600 dark:text-[#bacac7]/30"
      />
    </div>
  );
}

/* ══════════ PANEL PRINCIPAL ════════════════════════════════ */
const AdminPanel = () => {
  const [config, setConfig] = useState({
    empresa_nombre: '',
    empresa_ruc: '',
    empresa_telefono: '',
    empresa_email: '',
    empresa_direccion: '',
    color_primario: '#4afdef',
    color_secundario: '#104f4a',
    color_acento: '#00e0d3',
    logo_login: '',
    logo_factura: '',
    logo_resultados: '',
    logo_sidebar: '',
    sucursal_rayos_x_id: '',
  });
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const cargar = async () => {
      try {
        const resp = await api.getConfiguracion();
        const data = resp?.configuracion || resp || {};
        setConfig(prev => ({ ...prev, ...data }));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    const cargarSucursales = async () => {
      try {
        const resp = await api.request('/sucursales');
        const data = Array.isArray(resp) ? resp : (resp?.data || resp?.sucursales || []);
        setSucursales(data);
      } catch (e) { console.error('Error cargando sucursales:', e); }
    };
    cargar();
    cargarSucursales();
  }, []);

  const set = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.updateConfiguracion(config);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <FaSpinner className="animate-spin text-4xl text-[#00e0d3]" />
      <p className="text-gray-600 dark:text-[#bacac7] font-medium tracking-wide">Initializing Core Engine...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto font-body text-[#e1e2eb]">
      <style>{`
        @keyframes pulse-ring {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 253, 239, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(74, 253, 239, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 253, 239, 0); }
        }
        .status-pulse { animation: pulse-ring 2s infinite; }
        .glass-panel { background: rgba(29, 32, 38, 0.7); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
        .glow-text { text-shadow: 0 0 15px rgba(74, 253, 239, 0.4); }
      `}</style>

      {/* Header Section */}
      <div className="mb-10 flex items-end justify-between">
        <div>
          <span className="text-gray-600 dark:text-[#bacac7] font-label text-[10px] tracking-[0.3em] uppercase block mb-1">System Environment</span>
          <h1 className="font-headline font-bold text-4xl text-[#e1e2eb] glow-text">System Administration</h1>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-3 mb-8 border-b border-gray-200 dark:border-white/5">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'general'
              ? 'border-[#00e0d3] text-[#00e0d3] bg-[#00e0d3]/5'
              : 'border-transparent text-gray-600 dark:text-[#bacac7] hover:text-[#e1e2eb] hover:bg-white/5'
            }`}>
          <FaCogs /> Core Configuration
        </button>
        <button
          onClick={() => setActiveTab('sucursales')}
          className={`px-6 py-3 font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'sucursales'
               ? 'border-[#00e0d3] text-[#00e0d3] bg-[#00e0d3]/5'
               : 'border-transparent text-gray-600 dark:text-[#bacac7] hover:text-[#e1e2eb] hover:bg-white/5'
            }`}>
          <FaBuilding /> Branches & Nodes
        </button>
      </div>

      {activeTab === 'general' ? (
        <form onSubmit={guardar}>
          {/* ── Datos de la empresa ── */}
          <Seccion titulo="Clinic Organization Data" icono={<FaBuilding />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <Campo label="Enterprise Name" fieldKey="empresa_nombre" value={config.empresa_nombre} onChange={set} placeholder="MedTech Diagnostic Hub" />
              <Campo label="Registration / RUC" fieldKey="empresa_ruc" value={config.empresa_ruc} onChange={set} placeholder="1-23-45678-9" />
              <Campo label="Primary Contact" fieldKey="empresa_telefono" value={config.empresa_telefono} onChange={set} placeholder="(809) 000-0000" />
              <Campo label="Support Email" fieldKey="empresa_email" value={config.empresa_email} onChange={set} type="email" placeholder="sysadmin@medtech.os" />
              <div className="md:col-span-2">
                <Campo label="Headquarters Address" fieldKey="empresa_direccion" value={config.empresa_direccion} onChange={set} placeholder="Main Terminal Sector 7" />
              </div>
            </div>
          </Seccion>

          {/* ── Logos ── */}
          <Seccion titulo="System Assets & Branding" icono={<FaImage />}>
            <p className="bg-[#4afdef]/10 text-[#00e0d3] border-l-4 border-[#00e0d3] mb-6 text-xs p-4 rounded-r-lg flex items-center gap-3">
              <FaCheck className="text-lg" />
              <span><strong>Optimization Notice:</strong> Upload transparent PNGs or WebPs. Assets are encoded and stored directly in the core engine DB.</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <LogoUploader
                label="Authentication Portal Logo"
                descripcion="Appears on the login screen. Optimal: 300×100px."
                fieldKey="logo_login"
                value={config.logo_login}
                onChange={set}
              />
              <LogoUploader
                label="Invoice Print Logo"
                descripcion="Thermal and A4 invoice header. Optimal: 250×80px."
                fieldKey="logo_factura"
                value={config.logo_factura}
                onChange={set}
              />
              <LogoUploader
                label="Clinical Results Logo"
                descripcion="Lab and Imaging reports header. Optimal: 300×100px."
                fieldKey="logo_resultados"
                value={config.logo_resultados}
                onChange={set}
              />
              <LogoUploader
                label="Navigation Rail Logo"
                descripcion="Top of the sidebar. Optimal: 160×50px."
                fieldKey="logo_sidebar"
                value={config.logo_sidebar}
                onChange={set}
              />
            </div>
          </Seccion>

          {/* ── Colores ── */}
          <Seccion titulo="UI Color Overrides" icono={<FaPalette />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Primary Accent', key: 'color_primario', defecto: '#4afdef', desc: 'Main buttons, active signals' },
                { label: 'Secondary Tone', key: 'color_secundario', defecto: '#104f4a', desc: 'Background tints, borders' },
                { label: 'Luminous Highlight', key: 'color_acento', defecto: '#00e0d3', desc: 'Avatars, glows, charts' },
              ].map(({ label, key, defecto, desc }) => (
                <div key={key} className="bg-[#191c22] border border-gray-200 dark:border-white/5 rounded-xl p-5">
                  <label className="block font-bold text-[#e1e2eb] text-sm mb-1">{label}</label>
                  <p className="text-gray-600 dark:text-[#bacac7] text-xs mb-3">{desc}</p>
                  <div className="flex gap-3 items-center">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 shadow-lg">
                      <input type="color" value={config[key] || defecto}
                        onChange={e => set(key, e.target.value)}
                        className="absolute inset-[-10px] w-16 h-16 cursor-pointer" />
                    </div>
                    <input type="text" value={config[key] || defecto}
                      onChange={e => set(key, e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border-none bg-gray-100 dark:bg-[#32353c] text-sm font-mono text-[#00e0d3] focus:ring-1 focus:ring-[#4afdef] outline-none" />
                  </div>
                </div>
              ))}
            </div>
          </Seccion>

          {/* ── Sucursal de Rayos X ── */}
          <Seccion titulo="Imaging Processing Node (X-Ray)" icono={<FaSpinner className="rotate-45" />}>
            <p className="text-gray-600 dark:text-[#bacac7] text-xs mb-4">
              Patients registering for Imaging/X-Ray are automatically routed to this processing node. All distributed branches can fetch the final rendering.
            </p>
            <div className="mb-2">
              <label className="block text-gray-600 dark:text-[#bacac7] font-semibold mb-2 text-xs uppercase tracking-wider">Designated X-Ray Node</label>
              <select
                value={config.sucursal_rayos_x_id || ''}
                onChange={e => set('sucursal_rayos_x_id', e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-none bg-gray-100 dark:bg-[#32353c] text-sm text-[#e1e2eb] focus:ring-2 focus:ring-[#4afdef] outline-none transition-colors"
              >
                <option value="">-- Dynamic Routing (Current Branch) --</option>
                {sucursales.map(s => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.nombre || s.name} {s.tipo ? `(${s.tipo})` : ''}
                  </option>
                ))}
              </select>
              {sucursales.length === 0 && (
                <p className="text-[#ffb4ab] text-xs mt-2 font-medium">
                  Zero active nodes detected. Deploy branches in the "Branches & Nodes" panel.
                </p>
              )}
            </div>
          </Seccion>

          {/* ── Botón guardar ── */}
          <button type="submit" disabled={guardando} className={`w-full p-4 rounded-xl flex items-center justify-center gap-3 font-bold text-sm tracking-wide transition-all duration-300 ${
            guardado 
              ? 'bg-[#104f4a] text-[#00e0d3] border-none shadow-[0_0_20px_rgba(0,224,211,0.2)]'
              : 'bg-gradient-to-r from-[#4afdef] to-[#00e0d3] text-[#00201e] hover:scale-[1.01] active:scale-[0.99] shadow-[0_4px_15px_rgba(0,224,211,0.2)] hover:shadow-[0_8px_25px_rgba(0,224,211,0.4)]'
          }`}>
            {guardando ? <FaSpinner className="animate-spin text-lg" /> : guardado ? <FaCheck className="text-lg" /> : <FaSave className="text-lg" />}
            {guardando ? 'COMMITTING CHANGES TO CORE...' : guardado ? 'SYSTEM CONFIGURATION SYNCED' : 'SAVE CONFIGURATION'}
          </button>

          {/* Preview de logos guardados */}
          {(config.logo_login || config.logo_factura || config.logo_resultados) && (
            <div className="mt-8 bg-[#191c22] rounded-xl p-6 border border-gray-200 dark:border-white/5">
              <h4 className="text-gray-600 dark:text-[#bacac7] text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <FaEye className="text-[#00e0d3]" /> Encoded Assets Preview
              </h4>
              <div className="flex gap-6 flex-wrap items-end">
                {[
                  { src: config.logo_login, label: 'Auth Portal' },
                  { src: config.logo_factura, label: 'Invoice' },
                  { src: config.logo_resultados, label: 'Results' },
                  { src: config.logo_sidebar, label: 'Nav Rail' },
                ].filter(l => l.src).map(({ src, label }) => (
                  <div key={label} className="text-center group">
                    <div className="bg-[#1d2026] border border-gray-200 dark:border-white/5 rounded-lg p-3 mb-2 shadow-lg group-hover:border-[#4afdef]/30 transition-colors">
                      <img src={src} alt={label} className="max-h-12 max-w-[120px] object-contain" />
                    </div>
                    <div className="text-[10px] text-gray-600 dark:text-[#bacac7] uppercase font-bold tracking-wider">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      ) : (
        <AdminSucursales />
      )}
      
      {/* Footer Area */}
      <footer className="mt-16 flex items-center justify-between border-t border-gray-200 dark:border-white/5 pt-6">
          <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#00e0d3] status-pulse"></div>
              </div>
              <div className="flex items-baseline gap-2">
                  <span className="text-[#00e0d3] font-headline text-xs font-bold tracking-widest uppercase">Core Engine Online</span>
                  <span className="text-gray-600 dark:text-[#bacac7]/40 text-[10px] font-medium">V4.8.2-STABLE</span>
              </div>
          </div>
          <div className="text-[10px] text-gray-600 dark:text-[#bacac7]/40 uppercase tracking-[0.2em] font-medium">
              © 2026 Clinical Curator Systems
          </div>
      </footer>
    </div>
  );
};

export default AdminPanel;
