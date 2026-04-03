import React, { Suspense, lazy, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const DicomViewer = lazy(() => import('./DicomViewer'));

const TIPO_PLANTILLAS = [
  { id: 'general', label: 'General', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'torax', label: 'Tórax / Rx Tórax', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'columna', label: 'Columna', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'extremidades', label: 'Extremidades', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'abdomen', label: 'Abdomen', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'mamografia', label: 'Mamografía', campos: ['tecnica', 'hallazgos', 'impresion', 'birads', 'recomendaciones'] },
  { id: 'personalizada', label: 'Personalizada', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
];

const CAMPO_LABELS = {
  tecnica: 'Técnica Utilizada',
  hallazgos: 'Hallazgos',
  impresion: 'Impresión Diagnóstica',
  birads: 'Categoría BIRADS',
  recomendaciones: 'Recomendaciones',
};

const ESTADO_COLORES = {
  pendiente: { bg: 'bg-amber-500/10 border-amber-500/20', filter: 'text-amber-500', name: 'PENDIENTE' },
  en_proceso: { bg: 'bg-blue-500/10 border-blue-500/20', filter: 'text-blue-500', name: 'EN PROCESO' },
  completado: { bg: 'bg-transparent border-[#4afdef]/50 shadow-[0_0_10px_rgba(74,253,239,0.3)]', filter: 'text-black', name: 'COMPLETADO' },
};

function ViewerLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0b0e15] text-black gap-3">
      <span className="material-symbols-outlined animate-spin text-4xl">autorenew</span>
      <div className="text-sm font-headline tracking-widest uppercase">Inicializando Motor DICOM...</div>
    </div>
  );
}

function getRol() {
  try {
    const uStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    const u = JSON.parse(uStr || '{}');
    return u.role || u.rol || 'recepcion';
  } catch { return 'recepcion'; }
}
function getUsuarioSesion() {
  try {
    const uStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    return JSON.parse(uStr || '{}');
  } catch { return {}; }
}
function puedeEditar() {
  const r = getRol(); return r === 'admin' || r === 'medico';
}

const LS_KEY = 'imgPlantillasDoctora';
function cargarPlantillasGuardadas() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function guardarPlantillasLS(lista) {
  localStorage.setItem(LS_KEY, JSON.stringify(lista));
}

const Imagenologia = ({ setHideDashboardBars }) => {
  const navigate = useNavigate();
  const [vista, setVista] = useState('lista');
  const [estudios, setEstudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [estudioActual, setEstudioActual] = useState(null);
  const [imagenesTemporales, setImagenesTemporales] = useState([]);
  const [imagenesSubidas, setImagenesSubidas] = useState([]);

  // Estado combinado para el visor (temporales + subidas)
  const todasLasImagenes = useMemo(() => {
    const temp = (imagenesTemporales || []).map((img, idx) => ({
      ...img,
      _id: `temp_${idx}`,
      esTemporal: true
    }));
    const subidas = (imagenesSubidas || []).map(img => ({
      ...img,
      esTemporal: false
    }));
    const resultado = [...temp, ...subidas];
    console.log('Imagenologia: todasLasImagenes actualizado:', resultado.length, 'imagenes:', resultado);
    return resultado;
  }, [imagenesTemporales, imagenesSubidas]);
  
  const [reporte, setReporte] = useState({});
  const [tipoPlantilla, setTipoPlantilla] = useState('general');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [firmandoResultado, setFirmandoResultado] = useState(false);
  
  const [plantillasDoctora, setPlantillasDoctora] = useState(cargarPlantillasGuardadas);
  const [mostrarGestorPlantillas, setMostrarGestorPlantillas] = useState(false);
  const [plantillaEditando, setPlantillaEditando] = useState(null); 
  const [nombreNuevaPlantilla, setNombreNuevaPlantilla] = useState('');
  const [mostrarSoloVisor, setMostrarSoloVisor] = useState(false);
  const [mostrarBarraReporte, setMostrarBarraReporte] = useState(true);
  void mostrarBarraReporte;
  void setMostrarBarraReporte;
  const [dashboardBarsVisible, setDashboardBarsVisible] = useState(true); 
  const [imagenesParaImprimir, setImagenesParaImprimir] = useState([]); 
  const [ajustes, setAjustes] = useState(null); 
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' 

  const fileInputRef = useRef(null);
  const guardadoTimeoutRef = useRef(null); 
  const canEdit = puedeEditar();
  const rol = getRol();
  const sesion = getUsuarioSesion();

  useEffect(() => { guardarPlantillasLS(plantillasDoctora); }, [plantillasDoctora]);

  const cargarEstudios = useCallback(async () => {
    setLoading(true);
    try {
      const params = filtroEstado ? { estado: filtroEstado } : {};
      const resp = await api.getImagenologiaLista(params);
      setEstudios(Array.isArray(resp) ? resp : (resp?.resultados || resp?.data || []));
    } catch { setEstudios([]); }
    finally { setLoading(false); }
  }, [filtroEstado]);

  const guardarReporteAuto = useCallback(async (reporteOpcional = null, ajustesOpcionales = null) => {
    if (!estudioActual || !canEdit) return;
    const payload = { reporte: reporteOpcional || reporte, plantilla: tipoPlantilla };
    if (ajustesOpcionales) payload.ajustes = ajustesOpcionales;
    await api.updateImagenologiaWorkspace(estudioActual._id || estudioActual.id, payload);
  }, [canEdit, estudioActual, reporte, tipoPlantilla]);

  // Auto-guardado cada 30 segundos en modo visor
  useEffect(() => {
    if (vista !== 'visor' || !canEdit || !estudioActual) return;

    const intervalId = setInterval(() => {
      console.log('Auto-guardando reporte...');
      setAutoSaveStatus('saving');

      guardarReporteAuto(reporte, ajustes)
        .then(() => {
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        })
        .catch(() => {
          setAutoSaveStatus('idle');
        });
    }, 30000); // 30 segundos

    return () => clearInterval(intervalId);
  }, [vista, canEdit, estudioActual, reporte, ajustes, guardarReporteAuto]);

  // Escape key para volver a lista
  useEffect(() => {
    if (vista !== 'visor') return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setVista('lista');
        setDashboardBarsVisible(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vista]);

  // Sincronizar visibilidad de barras del dashboard
  useEffect(() => {
    if (setHideDashboardBars) {
      setHideDashboardBars(!dashboardBarsVisible);
    }
  }, [dashboardBarsVisible, setHideDashboardBars]);

  useEffect(() => { cargarEstudios(); }, [cargarEstudios]);

  const abrirVisor = async (estudio) => {
    console.log('Imagenologia: abrirVisor llamado con estudio:', estudio?._id || estudio?.id);
    setEstudioActual(estudio);
    setVista('visor');
    setDashboardBarsVisible(false); // Ocultar barras del dashboard al abrir visor
    setReporte({});
    setImagenesTemporales([]);
    setImagenesSubidas([]);
    setMostrarSoloVisor(true);
    setImagenesParaImprimir([]);
    setAjustes(null); 
    try {
      const ws = await api.getImagenologiaWorkspace(estudio._id || estudio.id);
      console.log('Imagenologia: Workspace recibido:', ws);
      const data = ws?.data || ws || {};
      if (data.reporte) setReporte(data.reporte);
      if (data.plantilla) setTipoPlantilla(data.plantilla);
      if (data.visor && data.visor.ajustes) setAjustes(data.visor.ajustes);
      const imgs = data.visor?.imagenes || data.imagenes || estudio.imagenes || [];
      console.log('Imagenologia: Imágenes recibidas:', imgs.length, imgs);
      setImagenesSubidas(imgs);
    } catch (err) {
      console.log('Imagenologia: Error cargando workspace:', err);
      setImagenesSubidas(estudio.imagenes || []);
    }
  };

  const handleSubirImagenes = async (e) => {
    const files = e.target.files;
    if (!files.length || !estudioActual) return;
    
    // Crear URLs temporales para visualización inmediata
    const nuevasImagenesTemporales = Array.from(files).map(file => ({
      url: URL.createObjectURL(file),
      nombre: file.name,
      tipo: file.type,
      file: file, // Guardar referencia para subir luego
      size: file.size
    }));
    
    setImagenesTemporales(prev => [...prev, ...nuevasImagenesTemporales]);
    
    // Limpiar input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Función para guardar imágenes permanentemente
  const guardarImagenesPermanentes = async () => {
    if (!imagenesTemporales.length || !estudioActual) return;
    
    setSubiendo(true);
    try {
      const formData = new FormData();
      imagenesTemporales.forEach(img => formData.append('imagenes', img.file));
      
      const resp = await fetch(`/api/imagenologia/upload/${estudioActual._id || estudioActual.id}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || sessionStorage.getItem('token')) },
        body: formData,
      });
      
      const data = await resp.json();
      const nuevas = data.data || data.imagenes || [];
      
      // Limpiar temporales y añadir a subidas
      setImagenesTemporales([]);
      setImagenesSubidas(prev => [...prev, ...nuevas]);
      
      alert(`${nuevas.length} imagen(es) guardada(s) permanentemente`);
    } catch (err) { 
      alert('Error al guardar: ' + err.message); 
    } finally { 
      setSubiendo(false); 
    }
  };

  const guardarReporte = async (reporteOpcional = null, ajustesOpcionales = null) => {
    if (!estudioActual || !canEdit) return;
    setGuardando(true);
    try {
      const payload = { reporte: reporteOpcional || reporte, plantilla: tipoPlantilla };
      if (ajustesOpcionales) payload.ajustes = ajustesOpcionales;
      await api.updateImagenologiaWorkspace(estudioActual._id || estudioActual.id, payload);
      if (!ajustesOpcionales) alert('Reporte guardado correctamente'); 
    } catch (err) { if (!ajustesOpcionales) alert('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const handleCambioAjustesVisor = useCallback((nuevosAjustes) => {
    setAjustes(nuevosAjustes);
    if (canEdit && estudioActual) {
      if (guardadoTimeoutRef.current) clearTimeout(guardadoTimeoutRef.current);
      guardadoTimeoutRef.current = setTimeout(() => {
        guardarReporteAuto(reporte, nuevosAjustes).catch(() => {});
      }, 1500); 
    }
  }, [canEdit, estudioActual, reporte, guardarReporteAuto]);

  const finalizarReporte = async () => {
    if (!estudioActual || !canEdit) return;
    const usuarioSesion = getUsuarioSesion();
    if (!estudioActual?.firmaDigital && !usuarioSesion?.firmaDigital) {
      alert('Debe registrar su firma en Mi Perfil antes de finalizar un reporte de imagenologia.');
      navigate('/perfil');
      return;
    }
    if (!window.confirm('¿Finalizar y marcar como completado?')) return;
    setGuardando(true);
    try {
      await api.updateImagenologiaWorkspace(estudioActual._id || estudioActual.id, { reporte, plantilla: tipoPlantilla });
      const resultadoFinalizado = await api.finalizarReporteImagenologia(estudioActual._id || estudioActual.id);
      const data = resultadoFinalizado?.data || resultadoFinalizado || {};
      setEstudioActual(prev => ({
        ...(prev || {}),
        ...data,
        firmaDigital: data.firmaDigital || prev?.firmaDigital || usuarioSesion?.firmaDigital || '',
        firmadoPor: data.firmadoPor || prev?.firmadoPor || null,
        validadoPor: data.validadoPor || prev?.validadoPor || null
      }));
      alert('Reporte finalizado');
      setVista('lista');
      cargarEstudios();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const marcarFirmaResultado = async (checked) => {
    if (!checked || !estudioActual || estudioActual.firmaDigital) return;
    const usuarioSesion = getUsuarioSesion();
    if (!usuarioSesion?.firmaDigital) {
      alert('Debe registrar su firma en Mi Perfil antes de firmar el reporte.');
      navigate('/perfil');
      return;
    }
    try {
      setFirmandoResultado(true);
      const firmado = await api.firmarResultado(estudioActual._id || estudioActual.id);
      const dataFirmada = firmado?.data || firmado || {};
      setEstudioActual(prev => ({
        ...(prev || {}),
        ...dataFirmada,
        firmaDigital: dataFirmada.firmaDigital || usuarioSesion.firmaDigital,
        firmadoPor: dataFirmada.firmadoPor || prev?.firmadoPor || null,
        validadoPor: dataFirmada.validadoPor || prev?.validadoPor || null
      }));
    } catch (err) {
      alert(err.message || 'No se pudo firmar el reporte.');
    } finally {
      setFirmandoResultado(false);
    }
  };

  const guardarComoPlantilla = () => {
    const nombre = nombreNuevaPlantilla.trim() || `Plantilla ${plantillasDoctora.length + 1}`;
    const nueva = { id: Date.now().toString(), nombre, tipoPlantilla, reporte: { ...reporte } };
    setPlantillasDoctora(prev => [...prev, nueva]);
    setNombreNuevaPlantilla('');
    alert(`Plantilla "${nombre}" guardada`);
  };

  const aplicarPlantillaGuardada = (pt) => {
    setReporte({ ...pt.reporte });
    setTipoPlantilla(pt.tipoPlantilla || 'general');
    setMostrarGestorPlantillas(false);
  };

  const eliminarPlantillaGuardada = (id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return;
    setPlantillasDoctora(prev => prev.filter(p => p.id !== id));
  };

  const actualizarPlantillaGuardada = () => {
    if (!plantillaEditando) return;
    setPlantillasDoctora(prev => prev.map(p =>
      p.id === plantillaEditando.id ? { ...p, nombre: plantillaEditando.nombre, reporte: plantillaEditando.reporte, tipoPlantilla: plantillaEditando.tipoPlantilla } : p
    ));
    setPlantillaEditando(null);
    alert('Plantilla actualizada');
  };

  const agregarImagenAImprimir = () => {
    if (window.__capturarVisorDicomActivo) {
      const durl = window.__capturarVisorDicomActivo();
      if (durl) {
        setImagenesParaImprimir(prev => {
          const arr = [...prev, durl];
          if (arr.length > 2) return arr.slice(arr.length - 2); 
          return arr;
        });
        alert('Imagen capturada para imprimir. Ya van ' + (imagenesParaImprimir.length + 1) + '. Vaya a "Imprimir Imagen"');
      } else {
        alert('Espere a que cargue la imagen');
      }
    }
  };

  const limpiarImpresion = () => setImagenesParaImprimir([]);

  const imprimirImagenesSola = async () => {
    if (imagenesParaImprimir.length === 0) {
      alert("Capture al menos una imagen presionando el botón 📸 primero");
      return;
    }
    let empresa = {};
    try { const r = await fetch('/api/configuracion/empresa'); empresa = await r.json(); } catch { }
    const paciente = estudioActual?.paciente || {};
    const estudio = estudioActual?.estudio || {};
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Impresión de Imagen</title>
      <style>@page{size:A4;margin:10mm}body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;color:#333} .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #1a3a5c;padding-bottom:5px;margin-bottom:10px} .hdr h3{margin:0;color:#1a3a5c;font-size:14px} .hdr p{margin:0;font-size:10px;color:#666} .img-container{text-align:center;margin-bottom:15px;height:45vh;display:flex;align-items:center;justify-content:center;background:#000;border-radius:4px;overflow:hidden} .img-container img{max-width:100%;max-height:100%;object-fit:contain} @media print{.np{display:none}}</style></head><body>
      <div class="np" style="text-align:center;padding:10px;background:#f0f0f0;margin-bottom:15px"><button onclick="window.print()" style="padding:10px 20px;font-size:16px;cursor:pointer">🖨️ Imprimir</button></div>
      <div class="hdr"><div><h3>${esc(empresa.nombre || 'Centro Diagnóstico')}</h3><p>Estudio: ${esc(estudio.nombre)}</p></div><div style="text-align:right"><h3>Paciente: ${esc(paciente.nombre)} ${esc(paciente.apellido)}</h3><p>Cód: ${estudioActual?.codigo || ''} · ${new Date().toLocaleDateString('es-DO')}</p></div></div>
      ${imagenesParaImprimir.map(img => `<div class="img-container"><img src="${img}" /></div>`).join('')}</body></html>`;

    const w = window.open('', 'ImprimirImagen', 'width=850,height=1100');
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const imprimirReporte = async () => {
    let empresa = {};
    try { const r = await fetch('/api/configuracion/empresa'); empresa = await r.json(); } catch { }
    const usuarioSesion = getUsuarioSesion();
    if (!estudioActual?.firmaDigital && !usuarioSesion?.firmaDigital) {
      alert('Debe registrar su firma en Mi Perfil antes de imprimir un reporte de imagenologia.');
      navigate('/perfil');
      return;
    }

    let estudioParaImprimir = estudioActual;
    if (!estudioParaImprimir?.firmaDigital && usuarioSesion?.firmaDigital && estudioActual?._id) {
      try {
        const firmado = await api.firmarResultado(estudioActual._id || estudioActual.id);
        const dataFirmada = firmado?.data || firmado || {};
        estudioParaImprimir = {
          ...estudioActual, ...dataFirmada,
          firmaDigital: dataFirmada.firmaDigital || usuarioSesion.firmaDigital,
          firmadoPor: dataFirmada.firmadoPor || estudioActual.firmadoPor || null,
          validadoPor: dataFirmada.validadoPor || estudioActual.validadoPor || null
        };
        setEstudioActual(estudioParaImprimir);
      } catch (err) {}
    }

    const paciente = estudioParaImprimir?.paciente || {};
    const estudio = estudioParaImprimir?.estudio || {};
    const fecha = new Date(estudioParaImprimir?.createdAt || new Date()).toLocaleDateString('es-DO');
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tpl = TIPO_PLANTILLAS.find(p => p.id === tipoPlantilla) || TIPO_PLANTILLAS[0];
    const firmaActiva = estudioParaImprimir?.firmaDigital || usuarioSesion?.firmaDigital || '';
    const medicoFirmanteNombre = estudioParaImprimir?.firmadoPor?.nombre || estudioParaImprimir?.validadoPor?.nombre || usuarioSesion?.nombre || reporte?.medico_firmante || 'Médico Informante';
    const medicoFirmanteApellido = estudioParaImprimir?.firmadoPor?.apellido || estudioParaImprimir?.validadoPor?.apellido || usuarioSesion?.apellido || '';
    
    const camposHtml = tpl.campos.map(c => {
      const v = reporte[c] || ''; if (!v) return '';
      return `<div style="margin-bottom:14px"><h4 style="margin:0 0 5px;color:#1a3a5c;font-size:13px;text-transform:uppercase">${esc(CAMPO_LABELS[c] || c)}</h4><p style="margin:0;line-height:1.7;white-space:pre-wrap;color:#2d3748">${esc(v)}</p></div>`;
    }).join('');
    
    const firmaHtml = firmaActiva ? `<div style="margin-bottom:10px"><img src="${firmaActiva}" alt="Firma del médico" style="max-width:220px;max-height:70px;object-fit:contain" /></div>` : '<div style="height:60px"></div>';
    
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Imagenología</title>
    <style>@page{size:A4;margin:12mm 15mm}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#2d3748} .hdr{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1a3a5c;padding-bottom:12px;margin-bottom:16px} .hdr img{max-height:60px;object-fit:contain}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f0f8ff;padding:12px;border-radius:8px;border-left:4px solid #1a3a5c;margin-bottom:16px} .item strong{display:block;font-size:10px;color:#888;text-transform:uppercase}.item span{font-size:13px;font-weight:600;color:#1a3a5c} .sec{background:#1a3a5c;color:white;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:700;margin:16px 0 10px} .firma{margin-top:50px;display:flex;justify-content:flex-end}.fb{text-align:center;width:220px} .fl{border-top:2px solid #1a3a5c;padding-top:8px;font-size:11px;color:#666} .ft{margin-top:30px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;color:#aaa;font-size:10px} @media print{.np{display:none}}</style></head><body>
    <div class="hdr">${empresa.logo_resultados ? `<img src="${esc(empresa.logo_resultados)}" onerror="this.style.display='none'">` : '<span style="font-size:28px">🏥</span>'} <div><h2 style="margin:0 0 3px;font-size:16px;color:#1a3a5c">${esc(empresa.nombre || 'Centro Diagnóstico')}</h2> <p style="margin:0;color:#666;font-size:11px">${esc(empresa.empresa_direccion || '')}${empresa.empresa_telefono ? ' · ' + esc(empresa.empresa_telefono) : ''}</p> <p style="color:#2980b9;font-weight:600;margin:2px 0 0">REPORTE DE IMAGENOLOGÍA</p></div></div>
    <div class="grid"><div class="item"><strong>Paciente</strong><span>${esc(paciente.nombre)} ${esc(paciente.apellido)}</span></div><div class="item"><strong>Cédula</strong><span>${esc(paciente.cedula || 'N/A')}</span></div><div class="item"><strong>Estudio</strong><span>${esc(estudio.nombre || 'Estudio de imagen')}</span></div><div class="item"><strong>Fecha</strong><span>${fecha}</span></div></div>
    ${camposHtml ? `<div class="sec">REPORTE MÉDICO</div>${camposHtml}` : '<p style="color:#888;font-style:italic">Sin reporte completado</p>'}
    <div class="firma"><div class="fb">${firmaHtml}<div class="fl"><strong>Firma y Sello</strong><br/>Dr(a). ${esc(medicoFirmanteNombre)} ${esc(medicoFirmanteApellido)}</div></div></div>
    <div class="ft">${esc(empresa.nombre || 'Centro Diagnóstico')} · ${new Date().toLocaleString('es-DO')}</div>
    <div class="np" style="text-align:center;padding:20px"><button onclick="window.print()" style="padding:14px 35px;background:#1a3a5c;color:white;border:none;border-radius:10px;cursor:pointer;font-size:15px;font-weight:bold">🖨️ Imprimir</button></div>
    </body></html>`;
    const w = window.open('', 'Reporte', 'width=850,height=1100');
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const tipoActual = TIPO_PLANTILLAS.find(p => p.id === tipoPlantilla) || TIPO_PLANTILLAS[0];

  if (vista === 'lista') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full h-full pb-8">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-headline font-bold text-gray-900 dark:text-[#e0e2ec] tracking-tighter flex items-center gap-3">
                <span className="material-symbols-outlined text-black text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_information</span>
                Imagenología
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#32353c] text-gray-600 dark:text-[#bacac7] font-label uppercase tracking-widest ml-2 border border-gray-200 dark:border-white/5">
                    {rol.charAt(0).toUpperCase() + rol.slice(1)}
                </span>
            </h2>
            <div className="flex gap-2 bg-white dark:bg-[#1d2027] p-1.5 rounded-xl border border-gray-200 dark:border-white/5">
              {['', 'pendiente', 'en_proceso', 'completado'].map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)} 
                        className={`px-4 py-2 rounded-lg font-label text-[11px] font-bold uppercase tracking-wider transition-all ${filtroEstado === e ? 'bg-gray-100 dark:bg-[#32353c] text-gray-900 dark:text-white shadow-md' : 'bg-transparent text-gray-500 dark:text-[#849491] hover:text-gray-600 dark:text-[#bacac7] hover:bg-white/5'}`}>
                    {e === '' ? 'Todos' : e.replace('_', ' ')}
                </button>
              ))}
            </div>
        </div>

        {loading ? (
            <div className="text-center p-16"><span className="material-symbols-outlined animate-spin text-black text-4xl">autorenew</span></div>
        ) : estudios.length === 0 ? (
            <div className="bg-white dark:bg-[#191b23] border border-gray-200 dark:border-white/5 rounded-2xl p-16 text-center shadow-xl">
                <span className="material-symbols-outlined text-[#32353c] text-6xl mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
                <p className="text-slate-400 font-body text-lg">No hay estudios {filtroEstado ? `"${filtroEstado.replace('_', ' ')}"` : 'registrados'}</p>
            </div>
        ) : (
            <div className="bg-white dark:bg-[#191b23] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left font-label">
                <thead>
                  <tr className="bg-white dark:bg-[#1d2027] text-[10px] text-gray-500 dark:text-[#849491] uppercase tracking-widest border-b border-[#3b4a48]/50">
                    <th className="px-6 py-4 font-bold">Código</th>
                    <th className="px-6 py-4 font-bold">Paciente</th>
                    <th className="px-6 py-4 font-bold">Estudio</th>
                    <th className="px-6 py-4 font-bold text-center">Imágenes</th>
                    <th className="px-6 py-4 font-bold text-center">Estado</th>
                    <th className="px-6 py-4 font-bold">Fecha</th>
                    <th className="px-6 py-4 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-[#3b4a48]/30">
                  {estudios.map(e => {
                    const est = ESTADO_COLORES[e.estado] || ESTADO_COLORES.pendiente;
                    return (
                      <tr key={e._id || e.id} className="bg-white dark:bg-[#1d2027]/50 transition-colors">
                        <td className="px-6 py-4">
                            <span className="font-bold text-black border-2 border-[#4afdef] rounded-lg shadow-[0_0_15px_rgba(74,253,239,0.5)] text-[12px] uppercase px-3 py-1 select-none inline-block w-full bg-transparent">{e.codigo || e._id?.slice(-6).toUpperCase()}</span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="font-bold text-black border-2 border-[#4afdef] rounded-lg shadow-[0_0_15px_rgba(74,253,239,0.5)] px-3 py-1 select-none inline-block w-full bg-transparent">{e.paciente?.nombre} {e.paciente?.apellido}</span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-black border-2 border-[#4afdef] rounded-lg shadow-[0_0_15px_rgba(74,253,239,0.5)] px-3 py-1 select-none inline-block w-full bg-transparent">{e.estudio?.nombre || 'Estudio de imagen'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className="text-black px-3 py-1 rounded-md text-[11px] font-bold border-2 border-[#4afdef] shadow-[0_0_15px_rgba(74,253,239,0.5)] select-none inline-block w-full bg-transparent">
                                {(e.imagenes || []).length}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold border ${est.bg} ${est.filter}`}>
                                {est.name}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-black border-2 border-[#4afdef] rounded-lg shadow-[0_0_15px_rgba(74,253,239,0.5)] px-3 py-1 text-[12px] select-none inline-block w-full bg-transparent">{new Date(e.createdAt || e.fecha).toLocaleDateString('es-DO')}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <button onClick={() => abrirVisor(e)} className="px-4 py-2 bg-transparent text-gray-900 rounded-lg text-xs font-bold hover:bg-black hover:text-white border-2 border-[#4afdef] shadow-[0_0_15px_rgba(74,253,239,0.5)] transition-all flex items-center justify-center gap-2 w-full max-w-[130px] mx-auto group">
                                <span className="material-symbols-outlined text-[16px] text-gray-700 group-hover:text-white group-hover:animate-pulse">visibility</span>
                                {canEdit ? 'Visor' : 'Imágenes'}
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
    );
  }

  // --- VISOR MODE ---
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-[#10131a] flex flex-col text-gray-900 dark:text-[#e0e2ec] font-body selection:bg-black/30 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      
      {!mostrarSoloVisor && (
      <nav className="flex items-center justify-between px-6 py-3 bg-[rgba(29,32,38,0.7)] backdrop-blur-2xl border-b border-gray-200 dark:border-white/5 h-16 shrink-0 shadow-lg">
        <div className="flex items-center gap-6">
            <button onClick={() => { setVista('lista'); setDashboardBarsVisible(true); }} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/5 transition-all active:scale-95 text-gray-900 dark:text-[#e0e2ec] border border-transparent hover:border-gray-200 dark:border-white/10">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex flex-col">
                <h1 className="font-headline font-bold text-lg tracking-tight flex items-center gap-2 text-gray-900 dark:text-white">
                    {estudioActual?.paciente?.nombre} {estudioActual?.paciente?.apellido}
                </h1>
                <p className="font-label text-xs text-gray-500 dark:text-[#849491] uppercase tracking-tighter">
                    {estudioActual?.estudio?.nombre || 'ESTUDIO CLÍNICO'} 
                    <span className="mx-2">|</span> 
                    <span className="text-[#cfd3db]">ID: {estudioActual?.codigo || estudioActual?._id?.slice(-8).toUpperCase()}</span>
                </p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {canEdit && (
                <>
                    <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-white/10 transition-all font-label text-sm cursor-pointer hover:text-gray-900 dark:text-white group">
                        {subiendo ? <span className="material-symbols-outlined animate-spin text-black text-sm">autorenew</span> : <span className="material-symbols-outlined text-black text-sm group-hover:animate-pulse">upload_file</span>}
                        {subiendo ? 'Subiendo...' : 'Subir DICOM'}
                        <input ref={fileInputRef} type="file" accept=".dcm,.DCM,image/*" multiple style={{ display: 'none' }} onChange={handleSubirImagenes} />
                    </label>
                    
                    {imagenesTemporales.length > 0 && (
                        <button onClick={guardarImagenesPermanentes} disabled={subiendo}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all font-label text-sm text-emerald-400">
                            <span className="material-symbols-outlined text-sm">save</span>
                            Guardar {imagenesTemporales.length} imagen(es)
                        </button>
                    )}
                </>
            )}

            <div className="h-6 w-px bg-white/10 mx-1"></div>
            
            <button onClick={agregarImagenAImprimir} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-white/10 transition-all font-label text-sm group">
                <span className="material-symbols-outlined text-[#cfd3db] text-sm group-hover:text-gray-900 dark:text-white">photo_camera</span>
                Capturar <span className="text-[10px] bg-white/10 px-1.5 rounded">{imagenesParaImprimir.length}/2</span>
            </button>

            {imagenesParaImprimir.length > 0 && (
                <>
                    <button onClick={limpiarImpresion} className="flex items-center justify-center p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all" title="Limpiar imágenes capturadas">
                        <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                    <button onClick={imprimirImagenesSola} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#32353c] border border-gray-200 dark:border-white/10 hover:bg-[#464950] transition-all font-label text-sm text-gray-900 dark:text-white font-bold ml-2">
                        Imprimir Imagen
                    </button>
                </>
            )}

            <div className="h-6 w-px bg-white/10 mx-1"></div>

            <button onClick={imprimirReporte} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#32353c] border border-gray-200 dark:border-white/10 hover:bg-white/20 transition-all font-label text-sm font-bold text-gray-900 dark:text-white shadow-md">
                <span className="material-symbols-outlined text-sm">print</span>
                Dossier
            </button>

            <div className="h-6 w-px bg-white/10 mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
                <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold font-headline text-black uppercase">{sesion?.nombre || 'Médico'}</p>
                    <p className="text-[10px] text-gray-500 dark:text-[#849491] font-label uppercase">Staff Radiología</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#32353c] border border-black/30 overflow-hidden flex items-center justify-center text-gray-600 dark:text-[#bacac7]">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                </div>
            </div>
        </div>
      </nav>
      )}

      {/* Main Content Split */}
      <main className="flex-1 flex overflow-hidden">
          
          {/* Main DICOM Viewport (Left Area) */}
          <section className="flex-1 bg-[#0b0e15] relative overflow-hidden flex flex-col items-center justify-center">
             {/* Botón flotante para mostrar/ocultar barras del dashboard */}
             <button
               onClick={() => setDashboardBarsVisible(!dashboardBarsVisible)}
               className="absolute bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 border border-black/50 flex items-center justify-center shadow-lg transition-all hover:scale-110"
               title={dashboardBarsVisible ? 'Ocultar barras del dashboard' : 'Mostrar barras del dashboard'}
             >
               <span className="material-symbols-outlined text-black text-xl">
                 {dashboardBarsVisible ? 'close_fullscreen' : 'open_in_full'}
               </span>
             </button>
             <Suspense fallback={<ViewerLoadingFallback />}>
                <DicomViewer
                  imagenes={todasLasImagenes}
                  ajustesIniciales={ajustes || {}}
                  onCambioAjustes={handleCambioAjustesVisor}
                  onImagenCargada={(img) => setImagenesTemporales(prev => [...prev, img])}
                  estiloContenedor={{ borderRadius: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </Suspense>
          </section>

          {/* Right Sidebar (Report Editor) */}
          <aside className="w-[380px] bg-white dark:bg-[#1d2027]/70 backdrop-blur-2xl border-l border-gray-200 dark:border-white/5 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-40 transition-all shrink-0">
                  <header className="p-6 pb-4 flex items-center justify-between border-b border-gray-200 dark:border-white/5">
                      <div>
                          <h2 className="font-headline font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                              <span className="material-symbols-outlined text-black">edit_note</span>
                              Reporte Médico
                              {autoSaveStatus !== 'idle' && (
                                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                                      autoSaveStatus === 'saving' 
                                          ? 'bg-amber-500/10 text-amber-500' 
                                          : 'bg-emerald-500/10 text-emerald-500'
                                  }`}>
                                      <span className={`material-symbols-outlined text-[14px] ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`}>
                                          {autoSaveStatus === 'saving' ? 'sync' : 'check_circle'}
                                      </span>
                                      {autoSaveStatus === 'saving' ? 'Guardando...' : 'Guardado'}
                                  </div>
                              )}
                          </h2>
                          <p className="text-[10px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest mt-1">Editor de Diagnóstico</p>
                      </div>
                      
                      {canEdit && (
                          <div className="relative">
                            <button onClick={() => setMostrarGestorPlantillas(!mostrarGestorPlantillas)} className={`p-2 rounded-lg text-gray-600 dark:text-[#bacac7] transition-all ${mostrarGestorPlantillas ? 'bg-gray-100 dark:bg-[#32353c] text-gray-900 dark:text-white' : 'hover:bg-white/5'}`} title="Plantillas">
                                <span className="material-symbols-outlined">folder_special</span>
                            </button>
                            
                            {/* Templates Dropdown Overlay */}
                            {mostrarGestorPlantillas && (
                                <div className="absolute right-0 top-12 w-72 bg-white dark:bg-[#1d2027] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-top-2">
                                    <div className="font-bold text-gray-900 dark:text-[#e0e2ec] text-xs mb-3 uppercase tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">bookmark_added</span> Mis Plantillas</div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 mb-3 pr-2">
                                        {plantillasDoctora.length === 0 ? (
                                            <p className="text-gray-500 dark:text-[#849491] text-[11px]">No hay plantillas guardadas.</p>
                                        ) : plantillasDoctora.map(pt => (
                                            <div key={pt.id} className="bg-gray-50 dark:bg-[#272a31] p-2 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col gap-2">
                                                {plantillaEditando?.id === pt.id ? (
                                                    <div className="flex gap-2">
                                                        <input value={plantillaEditando.nombre} onChange={e => setPlantillaEditando(p => ({...p, nombre: e.target.value}))} className="flex-1 bg-gray-50 dark:bg-[#10131a] border border-gray-200 dark:border-white/10 rounded px-2 py-1 text-xs text-gray-900 dark:text-white outline-none focus:border-black"/>
                                                        <button onClick={actualizarPlantillaGuardada} className="bg-emerald-500/20 text-emerald-400 p-1 rounded"><span className="material-symbols-outlined text-xs">check</span></button>
                                                        <button onClick={() => setPlantillaEditando(null)} className="bg-white/5 text-slate-400 p-1 rounded"><span className="material-symbols-outlined text-xs">close</span></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-xs font-bold text-[#cfd3db]">{pt.nombre}</div>
                                                            <div className="text-[9px] text-gray-500 dark:text-[#849491] uppercase">{TIPO_PLANTILLAS.find(t=>t.id===pt.tipoPlantilla)?.label || ''}</div>
                                                        </div>
                                                        <div className="flex gap-1 border-l border-gray-200 dark:border-white/10 pl-2">
                                                            <button onClick={() => aplicarPlantillaGuardada(pt)} className="p-1 text-[#4afdef] hover:bg-[#4afdef]/10 rounded" title="Aplicar"><span className="material-symbols-outlined text-[14px]">done_all</span></button>
                                                            <button onClick={() => setPlantillaEditando({...pt})} className="p-1 text-gray-600 dark:text-[#bacac7] hover:bg-white/10 rounded"><span className="material-symbols-outlined text-[14px]">edit</span></button>
                                                            <button onClick={() => eliminarPlantillaGuardada(pt.id)} className="p-1 text-rose-400 hover:bg-rose-500/10 rounded"><span className="material-symbols-outlined text-[14px]">delete</span></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-white/5">
                                        <input value={nombreNuevaPlantilla} onChange={e=>setNombreNuevaPlantilla(e.target.value)} placeholder="Nueva plantilla..." className="flex-1 bg-gray-50 dark:bg-[#10131a] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:border-[#4afdef] placeholder:text-gray-500 dark:text-[#849491]"/>
                                        <button onClick={guardarComoPlantilla} className="bg-[#4afdef]/20 text-[#4afdef] hover:bg-[#4afdef]/30 border border-[#4afdef]/30 rounded-lg px-2.5 flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-sm">add</span></button>
                                    </div>
                                </div>
                            )}
                          </div>
                      )}
                  </header>

                  <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-6 pt-5 pb-8">
                       {!canEdit && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-3 items-center">
                                <span className="material-symbols-outlined text-amber-500 text-[18px]">visibility</span>
                                <span className="text-xs text-amber-500/90 font-label leading-tight">Modo solo lectura. Reservado para el personal médico.</span>
                            </div>
                       )}

                       {/* Status / Signature Box */}
                       {canEdit && (
                           <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${estudioActual?.firmaDigital ? 'bg-[#4afdef]/5 border-[#4afdef]/30 shadow-[0_0_15px_rgba(74,253,239,0.05)]' : 'bg-white dark:bg-[#191b23] border-gray-200 dark:border-white/5'}`}>
                               <div>
                                   <span className={`text-xs font-bold ${estudioActual?.firmaDigital ? 'text-black' : 'text-slate-300'}`}>Firma Digital</span>
                                   <p className="text-[9px] font-label text-gray-500 dark:text-[#849491] uppercase mt-0.5 max-w-[180px] leading-tight truncate">
                                       {estudioActual?.firmaDigital ? `Verificada por Dr(a). ${estudioActual?.firmadoPor?.nombre || sesion?.nombre}` : 'Requiere validación final'}
                                   </p>
                               </div>
                               <label className={`relative inline-flex items-center ${estudioActual?.firmaDigital ? 'cursor-default' : 'cursor-pointer'}`}>
                                    <input type="checkbox" className="sr-only peer" checked={Boolean(estudioActual?.firmaDigital)} disabled={firmandoResultado || estudioActual?.firmaDigital} onChange={e=>marcarFirmaResultado(e.target.checked)}/>
                                    <div className="w-9 h-5 bg-gray-100 dark:bg-[#32353c] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#10131a] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#bacac7] after:border-gray-200 dark:border-white/10 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00ded1] peer-checked:after:bg-gray-50 dark:bg-[#10131a]"></div>
                                </label>
                           </div>
                       )}

                       <div className="space-y-4">
                           <div className="space-y-1.5">
                               <label className="text-[9px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest ml-1 font-bold">Tipo de Estudio</label>
                               <select value={tipoPlantilla} onChange={e => setTipoPlantilla(e.target.value)} disabled={!canEdit}
                                       className="w-full bg-gray-100 dark:bg-[#32353c] border border-transparent rounded-lg text-[13px] font-label py-2.5 px-3 focus:outline-none focus:ring-1 focus:ring-[#4afdef]/50 text-gray-900 dark:text-white appearance-none disabled:opacity-70 disabled:bg-white dark:bg-[#191b23]">
                                   {TIPO_PLANTILLAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                               </select>
                           </div>
                           
                           {tipoActual.campos.includes('birads') && (
                               <div className="space-y-1.5">
                                   <label className="text-[9px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest ml-1 font-bold">Categoría BIRADS</label>
                                   <select value={reporte['birads'] || ''} onChange={e => canEdit && setReporte(p => ({...p, birads: e.target.value}))} disabled={!canEdit}
                                           className="w-full bg-gray-100 dark:bg-[#32353c] border border-transparent rounded-lg text-[13px] font-label py-2.5 px-3 focus:outline-none focus:ring-1 focus:ring-[#4afdef]/50 text-gray-900 dark:text-white appearance-none disabled:opacity-70 disabled:bg-white dark:bg-[#191b23]">
                                       <option value="">Seleccionar BIRADS</option>
                                       {['0', '1', '2', '3', '4A', '4B', '4C', '5', '6'].map(b => <option key={b} value={b}>BIRADS {b}</option>)}
                                   </select>
                               </div>
                           )}
                       </div>

                       {/* Dynamic Text Areas */}
                       <div className="space-y-5">
                            {tipoActual.campos.filter(c => c !== 'birads').map(campo => (
                                <div key={campo} className="group flex flex-col">
                                    <label className="text-[9px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest ml-1 mb-1.5 font-bold transition-colors group-focus-within:text-[#4afdef]">{CAMPO_LABELS[campo]}</label>
                                    <textarea 
                                        value={reporte[campo] || ''}
                                        onChange={e => canEdit && setReporte(p => ({...p, [campo]: e.target.value}))}
                                        readOnly={!canEdit}
                                        placeholder={canEdit ? 'Esperando entrada...' : 'Sin información.'}
                                        className={`w-full bg-white dark:bg-[#191b23] border border-gray-300 dark:border-[#32353c] border-b-2 group-focus-within:border-b-[#4afdef] rounded-lg text-[13px] font-body text-gray-900 dark:text-[#e0e2ec] p-3 focus:outline-none transition-all resize-none custom-scrollbar placeholder:text-gray-500 dark:text-[#849491]/40 ${!canEdit ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        style={{ minHeight: campo === 'hallazgos' ? '140px' : '80px' }}
                                    />
                                </div>
                            ))}
                       </div>
                  </div>

                  {canEdit && (
                      <footer className="p-6 pt-5 border-t border-gray-200 dark:border-white/5 bg-[#1a1d24]/90 space-y-3 shrink-0">
                          <button onClick={() => guardarReporte()} disabled={guardando} 
                                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-gray-200 dark:border-white/5 rounded-xl font-headline text-[13px] font-bold text-gray-600 dark:text-[#bacac7] hover:text-gray-900 dark:text-white transition-all flex justify-center items-center gap-2">
                               {guardando ? <span className="material-symbols-outlined animate-spin text-[16px]">autorenew</span> : null}
                               {guardando ? 'Guardando...' : 'Guardar Borrador'}
                          </button>
                          <button onClick={finalizarReporte} disabled={guardando} 
                                  className="w-full py-3 bg-gradient-to-br from-[#4afdef] to-[#00ded1] text-slate-900 font-headline font-black rounded-xl text-[13px] hover:shadow-[0_0_20px_rgba(74,253,239,0.3)] hover:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg">
                              <span className="material-symbols-outlined text-[18px]">verified</span>
                              Finalizar y Completar
                          </button>
                      </footer>
                  )}
              </aside>

      </main>
    </div>
  );
};

export default Imagenologia;
