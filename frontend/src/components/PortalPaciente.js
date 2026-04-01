import React, { useState, useEffect } from 'react';
import { FaFlask, FaLock, FaUser, FaSpinner, FaCheckCircle, FaClock, FaQrcode, FaExclamationTriangle, FaHospital, FaArrowLeft, FaPrint, FaDownload } from 'react-icons/fa';
import html2pdf from 'html2pdf.js';

/* ─── Paleta de colores mejorada ─────────────────────────────────────── */
const C = {
  dark: '#0a1e2f',
  mid: '#1a3a5c',
  blue: '#2980b9',
  sky: '#5dade2',
  accent: '#3498db',
  accentLight: '#5dade2',
  green: '#27ae60',
  greenLight: '#52c77a',
  red: '#e74c3c',
  orange: '#f39c12',
  white: '#fff',
  gray: '#95a5a6',
  grayLight: '#ecf0f1',
};

const theme = {
  surface: 'var(--legacy-surface)',
  surfaceMuted: 'var(--legacy-surface-muted)',
  panel: 'var(--legacy-surface-panel)',
  border: 'var(--legacy-border)',
  text: 'var(--legacy-text)',
  textStrong: 'var(--legacy-text-strong)',
  textMuted: 'var(--legacy-text-muted)'
};

/* ─── Helpers ───────────────────────────────────────────────── */
const QR_VALIDATION_TIMEOUT = 10000;
const QR_FALLBACK_TIMEOUT = 15000;

const getFmtMoney = (n) =>
  `RD$ ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const calcularEdad = (fecha) => {
  if (!fecha) return 'N/A';
  const hoy = new Date();
  const nac = new Date(fecha);
  let e = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
  return `${e} años`;
};

const getEstadoColor = (estado) => {
  if (estado === 'normal') return '#4CAF50';
  if (estado === 'alto') return '#FF5722';
  if (estado === 'bajo') return '#2196F3';
  return '#FF9800';
};

const fmtParametro = (p) => (p || '').replace(/_/g, ' ');

const EstadoBadge = ({ estado }) => {
  const cfg = {
    pendiente: { bg: 'linear-gradient(135deg, #fff3cd, #ffe69c)', color: '#856404', label: '⏳ Pendiente', border: '#ffc107' },
    en_proceso: { bg: 'linear-gradient(135deg, #cce5ff, #99ccff)', color: '#004085', label: '🔬 En Proceso', border: '#0066cc' },
    completado: { bg: 'linear-gradient(135deg, #d4edda, #b2dfb8)', color: '#155724', label: '✅ Disponible', border: '#28a745' },
    entregado: { bg: 'linear-gradient(135deg, #d4edda, #b2dfb8)', color: '#155724', label: '✅ Entregado', border: '#28a745' },
  };
  const c = cfg[estado] || { bg: theme.surfaceMuted, color: theme.textMuted, label: estado || 'Desconocido', border: theme.border };
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: '6px 14px', borderRadius: 14, fontSize: 12, fontWeight: 'bold',
      display: 'inline-block',
      border: `2px solid ${c.border}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      {c.label}
    </span>
  );
};

/* ─── Componente principal ──────────────────────────────────── */
const PortalPaciente = () => {
  /* Detección de modo QR en URL */
  const params = new URLSearchParams(window.location.search);
  const qrParam = params.get('qr');

  const [modo, setModo] = useState(qrParam ? 'cargando-qr' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState(null);
  const [bloqueo, setBloqueo] = useState(null); // { montoPendiente, totalFactura, mensaje }
  const [empresaNombre, setEmpresaNombre] = useState('Centro Diagnóstico');

  /* ── Fallback: si después de 15s sigue en cargando-qr, mostrar login ── */
  useEffect(() => {
    if (modo !== 'cargando-qr') return;
    const timeout = setTimeout(() => {
      setModo('login');
      setError('No se pudo verificar el código QR. Por favor, ingrese sus credenciales.');
      setLoading(false);
    }, QR_FALLBACK_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [modo]);

  /* ── Cargar nombre de empresa ── */
  useEffect(() => {
    fetch('/api/configuracion/empresa')
      .then(r => r.json())
      .then(data => {
        const nombre = data?.nombre || data?.empresa_nombre;
        if (nombre) setEmpresaNombre(nombre);
      })
      .catch(() => {});
  }, []);

  /* ── Validar QR pero requerir confirmación con contraseña ── */
  useEffect(() => {
    if (!qrParam) return;
    const validarQR = async () => {
      setLoading(true);
      try {
        // Timeout de 10 segundos para evitar que se quede cargando indefinidamente
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), QR_VALIDATION_TIMEOUT);

        // Validar que el QR existe y obtener info de la factura
        const res = await fetch(`/api/verificar/${encodeURIComponent(qrParam)}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          setError('Código QR inválido o expirado');
          setModo('login');
          return;
        }

        const data = await res.json();

        if (data.valido) {
          // QR válido - mostrar pantalla de login con mensaje
          setModo('login-qr');
          setError('');
        } else {
          setError(data.mensaje || 'Código QR inválido o expirado');
          setModo('login');
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          setError('Tiempo de espera agotado. Verifique su conexión e intente de nuevo.');
        } else {
          setError('Error al validar código QR. Verifique su conexión.');
        }
        setModo('login');
      } finally {
        setLoading(false);
      }
    };
    validarQR();
  }, [qrParam]);

  /* ── Login con usuario/contraseña (ahora requiere auth incluso con QR) ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Complete usuario y contraseña'); return; }
    setLoading(true);
    setError('');

    console.log('[PortalPaciente] Iniciando login...', { username, hasQR: !!qrParam });

    try {
      // Si hay QR, primero validar credenciales y luego usar el QR para obtener resultados
      if (qrParam) {
        console.log('[PortalPaciente] Login con QR:', qrParam);
        // Validar credenciales primero, enviando el QR para asegurar que pertenezcan al mismo dueño
        const authRes = await fetch('/api/resultados/acceso-paciente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, qrCode: qrParam })
        });
        const authData = await authRes.json();

        console.log('[PortalPaciente] Respuesta de autenticación:', { success: authData.success, blocked: authData.blocked });

        if (!authData.success && !authData.blocked) {
          setError(authData.message || 'Usuario o contraseña incorrectos');
          setLoading(false);
          return;
        }

        // Si autenticó exitosamente, ahora usar el QR para obtener los resultados específicos
        const res = await fetch(`/api/resultados/acceso-qr/${encodeURIComponent(qrParam)}`);
        const data = await res.json();

        console.log('[PortalPaciente] Respuesta de acceso QR:', { success: data.success, blocked: data.blocked, count: data.count });

        if (data.blocked) {
          setBloqueo({
            montoPendiente: data.montoPendiente,
            totalFactura: data.totalFactura,
            montoPagado: data.montoPagado,
            mensaje: data.mensaje,
            factura: data.factura
          });
          setModo('bloqueado');
        } else if (data.success) {
          console.log('[PortalPaciente] Resultados cargados:', data.count || 0, 'resultados');
          setDatos(data);
          setModo('resultados');
        } else {
          setError(data.message || 'Error al cargar resultados');
        }
      } else {
        console.log('[PortalPaciente] Login normal (sin QR)');
        // Login normal sin QR
        const res = await fetch('/api/resultados/acceso-paciente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        console.log('[PortalPaciente] Respuesta de login:', { success: data.success, blocked: data.blocked, count: data.count });

        if (data.blocked) {
          setBloqueo({
            montoPendiente: data.montoPendiente,
            totalFactura: data.totalFactura,
            montoPagado: data.montoPagado,
            mensaje: data.mensaje,
            factura: data.factura
          });
          setModo('bloqueado');
        } else if (data.success) {
          console.log('[PortalPaciente] Resultados cargados:', data.count || 0, 'resultados');
          setDatos(data);
          setModo('resultados');
        } else {
          setError(data.message || 'Usuario o contraseña incorrectos');
        }
      }
    } catch (err) {
      console.error('[PortalPaciente] Error en login:', err);
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Imprimir un resultado ── */
  const imprimirResultado = (r) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const firmaHtml = r.firmaDigital
      ? `<div style="text-align:center;margin-top:25px;margin-bottom:8px"><img src="${r.firmaDigital}" alt="Firma del médico" style="max-width:220px;max-height:70px;object-fit:contain" /></div>`
      : '';
    const valorCards = (r.valores || []).map(v => `
      <div style="background:white;border:1px solid #e0e0e0;border-left:4px solid ${getEstadoColor(v.estado || 'normal')};border-radius:8px;padding:15px;margin-bottom:10px;break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:14px;text-transform:uppercase">${fmtParametro(v.parametro)}</strong>
          <span style="background:${getEstadoColor(v.estado || 'normal')};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:bold">${(v.estado || 'N/A').toUpperCase()}</span>
        </div>
        <div style="font-size:22px;font-weight:bold;color:#2c3e50;margin-bottom:4px">${v.valor || ''} <span style="font-size:14px;color:#999;font-weight:normal">${v.unidad || ''}</span></div>
        <div style="font-size:12px;color:#888">Rango: ${v.valorReferencia || '-'}</div>
      </div>`).join('');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Resultado - ${empresaNombre}</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:30px;color:#2c3e50}
      @media print{button{display:none !important} .no-print{display:none !important}}</style></head><body>
      <div style="text-align:center;border-bottom:3px solid #2c3e50;padding-bottom:15px;margin-bottom:25px">
        <h1 style="color:#2c3e50;margin:0 0 5px;font-size:24px">${empresaNombre}</h1>
        <p style="color:#666;margin:0;font-size:13px">Análisis de Laboratorio Clínico</p>
      </div>
      <div style="background:#f0f8ff;padding:20px;border-radius:10px;margin-bottom:25px;border:1px solid #bee5eb">
        <h4 style="margin:0 0 12px;color:#2c3e50;font-size:14px">👤 Información del Paciente</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px">
          <div><strong>Nombre:</strong> ${datos?.paciente?.nombre || ''} ${datos?.paciente?.apellido || ''}</div>
          <div><strong>Cédula:</strong> ${datos?.paciente?.cedula || 'N/A'}</div>
          <div><strong>Sexo:</strong> ${datos?.paciente?.sexo === 'M' ? 'Masculino' : 'Femenino'}</div>
          <div><strong>Fecha:</strong> ${new Date(r.createdAt).toLocaleDateString('es-DO')}</div>
        </div>
      </div>
      <h3 style="color:#2c3e50;border-bottom:2px solid #eee;padding-bottom:8px;margin-bottom:15px">🔬 ${r.estudio?.nombre || 'Resultado'}</h3>
      <div style="display:grid;gap:10px">${valorCards || '<p style="text-align:center;padding:20px;color:#888">Sin valores registrados</p>'}</div>
      ${r.interpretacion ? `<div style="background:#fff3e0;border-left:4px solid #FF9800;padding:15px;margin-top:20px;border-radius:5px">
        <h4 style="margin:0 0 8px;color:#e65100;font-size:14px">📋 Interpretación Médica</h4><p style="margin:0;font-size:14px">${r.interpretacion}</p></div>` : ''}
      ${firmaHtml}
      ${(r.firmadoPor || r.validadoPor) ? `<p style="margin-top:8px;text-align:center;font-size:14px;color:#555">✅ Firmado por: Dr. ${r.firmadoPor?.nombre || r.validadoPor?.nombre || ''} ${r.firmadoPor?.apellido || r.validadoPor?.apellido || ''}</p>` : ''}
      <div style="text-align:center;margin-top:30px;padding:12px;background:#2c3e50;color:white;border-radius:8px;font-size:13px"><strong>Gracias por confiar en nosotros</strong> · Su salud es nuestra prioridad</div>
      <script>
        window.addEventListener('load', function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 250);
        });
        window.addEventListener('afterprint', function () {
          setTimeout(function () {
            window.close();
          }, 150);
        });
      </script>
    </body></html>`);
    win.document.close();
    
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);
  };

  /* ── Descargar un resultado como PDF ── */
  const descargarPDF = (r) => {
    const firmaHtml = r.firmaDigital
      ? `<div style="text-align:center;margin-top:25px;margin-bottom:8px"><img src="${r.firmaDigital}" alt="Firma del médico" style="max-width:220px;max-height:70px;object-fit:contain" /></div>`
      : '';
    const valorCards = (r.valores || []).map(v => `
      <div style="background:white;border:1px solid #e0e0e0;border-left:4px solid ${getEstadoColor(v.estado || 'normal')};border-radius:8px;padding:15px;margin-bottom:10px;break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:14px;text-transform:uppercase">${fmtParametro(v.parametro)}</strong>
          <span style="background:${getEstadoColor(v.estado || 'normal')};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:bold">${(v.estado || 'N/A').toUpperCase()}</span>
        </div>
        <div style="font-size:22px;font-weight:bold;color:#2c3e50;margin-bottom:4px">${v.valor || ''} <span style="font-size:14px;color:#999;font-weight:normal">${v.unidad || ''}</span></div>
        <div style="font-size:12px;color:#888">Rango: ${v.valorReferencia || '-'}</div>
      </div>`).join('');
    
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#2c3e50;background:white">
        <div style="text-align:center;border-bottom:3px solid #2c3e50;padding-bottom:15px;margin-bottom:25px">
          <h1 style="color:#2c3e50;margin:0 0 5px;font-size:24px">${empresaNombre}</h1>
          <p style="color:#666;margin:0;font-size:13px">Análisis de Laboratorio Clínico</p>
        </div>
        <div style="background:#f0f8ff;padding:20px;border-radius:10px;margin-bottom:25px;border:1px solid #bee5eb">
          <h4 style="margin:0 0 12px;color:#2c3e50;font-size:14px">👤 Información del Paciente</h4>
          <div style="display:flex;flex-wrap:wrap;gap:15px;font-size:14px">
            <div style="flex:1;min-width:200px"><strong>Nombre:</strong> ${datos?.paciente?.nombre || ''} ${datos?.paciente?.apellido || ''}</div>
            <div style="flex:1;min-width:150px"><strong>Cédula:</strong> ${datos?.paciente?.cedula || 'N/A'}</div>
            <div style="flex:1;min-width:150px"><strong>Sexo:</strong> ${datos?.paciente?.sexo === 'M' ? 'Masculino' : 'Femenino'}</div>
            <div style="flex:1;min-width:150px"><strong>Fecha:</strong> ${new Date(r.createdAt).toLocaleDateString('es-DO')}</div>
          </div>
        </div>
        <h3 style="color:#2c3e50;border-bottom:2px solid #eee;padding-bottom:8px;margin-bottom:15px">🔬 ${r.estudio?.nombre || 'Resultado'}</h3>
        <div style="display:grid;gap:10px">${valorCards || '<p style="text-align:center;padding:20px;color:#888">Sin valores registrados</p>'}</div>
        ${r.interpretacion ? `<div style="background:#fff3e0;border-left:4px solid #FF9800;padding:15px;margin-top:20px;border-radius:5px">
          <h4 style="margin:0 0 8px;color:#e65100;font-size:14px">📋 Interpretación Médica</h4><p style="margin:0;font-size:14px">${r.interpretacion}</p></div>` : ''}
        ${firmaHtml}
        ${(r.firmadoPor || r.validadoPor) ? `<p style="margin-top:8px;text-align:center;font-size:14px;color:#555">✅ Firmado por: Dr. ${r.firmadoPor?.nombre || r.validadoPor?.nombre || ''} ${r.firmadoPor?.apellido || r.validadoPor?.apellido || ''}</p>` : ''}
        <div style="text-align:center;margin-top:30px;padding:12px;background:#2c3e50;color:white;border-radius:8px;font-size:13px"><strong>Gracias por confiar en nosotros</strong> · Su salud es nuestra prioridad</div>
      </div>
    `;

    const opt = {
      margin:       5,
      filename:     `Resultado_${datos?.paciente?.nombre?.replace(/\\s+/g,'_') || 'Paciente'}_${r.estudio?.nombre?.replace(/\\s+/g,'_') || 'Estudio'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(container).set(opt).save();
  };

  /* ================================ RENDER ================================ */

  /* Pantalla de carga inicial (QR param) */
  if (modo === 'cargando-qr') {
    return (
      <div style={styles.bg}>
        <div style={styles.card}>
          <FaSpinner style={{ fontSize: 50, color: C.blue, animation: 'spin 1s linear infinite', marginBottom: 20 }} />
          <h2 style={{ color: C.mid }}>Verificando código QR...</h2>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  /* Pantalla de pago bloqueado */
  if (modo === 'bloqueado' && bloqueo) {
    return (
      <div style={styles.bg}>
        <div style={{ ...styles.card, maxWidth: 520 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <div style={styles.iconCircle(C.red)}>
              <FaExclamationTriangle style={{ fontSize: 32, color: C.white }} />
            </div>
            <h2 style={{ color: C.red, margin: '15px 0 5px' }}>Pago Pendiente</h2>
            <p style={{ color: theme.text, margin: 0 }}>No puede acceder a sus resultados hasta liquidar el saldo</p>
          </div>

          {/* Detalles */}
          <div style={{ background: '#fff3cd', border: '2px solid #ffc107', borderRadius: 12, padding: 20, marginBottom: 25 }}>
            <div style={styles.row}><span>Total de la factura</span><span style={{ fontWeight: 'bold' }}>{getFmtMoney(bloqueo.totalFactura)}</span></div>
            <div style={styles.row}><span>Monto pagado</span><span style={{ color: C.green, fontWeight: 'bold' }}>{getFmtMoney(bloqueo.montoPagado)}</span></div>
            <div style={{ ...styles.row, borderTop: '2px solid #ffc107', paddingTop: 10, marginTop: 10 }}>
              <span style={{ fontWeight: 'bold' }}>Saldo pendiente</span>
              <span style={{ color: C.red, fontWeight: 'bold', fontSize: 20 }}>{getFmtMoney(bloqueo.montoPendiente)}</span>
            </div>
          </div>

          {bloqueo.factura && (
            <p style={{ textAlign: 'center', color: theme.textMuted, fontSize: 14, marginBottom: 20 }}>
              Factura #{bloqueo.factura.numero}
            </p>
          )}

          <p style={{ textAlign: 'center', color: theme.text, fontSize: 14, lineHeight: 1.6 }}>
            Por favor, acuda a la institución o contacte a recepción para realizar el pago restante
            y poder acceder a sus resultados.
          </p>

          <button onClick={() => { setModo('login'); setBloqueo(null); }} style={styles.btnSecondary}>
            <FaArrowLeft /> Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  /* Pantalla de resultados */
  if (modo === 'resultados' && datos) {
    return (
      <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${C.dark} 0%, ${C.blue} 100%)`, padding: 20 }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* Header */}
          <div style={styles.resultsHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FaHospital style={{ fontSize: 30 }} />
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{empresaNombre}</h2>
                <p style={{ margin: '3px 0 0', opacity: 0.8, fontSize: 13 }}>Portal de Resultados para Pacientes</p>
              </div>
            </div>
            <button onClick={() => { setModo('login'); setDatos(null); setUsername(''); setPassword(''); window.history.pushState({}, '', window.location.pathname); }}
              style={{ background: 'rgba(255,255,255,0.2)', color: C.white, border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaArrowLeft /> Salir
            </button>
          </div>

          {/* Info Paciente */}
          <div style={styles.patientCard}>
            <div style={styles.iconCircle(C.mid)}>
              <FaUser style={{ fontSize: 22, color: C.white }} />
            </div>
            <div style={{ marginLeft: 20, flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: theme.textMuted }}>Bienvenido(a)</p>
              <h3 style={{ margin: 0, color: C.mid, fontSize: 20 }}>
                {datos.paciente?.nombre} {datos.paciente?.apellido}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginTop: 8, fontSize: 14, color: theme.text }}>
                {datos.paciente?.cedula && <span><strong>Cédula:</strong> {datos.paciente.cedula}</span>}
                {datos.paciente?.fechaNacimiento && <span><strong>Edad:</strong> {calcularEdad(datos.paciente.fechaNacimiento)}</span>}
                {datos.paciente?.sexo && <span><strong>Sexo:</strong> {datos.paciente.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>}
                {datos.factura?.numero && <span><strong>Factura:</strong> {datos.factura.numero}</span>}
              </div>
            </div>
          </div>

          {/* Resultados */}
          <h3 style={{ color: C.white, margin: '25px 0 15px', fontSize: 18 }}>
            🔬 Resultados de su Visita ({datos.data?.length || 0})
          </h3>

          {datos.data?.length > 0 ? datos.data.map((r, i) => (
            <div key={i} className="result-card" style={styles.resultCard}>
              <div style={styles.resultHeader}>
                <div>
                  <h4 style={{ margin: '0 0 4px', color: C.mid, fontSize: 16 }}>
                    {r.estudio?.nombre || 'Estudio'}
                  </h4>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>
                    {r.codigoMuestra && `Código: ${r.codigoMuestra} · `}
                    {new Date(r.createdAt).toLocaleDateString('es-DO')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <EstadoBadge estado={r.estado} />
                  {(r.estado === 'completado' || r.estado === 'entregado') && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => descargarPDF(r)} style={{ ...styles.btnPrint, background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})` }}>
                        <FaDownload /> Descargar
                      </button>
                      <button onClick={() => imprimirResultado(r)} style={styles.btnPrint}>
                        <FaPrint /> Imprimir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(r.estado === 'completado' || r.estado === 'entregado') ? (
                <div style={{ padding: 20 }}>
                  {r.valores?.length > 0 && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {r.valores.map((v, j) => {
                        const estadoColor = getEstadoColor(v.estado);
                        return (
                          <div key={j} style={{
                            background: theme.surface, border: `1px solid ${theme.border}`,
                            borderLeft: `4px solid ${estadoColor}`,
                            borderRadius: 8, padding: '14px 18px',
                            transition: 'all 0.2s ease'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <strong style={{ fontSize: 13, textTransform: 'uppercase', color: theme.textStrong }}>
                                {fmtParametro(v.parametro)}
                              </strong>
                              {v.estado && (
                                <span style={{
                                  background: estadoColor, color: '#fff',
                                  padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold',
                                  textTransform: 'uppercase'
                                }}>
                                  {v.estado}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 'bold', color: theme.textStrong, marginBottom: 2 }}>
                              {v.valor} <span style={{ fontSize: 14, color: theme.textMuted, fontWeight: 'normal' }}>{v.unidad}</span>
                            </div>
                            <div style={{ fontSize: 12, color: theme.textMuted }}>
                              Rango: {v.valorReferencia || '-'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {r.interpretacion && (
                    <div style={{ background: theme.surfaceMuted, padding: 15, borderRadius: 8, marginTop: 15, borderLeft: `4px solid ${C.mid}`, color: theme.text, fontStyle: 'italic', fontSize: 14 }}>
                      {r.interpretacion}
                    </div>
                  )}
                  {r.validadoPor && (
                    <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 12 }}>
                      ✅ Validado por: Dr. {r.validadoPor.nombre} {r.validadoPor.apellido}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: theme.textMuted }}>
                  <FaClock style={{ fontSize: 30, marginBottom: 10, color: C.orange }} />
                  <p style={{ margin: 0 }}>Sus resultados estarán disponibles en breve. Por favor, regrese más tarde.</p>
                </div>
              )}
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.05)', borderRadius: 16, color: C.white }}>
              <FaFlask style={{ fontSize: 50, marginBottom: 15, opacity: 0.6 }} />
              <p>No hay resultados disponibles aún para esta visita.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Pantalla de Login (modo por defecto) ── */
  return (
    <div style={styles.bg}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .portal-input:focus {
          outline: none;
          border-color: ${C.accent} !important;
          box-shadow: 0 0 0 4px rgba(52,152,219,0.15);
          transform: translateY(-1px);
        }
        .portal-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 35px rgba(41,128,185,0.5) !important;
        }
        .portal-btn:active {
          transform: translateY(0px);
          box-shadow: 0 4px 15px rgba(41,128,185,0.4) !important;
        }
        .portal-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .result-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 35px rgba(0,0,0,0.15) !important;
        }
      `}</style>

      {/* Decorative floating elements */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', animation: 'float 6s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '8%', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', animation: 'float 8s ease-in-out infinite 1s', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', right: '15%', width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', animation: 'float 5s ease-in-out infinite 2s', pointerEvents: 'none' }} />

      <div style={{ ...styles.card, animation: 'fadeInUp 0.6s ease' }}>
        {/* Logo section with enhanced design */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 90, height: 90,
            background: `linear-gradient(135deg, ${C.dark}, ${C.mid}, ${C.blue})`,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            boxShadow: '0 10px 30px rgba(10,30,47,0.3)',
            animation: 'pulse 3s ease-in-out infinite',
          }}>
            <FaFlask style={{ fontSize: 36, color: C.white }} />
          </div>
          <h2 style={{ margin: '20px 0 6px', color: C.dark, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>{empresaNombre}</h2>
          <div style={{
            display: 'inline-block',
            background: `linear-gradient(135deg, ${C.mid}, ${C.blue})`,
            color: C.white,
            padding: '6px 18px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            marginTop: 4,
            letterSpacing: '0.5px',
          }}>
            Portal de Resultados
          </div>
          <p style={{ margin: '12px 0 0', color: theme.textMuted, fontSize: 13 }}>
            Consulte sus análisis clínicos de forma segura
          </p>
        </div>

        {/* QR hint or validation message */}
        {(modo === 'login-qr' || qrParam) ? (
          <div style={{ background: 'linear-gradient(135deg, #d1ecf1, #e8f8fd)', borderRadius: 12, padding: '14px 16px', marginBottom: 22, display: 'flex', gap: 12, alignItems: 'center', border: '2px solid #bee5eb', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <FaCheckCircle style={{ fontSize: 28, color: '#0c5460', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: '#0c5460', lineHeight: 1.5 }}>
              <strong>✓ Código QR válido</strong><br />
              Por seguridad, ingrese su usuario y contraseña para acceder a sus resultados.
            </p>
          </div>
        ) : (
          <div style={{ background: theme.panel, borderRadius: 12, padding: '14px 16px', marginBottom: 22, display: 'flex', gap: 12, alignItems: 'center', border: `1px solid ${theme.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <FaQrcode style={{ fontSize: 28, color: C.accent, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: theme.text, lineHeight: 1.5 }}>
              <strong>¿Tiene el QR de su factura?</strong><br />
              Escanéelo con su teléfono para acceder más rápido.
            </p>
          </div>
        )}

        {error && (
          <div style={{ background: 'linear-gradient(135deg, #f8d7da, #fce4ec)', color: '#721c24', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #f5c6cb', boxShadow: '0 2px 8px rgba(231,76,60,0.1)' }}>
            <FaExclamationTriangle /> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 18 }}>
            <label style={styles.label}>
              <FaUser style={{ fontSize: 11, marginRight: 6, color: C.accent }} />
              Usuario
            </label>
            <div style={{ position: 'relative' }}>
              <FaUser style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: theme.textMuted, fontSize: 14 }} />
              <input
                className="portal-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ingrese su usuario"
                style={styles.input}
              />
            </div>
          </div>

          <div style={{ marginBottom: 26 }}>
            <label style={styles.label}>
              <FaLock style={{ fontSize: 11, marginRight: 6, color: C.accent }} />
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <FaLock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: theme.textMuted, fontSize: 14 }} />
              <input
                className="portal-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Su clave de la factura"
                style={styles.input}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="portal-btn" style={styles.btnPrimary}>
            {loading
              ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Verificando...</>
              : <><FaFlask style={{ fontSize: 18 }} /> Acceder a Mis Resultados</>
            }
          </button>
        </form>

        <div style={{ marginTop: 22, padding: 16, background: `linear-gradient(135deg, ${theme.surfaceMuted}, ${theme.surface})`, borderRadius: 12, fontSize: 13, color: theme.text, lineHeight: 1.7, border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>💡</span>
            <div>
              <strong style={{ color: theme.textStrong }}>¿Dónde encuentro mis credenciales?</strong><br />
              Su usuario y contraseña se encuentran impresos en la factura que recibió al registrarse en el centro. También puede escanear el código QR de su factura.
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 11, color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <FaLock style={{ fontSize: 10 }} /> Conexión segura · Sus datos están protegidos
          </span>
        </div>
      </div>
    </div>
  );
};

/* ─── Estilos reutilizables ─────────────────────────────────── */
const styles = {
  bg: {
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${C.dark} 0%, ${C.mid} 50%, ${C.blue} 100%)`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  card: {
    background: theme.surface,
    borderRadius: 24,
    padding: '45px 40px',
    width: '100%',
    maxWidth: 460,
    boxShadow: '0 30px 70px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${theme.border}`,
  },
  iconCircle: (bg) => ({
    width: 80, height: 80,
    background: `linear-gradient(135deg, ${bg}, ${C.accent})`,
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto',
    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
  }),
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: theme.text,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 42px',
    borderRadius: 12,
    border: `2px solid ${theme.border}`,
    boxSizing: 'border-box',
    fontSize: 15,
    transition: 'all 0.3s ease',
    background: theme.surface,
    color: theme.text,
  },
  btnPrimary: {
    width: '100%',
    padding: '16px',
    background: `linear-gradient(135deg, ${C.mid} 0%, ${C.blue} 50%, ${C.accent} 100%)`,
    color: C.white,
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: `0 6px 20px rgba(41,128,185,0.4)`,
    transition: 'all 0.3s ease',
  },
  btnSecondary: {
    width: '100%',
    padding: '12px',
    background: 'transparent',
    color: C.mid,
    border: `2px solid ${C.mid}`,
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  btnPrint: {
    padding: '10px 18px',
    background: `linear-gradient(135deg, ${C.mid}, ${C.blue})`,
    color: C.white,
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    boxShadow: '0 4px 12px rgba(26,58,92,0.25)',
    transition: 'all 0.3s ease',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0',
    fontSize: 15,
  },
  resultsHeader: {
    background: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(15px)',
    borderRadius: 18,
    padding: '20px 26px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: C.white,
    marginBottom: 22,
    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  patientCard: {
    background: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.surfaceMuted} 100%)`,
    borderRadius: 18,
    padding: '24px 28px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 6px 25px rgba(0,0,0,0.12)',
    marginBottom: 12,
    border: `1px solid ${theme.border}`,
  },
  resultCard: {
    background: theme.surface,
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
    boxShadow: '0 6px 25px rgba(0,0,0,0.1)',
    border: `1px solid ${theme.border}`,
    transition: 'all 0.3s ease',
  },
  resultHeader: {
    background: `linear-gradient(135deg, ${theme.surfaceMuted} 0%, ${theme.surface} 100%)`,
    padding: '18px 22px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    borderBottom: `1px solid ${theme.border}`,
  },
};

export default PortalPaciente;
