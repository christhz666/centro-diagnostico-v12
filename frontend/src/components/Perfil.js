import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaKey, FaSave, FaSignature, FaTrashAlt, FaUpload, FaUserCircle } from 'react-icons/fa';
import api from '../services/api';

const theme = {
  surface: 'var(--legacy-surface)',
  surfaceMuted: 'var(--legacy-surface-muted)',
  panel: 'var(--legacy-surface-panel)',
  border: 'var(--legacy-border)',
  borderSoft: 'var(--legacy-border-soft)',
  text: 'var(--legacy-text)',
  textStrong: 'var(--legacy-text-strong)',
  textMuted: 'var(--legacy-text-muted)',
  accent: 'var(--legacy-accent-strong)'
};

const FIRMAS_PERMITIDAS = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WebP'
};
const FIRMA_ACCEPT = '.png,.jpg,.jpeg,.webp';
const FIRMA_MAX_BYTES = 5 * 1024 * 1024;
const FIRMA_FORMATOS_TEXTO = Object.values(FIRMAS_PERMITIDAS).join(', ');

function Perfil({ user, onUserUpdate }) {
  const [perfil, setPerfil] = useState({
    nombre: user?.nombre || '',
    apellido: user?.apellido || '',
    telefono: user?.telefono || '',
    firmaDigital: user?.firmaDigital || ''
  });
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [mensajePerfil, setMensajePerfil] = useState('');
  const [mensajeFirma, setMensajeFirma] = useState('');
  const [mensajePassword, setMensajePassword] = useState('');
  const [errorPerfil, setErrorPerfil] = useState('');
  const [errorFirma, setErrorFirma] = useState('');
  const [errorPassword, setErrorPassword] = useState('');
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoFirma, setGuardandoFirma] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    setPerfil({
      nombre: user?.nombre || '',
      apellido: user?.apellido || '',
      telefono: user?.telefono || '',
      firmaDigital: user?.firmaDigital || ''
    });
  }, [user]);

  const sincronizarSesion = useCallback((usuarioActualizado) => {
    [window.localStorage, window.sessionStorage].forEach((storage) => {
      try {
        const raw = storage.getItem('user');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        storage.setItem('user', JSON.stringify({ ...parsed, ...usuarioActualizado }));
      } catch (err) {
        console.error('No se pudo sincronizar el usuario en sesion:', err);
      }
    });

    onUserUpdate?.(usuarioActualizado);
  }, [onUserUpdate]);

  const limpiarCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const obtenerLimitesFirma = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const a = data[offset + 3];
        const esFondo = a === 0 || (r >= 245 && g >= 245 && b >= 245);

        if (esFondo) continue;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX === -1 || maxY === -1) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }, []);

  const dibujarFirmaEnCanvas = useCallback((firmaSrc) => {
    const canvas = canvasRef.current;
    if (!canvas || !firmaSrc) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const imagen = new Image();
      imagen.onload = () => {
        const ctx = canvas.getContext('2d');
        const padding = 16;
        const maxWidth = canvas.width - padding * 2;
        const maxHeight = canvas.height - padding * 2;
        const scale = Math.min(maxWidth / imagen.width, maxHeight / imagen.height, 1);
        const drawWidth = imagen.width * scale;
        const drawHeight = imagen.height * scale;
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;

        limpiarCanvas();
        ctx.drawImage(imagen, offsetX, offsetY, drawWidth, drawHeight);
        resolve();
      };
      imagen.onerror = () => reject(new Error('No se pudo preparar la imagen de la firma.'));
      imagen.src = firmaSrc;
    });
  }, [limpiarCanvas]);

  useEffect(() => {
    if (!perfil.firmaDigital) {
      limpiarCanvas();
      return;
    }

    dibujarFirmaEnCanvas(perfil.firmaDigital).catch((err) => {
      console.error('No se pudo dibujar la firma activa:', err);
    });
  }, [dibujarFirmaEnCanvas, limpiarCanvas, perfil.firmaDigital]);

  const obtenerPunto = useCallback((event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    if (event.touches?.[0]) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }, []);

  const iniciarTrazo = useCallback((event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = obtenerPunto(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [obtenerPunto]);

  const moverTrazo = useCallback((event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = obtenerPunto(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [obtenerPunto]);

  const terminarTrazo = useCallback((event) => {
    event?.preventDefault?.();
    drawingRef.current = false;
  }, []);

  const canvasTieneTrazos = useCallback(() => {
    return Boolean(obtenerLimitesFirma());
  }, [obtenerLimitesFirma]);

  const exportarFirmaDesdeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const limites = obtenerLimitesFirma();
    if (!canvas || !limites) return '';

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const ctx = exportCanvas.getContext('2d');
    const padding = 16;
    const maxWidth = exportCanvas.width - padding * 2;
    const maxHeight = exportCanvas.height - padding * 2;
    const scale = Math.min(maxWidth / limites.width, maxHeight / limites.height);
    const drawWidth = limites.width * scale;
    const drawHeight = limites.height * scale;
    const offsetX = (exportCanvas.width - drawWidth) / 2;
    const offsetY = (exportCanvas.height - drawHeight) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      canvas,
      limites.x,
      limites.y,
      limites.width,
      limites.height,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    return exportCanvas.toDataURL('image/png');
  }, [obtenerLimitesFirma]);

  const guardarPerfil = async () => {
    setErrorPerfil('');
    setMensajePerfil('');
    setGuardandoPerfil(true);

    try {
      const response = await api.updateProfile({
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        telefono: perfil.telefono,
        firmaDigital: perfil.firmaDigital
      });
      const usuarioActualizado = response?.user || response?.data || response || {};
      sincronizarSesion(usuarioActualizado);
      setMensajePerfil('Perfil actualizado correctamente');
    } catch (err) {
      setErrorPerfil(err.message || 'No se pudo guardar el perfil');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const persistirFirma = useCallback(async (firmaDigital, mensajeExito) => {
    const response = await api.updateProfile({ firmaDigital });
    const usuarioActualizado = response?.user || response?.data || response || {};
    const firmaPersistida = usuarioActualizado.firmaDigital !== undefined
      ? usuarioActualizado.firmaDigital
      : firmaDigital;
    setPerfil((prev) => ({ ...prev, firmaDigital: firmaPersistida }));
    sincronizarSesion({ ...usuarioActualizado, firmaDigital: firmaPersistida });
    setMensajeFirma(mensajeExito);
    return firmaPersistida;
  }, [sincronizarSesion]);

  const guardarFirma = async () => {
    setErrorFirma('');
    setMensajeFirma('');

    if (!canvasTieneTrazos()) {
      setErrorFirma('Debe dibujar una firma antes de guardarla.');
      return;
    }

    setGuardandoFirma(true);
    try {
      const firmaDigital = exportarFirmaDesdeCanvas();
      if (!firmaDigital) {
        throw new Error('No se pudo preparar la firma para guardarla.');
      }
      await persistirFirma(firmaDigital, 'Firma guardada y lista para toda la sesion.');
    } catch (err) {
      setErrorFirma(err.message || 'No se pudo guardar la firma');
    } finally {
      setGuardandoFirma(false);
    }
  };

  const cargarFirmaDesdeArchivo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setErrorFirma('');
    setMensajeFirma('');

    const tipoArchivo = (file.type || '').toLowerCase();
    const extensionValida = /\.(png|jpe?g|webp)$/i.test(file.name || '');
    const formatoValido = Boolean(FIRMAS_PERMITIDAS[tipoArchivo] || (!tipoArchivo && extensionValida));

    if (!formatoValido) {
      setErrorFirma(`Solo puede cargar firmas en ${FIRMA_FORMATOS_TEXTO}.`);
      return;
    }

    if (file.size > FIRMA_MAX_BYTES) {
      setErrorFirma(`La imagen supera el maximo permitido de ${Math.round(FIRMA_MAX_BYTES / (1024 * 1024))} MB.`);
      return;
    }

    setGuardandoFirma(true);
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
      await dibujarFirmaEnCanvas(objectUrl);
      setMensajeFirma('Imagen cargada correctamente. Revise el lienzo y pulse "Guardar firma".');
    } catch (err) {
      setErrorFirma(err.message || 'No se pudo cargar la firma');
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setGuardandoFirma(false);
    }
  };

  const eliminarFirma = async () => {
    setErrorFirma('');
    setMensajeFirma('');
    setGuardandoFirma(true);

    try {
      await persistirFirma('', 'Firma eliminada.');
      limpiarCanvas();
    } catch (err) {
      setErrorFirma(err.message || 'No se pudo eliminar la firma');
    } finally {
      setGuardandoFirma(false);
    }
  };

  const cambiarPassword = async () => {
    setErrorPassword('');
    setMensajePassword('');

    if (!passwordActual || !passwordNuevo || !passwordConfirm) {
      setErrorPassword('Complete los tres campos de seguridad.');
      return;
    }

    if (passwordNuevo.length < 8) {
      setErrorPassword('La nueva clave debe tener al menos 8 caracteres.');
      return;
    }

    if (passwordNuevo !== passwordConfirm) {
      setErrorPassword('La confirmacion no coincide con la nueva clave.');
      return;
    }

    setGuardandoPassword(true);
    try {
      await api.changePassword(passwordActual, passwordNuevo);
      setMensajePassword('Clave actualizada correctamente.');
      setPasswordActual('');
      setPasswordNuevo('');
      setPasswordConfirm('');
    } catch (err) {
      setErrorPassword(err.message || 'No se pudo cambiar la clave');
    } finally {
      setGuardandoPassword(false);
    }
  };

  const baseInput = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    background: theme.surface,
    color: theme.text,
    outline: 'none'
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, display: 'grid', gap: 20 }}>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, #0f172a, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            <FaUserCircle />
          </div>
          <div>
            <h2 style={{ margin: 0, color: theme.textStrong }}>Mi Perfil</h2>
            <p style={{ margin: '6px 0 0', color: theme.textMuted }}>
              La firma digital que guarde aqui se aplica automaticamente a resultados validados, reportes de imagenologia e impresiones de esta sesion.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)', gap: 20 }}>
        <section style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 22 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, color: theme.textStrong }}>Datos del usuario</h3>

          {mensajePerfil && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#166534', border: '1px solid #86efac' }}>{mensajePerfil}</div>}
          {errorPerfil && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{errorPerfil}</div>}

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Nombre</label>
              <input value={perfil.nombre} onChange={(e) => setPerfil((prev) => ({ ...prev, nombre: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Apellido</label>
              <input value={perfil.apellido} onChange={(e) => setPerfil((prev) => ({ ...prev, apellido: e.target.value }))} style={baseInput} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Telefono</label>
              <input value={perfil.telefono} onChange={(e) => setPerfil((prev) => ({ ...prev, telefono: e.target.value }))} style={baseInput} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Usuario</label>
                <div style={{ ...baseInput, background: theme.surfaceMuted }}>{user?.username || 'Sin usuario'}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Correo</label>
                <div style={{ ...baseInput, background: theme.surfaceMuted }}>{user?.email || 'Sin correo'}</div>
              </div>
            </div>
          </div>

          <button onClick={guardarPerfil} disabled={guardandoPerfil} style={{ marginTop: 18, padding: '12px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #1d4ed8, #0f172a)', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <FaSave /> {guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </section>

        <section style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <FaSignature style={{ color: theme.accent }} />
            <h3 style={{ margin: 0, color: theme.textStrong }}>Firma digital</h3>
          </div>

          {mensajeFirma && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#166534', border: '1px solid #86efac' }}>{mensajeFirma}</div>}
          {errorFirma && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{errorFirma}</div>}

          <div style={{ padding: 14, borderRadius: 14, border: `1px solid ${theme.borderSoft}`, background: theme.surfaceMuted, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 10 }}>Firma activa en la sesion</div>
            {perfil.firmaDigital ? (
              <div style={{ textAlign: 'center' }}>
                <img src={perfil.firmaDigital} alt="Firma guardada" style={{ maxWidth: '100%', maxHeight: 96, objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ color: theme.textMuted }}>Todavia no hay una firma guardada para este usuario.</div>
            )}
          </div>

          <div style={{ marginBottom: 10, color: theme.textMuted, fontSize: 13 }}>
            Puede dibujar una firma nueva o cargar una imagen ya preparada en el lienzo. Formatos soportados: {FIRMA_FORMATOS_TEXTO}. Luego pulse "Guardar firma" para dejarla activa en toda la sesion.
          </div>

          <canvas
            ref={canvasRef}
            width={520}
            height={180}
            style={{ width: '100%', background: '#ffffff', borderRadius: 14, border: '2px solid #dbeafe', cursor: 'crosshair', touchAction: 'none' }}
            onMouseDown={iniciarTrazo}
            onMouseMove={moverTrazo}
            onMouseUp={terminarTrazo}
            onMouseLeave={terminarTrazo}
            onTouchStart={iniciarTrazo}
            onTouchMove={moverTrazo}
            onTouchEnd={terminarTrazo}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={FIRMA_ACCEPT}
            onChange={cargarFirmaDesdeArchivo}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button onClick={guardarFirma} disabled={guardandoFirma} style={{ padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#111827', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FaSignature /> {guardandoFirma ? 'Guardando...' : 'Guardar firma'}
            </button>
            <button onClick={() => fileInputRef.current?.click()} type="button" disabled={guardandoFirma} style={{ padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#1d4ed8', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FaUpload /> Cargar imagen
            </button>
            <button onClick={limpiarCanvas} type="button" style={{ padding: '11px 16px', borderRadius: 12, border: `1px solid ${theme.border}`, cursor: 'pointer', background: theme.panel, color: theme.text, fontWeight: 700 }}>
              Limpiar lienzo
            </button>
            <button onClick={eliminarFirma} disabled={guardandoFirma || !perfil.firmaDigital} type="button" style={{ padding: '11px 16px', borderRadius: 12, border: 'none', cursor: perfil.firmaDigital ? 'pointer' : 'not-allowed', background: perfil.firmaDigital ? '#b91c1c' : '#cbd5e1', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FaTrashAlt /> Eliminar firma actual
            </button>
          </div>
        </section>
      </div>

      <section style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <FaKey style={{ color: theme.accent }} />
          <h3 style={{ margin: 0, color: theme.textStrong }}>Seguridad</h3>
        </div>

        {mensajePassword && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#166534', border: '1px solid #86efac' }}>{mensajePassword}</div>}
        {errorPassword && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{errorPassword}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Clave actual</label>
            <input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} style={baseInput} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Nueva clave</label>
            <input type="password" value={passwordNuevo} onChange={(e) => setPasswordNuevo(e.target.value)} style={baseInput} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: theme.textMuted, fontSize: 13 }}>Confirmar nueva clave</label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} style={baseInput} />
          </div>
        </div>

        <button onClick={cambiarPassword} disabled={guardandoPassword} style={{ marginTop: 18, padding: '12px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#0f766e', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <FaKey /> {guardandoPassword ? 'Actualizando...' : 'Cambiar clave'}
        </button>
      </section>
    </div>
  );
}

export default Perfil;
