/**
 * DicomViewer.js — Visor médico DICOM con Cornerstone.js
 * Soporta DICOM (.dcm) e imágenes estándar (JPG, PNG)
 * Herramientas clínicas: WW/WL, Zoom, Pan, Longitud, ROI, Ángulo, Densidad, Anotaciones
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import cornerstoneTools from 'cornerstone-tools';
import cornerstoneMath from 'cornerstone-math';
import Hammer from 'hammerjs';
import dicomParser from 'dicom-parser';

/* ─── Inicialización única ──────────────────────────────────── */
let csInit = false;
function initCS() {
    if (csInit) return true;
    try {
        cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
        cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

        // CONFIGURACIÓN DE SEGURIDAD: Añadir Token Bearer a las peticiones de imágenes
        const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

        // Configurar Web Workers para WADO
        const baseUrl = window.location.origin;
        cornerstoneWADOImageLoader.configure({
            useWebWorkers: true,
            webWorkerPath: `${baseUrl}/cornerstoneWADOImageLoaderWebWorker.js`,
            taskConfiguration: {
                decodeTask: {
                    initializeCodecsOnStartup: true,
                },
            },
            beforeSend: function (xhr) {
                const token = getToken();
                if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            }
        });

        // Registrar loader de imágenes web (JPG, PNG)
        cornerstone.registerImageLoader('webImageLoader', (imageId) => {
            const url = imageId.replace('webImageLoader:', '');
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    
                    // Convertir RGBA a escala de grises para permitir ajuste W/L
                    const pixelData = new Uint16Array(img.width * img.height);
                    const data = imageData.data;
                    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                        // Fórmula de luminancia: 0.299*R + 0.587*G + 0.114*B
                        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                        pixelData[j] = gray;
                    }
                    
                    const image = {
                        imageId: imageId,
                        minPixelValue: 0,
                        maxPixelValue: 255,
                        slope: 1,
                        intercept: 0,
                        windowCenter: 128,
                        windowWidth: 255,
                        render: cornerstone.renderGrayscaleImage,
                        getPixelData: () => pixelData,
                        rows: img.height,
                        columns: img.width,
                        width: img.width,
                        height: img.height,
                        color: false,
                        rgba: false,
                        columnPixelSpacing: 1,
                        rowPixelSpacing: 1,
                        invert: false,
                        sizeInBytes: img.width * img.height * 2
                    };
                    resolve(image);
                };
                img.onerror = (e) => {
                    // Resolver con null para evitar runtime error de Cornerstone
                    resolve(null);
                };
                
                try {
                    img.src = url;
                } catch (e) {
                    reject(new Error('Failed to load image'));
                }
            });
        });

        cornerstoneTools.external.cornerstone = cornerstone;
        cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
        cornerstoneTools.external.Hammer = Hammer;
        cornerstoneTools.init({ showSVGCursors: false, preventAntiAliasing: false });

        csInit = true;
        return true;
    } catch (e) {
        console.error('Cornerstone init error:', e);
        return false;
    }
}

/* ─── Herramientas disponibles ──────────────────────────────── */
const TOOLS = [
    { id: 'Wwwc', icon: '☀️', label: 'W/L', tip: 'Brillo / Contraste' },
    { id: 'Zoom', icon: '🔍', label: 'Zoom', tip: 'Zoom con arrastre' },
    { id: 'Pan', icon: '✋', label: 'Pan', tip: 'Mover imagen' },
    { id: 'Length', icon: '📏', label: 'Longitud', tip: 'Medir distancia' },
    { id: 'RectangleRoi', icon: '⬜', label: 'ROI', tip: 'Región de interés' },
    { id: 'Angle', icon: '📐', label: 'Ángulo', tip: 'Medir ángulo' },
    { id: 'EllipticalRoi', icon: '⭕', label: 'Elipse', tip: 'ROI elíptica' },
    { id: 'Probe', icon: '📌', label: 'HU', tip: 'Valor Hounsfield' },
    { id: 'ArrowAnnotate', icon: '➡️', label: 'Nota', tip: 'Añadir anotación' },
    { id: 'Eraser', icon: '🗑', label: 'Borrar', tip: 'Borrar medición' },
];

/* ─── Presets clínicos WW/WL ────────────────────────────────── */
const WL_PRESETS = [
    { label: 'Pulmón', ww: 1500, wc: -600 },
    { label: 'Hueso', ww: 2000, wc: 400 },
    { label: 'Cerebro', ww: 80, wc: 40 },
    { label: 'Abdomen', ww: 350, wc: 60 },
    { label: 'Hígado', ww: 150, wc: 60 },
    { label: 'Mediastino', ww: 350, wc: 50 },
    { label: 'Columna', ww: 1800, wc: 400 },
    { label: 'Auto', ww: null, wc: null },
];

/* ─── Helper: normalizar URL ────────────────────────────────── */
function normUrl(img) {
    if (!img) return '';
    const raw = typeof img === 'string' ? img : (img.url || img.path || img.src || '');
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http')) return raw;
    return '/' + raw.replace(/^\/+/, '');
}

/* ─── Registrar herramientas (una sola vez por sesión) ──────── */
let toolsRegistered = false;
function registerTools() {
    if (toolsRegistered) return;
    TOOLS.forEach(t => {
        try {
            const C = cornerstoneTools[t.id + 'Tool'];
            if (C) cornerstoneTools.addTool(C);
        } catch (_) { }
    });
    toolsRegistered = true;
}

/* ═══════════════════ COMPONENTE ════════════════════════════════ */
const DicomViewer = ({ imagenes = [], ajustesIniciales = {}, onCambioAjustes = null, onImagenCargada = null, estiloContenedor = {} }) => {
    const containerRef = useRef(null);
    const containerRef2 = useRef(null); // Segundo viewport para comparación
    const [ready, setReady] = useState(false);
    const [ready2, setReady2] = useState(false);
    const [tool, setTool] = useState('Wwwc');
    const [idx, setIdx] = useState(0);
    const [idx2, setIdx2] = useState(1); // Segundo índice para comparación
    const [comparisonMode, setComparisonMode] = useState(false); // Modo comparación
    const [flipH, setFlipH] = useState(ajustesIniciales.flipH || false);
    const [flipV, setFlipV] = useState(ajustesIniciales.flipV || false);
    const [invert, setInvert] = useState(ajustesIniciales.invertido || false);
    const [rot, setRot] = useState(ajustesIniciales.rotacion || 0);
    const [info, setInfo] = useState({ ww: ajustesIniciales.ww || 0, wc: ajustesIniciales.wc || 0, zoom: ajustesIniciales.zoom || '1.00', x: 0, y: 0, hu: '' });
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [fallbackImage, setFallbackImage] = useState(null);

    const readyRef = useRef(false);
    const readyRef2 = useRef(false);

    /* ── Habilitar Cornerstone cuando el elemento tiene tamaño ── */
    useEffect(() => {
        const ok = initCS();
        if (!ok) { setErr('Error iniciando Cornerstone. Refresque la página.'); return; }

        const el = containerRef.current;
        if (!el) return;

        // Esperar a que el elemento tenga dimensiones reales
        const tryEnable = () => {
            if (readyRef.current) return;
            if (el.offsetWidth < 10 || el.offsetHeight < 10) return; // aún sin tamaño
            try {
                cornerstone.enable(el);
                registerTools();
                setReady(true);
                readyRef.current = true;
                console.log("DicomViewer: Visor habilitado (ready)");
            } catch (e) {
                console.error("DicomViewer Error:", e);
                setErr('No se pudo inicializar el visor: ' + e.message);
            }
        };

        // Manejar tanto el "ready" inicial como los cambios de tamaño posteriores (ej: ocultar reporte)
        const ro = new ResizeObserver(() => {
            if (!readyRef.current) {
                tryEnable();
            } else {
                try {
                    cornerstone.resize(el, true);
                    cornerstone.updateImage(el);
                } catch (e) { console.warn("ResizeObserver fail:", e); }
            }
        });

        ro.observe(el);
        tryEnable();

        return () => {
            ro.disconnect();
            if (readyRef.current) {
                try { cornerstone.disable(el); } catch (_) { }
                readyRef.current = false;
                setReady(false);
            }
        };
    }, []); // eslint-disable-line

    /* ── Cargar imagen cuando cambia índice ──────────────────── */
    useEffect(() => {
        if (!ready || !imagenes.length) return;
        console.log('DicomViewer: Cargando imagen índice', idx, 'de', imagenes.length);
        setFallbackImage(null); // Limpiar fallback al cambiar imagen
        loadImage(imagenes[idx]);
    }, [ready, idx]); // eslint-disable-line

    /* ── Recargar cuando cambia la lista de imágenes ───── */
    useEffect(() => {
        if (!ready) return;
        console.log('DicomViewer: Lista de imágenes cambió, length:', imagenes.length);
        setFallbackImage(null);
        if (imagenes.length > 0) {
            const safeIdx = Math.min(idx, imagenes.length - 1);
            if (safeIdx !== idx) setIdx(safeIdx);
            else loadImage(imagenes[safeIdx]);
        }
    }, [imagenes, ready]); // eslint-disable-line

    const loadImage = useCallback(async (imgData) => {
        const el = containerRef.current;
        if (!el || !imgData) {
            console.log('DicomViewer: No element or imgData', { el: !!el, imgData: !!imgData });
            return;
        }
        setLoading(true); setErr('');
        
        try {
            const url = normUrl(imgData);
            console.log('DicomViewer: normUrl result:', url, 'from imgData:', imgData);
            if (!url) {
                setLoading(false);
                setErr('URL de imagen inválida');
                return;
            }
            
            const isAbsoluteUrl = url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:');
            const fullUrl = isAbsoluteUrl ? url : window.location.origin + url;
            console.log('DicomViewer: fullUrl:', fullUrl);
            
            // Intentar loaders en orden: web primero, luego DICOM
            const ids = [
                'webImageLoader:' + fullUrl,
                'wadouri:' + fullUrl,
            ];
            
            let lastError = null;
            for (const imageId of ids) {
                try {
                    console.log('DicomViewer: Intentando cargar:', imageId);
                    const image = await cornerstone.loadAndCacheImage(imageId);
                    // Verificar si la imagen es null (webImageLoader falló)
                    if (!image) {
                        console.warn(`DicomViewer: Loader returned null for ${imageId}`);
                        continue;
                    }
                    console.log('DicomViewer: Imagen cargada exitosamente:', imageId);
                    cornerstone.displayImage(el, image);
                    const vp = cornerstone.getViewport(el);
                    if (vp) {
                        vp.invert = invert;
                        vp.rotation = rot;
                        vp.hflip = flipH;
                        vp.vflip = flipV;
                        if (ajustesIniciales.ww) {
                            vp.voi.windowWidth = ajustesIniciales.ww;
                            vp.voi.windowCenter = ajustesIniciales.wc;
                        }
                        if (ajustesIniciales.zoom && ajustesIniciales.zoom !== '1.00') {
                            vp.scale = parseFloat(ajustesIniciales.zoom);
                        }
                        cornerstone.setViewport(el, vp);
                        cornerstone.updateImage(el);
                        setInfo(p => ({
                            ...p,
                            ww: Math.round(vp.voi?.windowWidth || image.windowWidth || 0),
                            wc: Math.round(vp.voi?.windowCenter || image.windowCenter || 0),
                            zoom: (vp.scale || 1).toFixed(2),
                        }));
                    }
                    activateTool(tool);
                    // Forzar activación de Wwwc si es la herramienta actual para asegurar que el ajuste manual funcione
                    if (tool === 'Wwwc') {
                        try {
                            cornerstoneTools.setToolActiveForElement(el, 'Wwwc', { mouseButtonMask: 1 });
                        } catch (_) {}
                    }
                    setLoading(false);
                    return;
                } catch (err) {
                    lastError = err;
                    console.warn(`DicomViewer: Failed to load ${imageId}`, err?.message || err);
                    continue;
                }
            }
            
            // Si todos los loaders de Cornerstone fallaron, usar fallback simple
            console.error('DicomViewer: All loaders failed for', fullUrl, lastError);
            setFallbackImage(fullUrl);
            setLoading(false);
            
        } catch (unexpectedError) {
            console.error('DicomViewer: Unexpected error in loadImage:', unexpectedError);
            setLoading(false);
        }
    }, [ready, invert, rot, flipH, flipV, tool, ajustesIniciales]);

    /* ── Activar herramienta ─────────────────────────────────── */
    const activateTool = (tid) => {
        const el = containerRef.current;
        if (!el) return;
        TOOLS.forEach(t => { try { cornerstoneTools.setToolPassiveForElement(el, t.id); } catch (_) { } });
        try { cornerstoneTools.setToolActiveForElement(el, tid, { mouseButtonMask: 1 }); } catch (_) { }
    };

    const selectTool = (tid) => { setTool(tid); activateTool(tid); };

    /* ── Aplicar cambios de viewport ──────────────────────────── */
    const applyVP = useCallback((patch) => {
        const el = containerRef.current;
        if (!el) return;
        try {
            const vp = cornerstone.getViewport(el);
            if (!vp) return;
            Object.assign(vp, patch);
            cornerstone.setViewport(el, vp);
            cornerstone.updateImage(el);

            // Notificar arriba
            if (onCambioAjustes) {
                const nWw = patch.voi ? patch.voi.windowWidth : info.ww;
                const nWc = patch.voi ? patch.voi.windowCenter : info.wc;
                const nInvert = 'invert' in patch ? patch.invert : invert;
                const nRot = 'rotation' in patch ? patch.rotation : rot;
                const nFlipH = 'hflip' in patch ? patch.hflip : flipH;
                const nFlipV = 'vflip' in patch ? patch.vflip : flipV;
                const nZoom = patch.scale ? patch.scale.toFixed(2) : info.zoom;

                onCambioAjustes({
                    ww: nWw, wc: nWc, zoom: nZoom,
                    invertido: nInvert, rotacion: nRot,
                    flipH: nFlipH, flipV: nFlipV
                });
            }
        } catch (_) { }
    }, [info.ww, info.wc, info.zoom, invert, rot, flipH, flipV, onCambioAjustes]);

    useEffect(() => { if (ready) applyVP({ invert, rotation: rot, hflip: flipH, vflip: flipV }); },
        [invert, rot, flipH, flipV]); // eslint-disable-line

    /* EVENTOS DE CORNERSTONE (drag ajustando brillo/contraste/zoom) */
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !ready) return;
        const onImageRendered = (e) => {
            const vp = e.detail.viewport;
            if (!vp) return;
            const newWw = Math.round(vp.voi.windowWidth);
            const newWc = Math.round(vp.voi.windowCenter);
            const newZoom = vp.scale.toFixed(2);

            // Actualizar solo si cambió
            if (newWw !== info.ww || newWc !== info.wc || newZoom !== info.zoom) {
                setInfo(p => ({ ...p, ww: newWw, wc: newWc, zoom: newZoom }));
                if (onCambioAjustes) {
                    onCambioAjustes({
                        ww: newWw, wc: newWc, zoom: newZoom,
                        invertido: invert, rotacion: rot, flipH, flipV
                    });
                }
            }
        };
        el.addEventListener('cornerstoneimagerendered', onImageRendered);
        return () => el.removeEventListener('cornerstoneimagerendered', onImageRendered);
    }, [ready, info.ww, info.wc, info.zoom, invert, rot, flipH, flipV, onCambioAjustes]);

    /* ── Acciones de viewport ────────────────────────────────── */
    const setWL = (ww, wc) => {
        if (ww === null) return; // Auto: no hacer nada
        applyVP({ voi: { windowWidth: ww, windowCenter: wc } });
        setInfo(p => ({ ...p, ww, wc }));
    };
    const zoom = (f) => { const el = containerRef.current; try { const vp = cornerstone.getViewport(el); vp.scale *= f; cornerstone.setViewport(el, vp); cornerstone.updateImage(el); setInfo(p => ({ ...p, zoom: vp.scale.toFixed(2) })); } catch (_) { } };
    const resetVP = () => {
        try {
            cornerstone.reset(containerRef.current);
            setFlipH(false); setFlipV(false); setInvert(false); setRot(0);
            if (onCambioAjustes) onCambioAjustes({ ww: null, wc: null, zoom: '1.00', invertido: false, rotacion: 0, flipH: false, flipV: false });
        } catch (_) { }
    };
    const clearMeasures = () => {
        const el = containerRef.current;
        TOOLS.forEach(t => { try { const s = cornerstoneTools.getToolState(el, t.id); if (s?.data) s.data = []; } catch (_) { } });
        try { cornerstone.updateImage(el); } catch (_) { }
    };
    /* Exponer función de captura al componente padre (usando un id fijo o ref, aquí usaremos ID temporal) */
    useEffect(() => {
        window.__capturarVisorDicomActivo = () => {
            try {
                const c = containerRef.current?.querySelector('canvas');
                return c ? c.toDataURL('image/jpeg', 0.9) : null;
            } catch (_) { return null; }
        };
        return () => { window.__capturarVisorDicomActivo = null; };
    }, []);
    const capture = () => {
        try {
            const c = containerRef.current?.querySelector('canvas');
            if (c) { const a = document.createElement('a'); a.download = `dicom-${Date.now()}.png`; a.href = c.toDataURL(); a.click(); }
        } catch (_) { }
    };

    /* ── Evento de mousemove para HU ─────────────────────────── */
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !ready) return;
        const onMove = (e) => {
            try {
                const img = cornerstone.getImage(el);
                if (!img) return;
                const r = el.getBoundingClientRect();
                const pt = cornerstone.pageToPixel(el, e.clientX - r.left, e.clientY - r.top);
                if (pt && pt.x >= 0 && pt.y >= 0 && pt.x < img.width && pt.y < img.height) {
                    const hu = img.getPixelData ? img.getPixelData()[Math.round(pt.y) * img.width + Math.round(pt.x)] : '';
                    setInfo(p => ({ ...p, x: Math.round(pt.x), y: Math.round(pt.y), hu }));
                }
            } catch (_) { }
        };
        el.addEventListener('mousemove', onMove);
        return () => el.removeEventListener('mousemove', onMove);
    }, [ready]);

    /* ── Implementación manual de W/L drag ───────────────────── */
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !ready || tool !== 'Wwwc') return;
        
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        
        const onMouseDown = (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
        };
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            
            // Actualizar posición para siguiente frame
            lastX = e.clientX;
            lastY = e.clientY;
            
            // Ajuste incremental basado en delta
            const elViewport = containerRef.current;
            if (!elViewport) return;
            
            try {
                const vp = cornerstone.getViewport(elViewport);
                if (!vp || !vp.voi) return;
                
                // dx afecta WW (contraste) - movimiento horizontal
                // dy afecta WC (brillo) - movimiento vertical
                const sensitivity = 2;
                const newWW = Math.max(1, vp.voi.windowWidth + dx * sensitivity);
                const newWC = vp.voi.windowCenter - dy * sensitivity;
                
                vp.voi.windowWidth = newWW;
                vp.voi.windowCenter = newWC;
                cornerstone.setViewport(elViewport, vp);
                cornerstone.updateImage(elViewport);
                
                setInfo(p => ({ ...p, ww: Math.round(newWW), wc: Math.round(newWC) }));
            } catch (_) {}
        };
        
        const onMouseUp = (e) => {
            if (isDragging) {
                isDragging = false;
                e.preventDefault();
            }
        };
        
        el.addEventListener('mousedown', onMouseDown, { capture: true });
        window.addEventListener('mousemove', onMouseMove, { passive: false });
        window.addEventListener('mouseup', onMouseUp);
        
        return () => {
            el.removeEventListener('mousedown', onMouseDown, { capture: true });
            window.removeEventListener('mousemove', onMouseMove, { passive: false });
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [ready, tool]);

    /* ── Navegación con teclado (flechas) ─────────────────────── */
    useEffect(() => {
        if (imagenes.length <= 1) return;
        
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setIdx(i => Math.max(0, i - 1));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setIdx(i => Math.min(imagenes.length - 1, i + 1));
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [imagenes.length]);

    /* ── Cargar archivo local ──────────────────────────────────  */
    const loadLocalFile = (file) => {
        console.log('DicomViewer: loadLocalFile llamado con archivo:', file?.name, file?.type, file?.size);
        if (!file) {
            console.log('DicomViewer: No hay archivo, retornando');
            return;
        }
        const blobUrl = URL.createObjectURL(file);
        console.log('DicomViewer: Blob URL creado:', blobUrl);
        const nuevaImagen = {
            url: blobUrl,
            nombre: file.name,
            tipo: file.type,
            file: file,
            size: file.size,
            esTemporal: true
        };
        // Notificar al componente padre para que agregue la imagen a la lista
        if (onImagenCargada) {
            console.log('DicomViewer: Llamando onImagenCargada con:', nuevaImagen);
            onImagenCargada(nuevaImagen);
        } else {
            console.log('DicomViewer: onImagenCargada no está definido');
        }
    };

    /* ─────────────────── RENDER ─────────────────────────────── */
    const Btn = ({ onClick, children, title, active }) => (
        <button onClick={onClick} title={title} style={{
            background: active ? '#1565c0' : 'rgba(255,255,255,0.07)',
            border: active ? '1.5px solid #82b1ff' : '1px solid rgba(255,255,255,0.1)',
            color: 'white', borderRadius: 7, padding: '6px 9px',
            cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.12s', whiteSpace: 'nowrap',
        }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        >{children}</button>
    );

    const Sep = () => <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.13)', margin: '0 3px' }} />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0f1a', ...estiloContenedor }}>

            {/* ── Toolbar principal ── */}
            <div style={{ padding: '7px 10px', background: '#111c2e', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {TOOLS.map(t => <Btn key={t.id} onClick={() => selectTool(t.id)} title={t.tip} active={tool === t.id}>{t.icon} {t.label}</Btn>)}
                <Sep />
                <Btn onClick={() => setRot(r => (r - 90 + 360) % 360)} title="Rotar -90°">↺</Btn>
                <Btn onClick={() => setRot(r => (r + 90) % 360)} title="Rotar +90°">↻</Btn>
                <Btn onClick={() => setFlipH(h => !h)} title="Voltear H" active={flipH}>⇄ H</Btn>
                <Btn onClick={() => setFlipV(v => !v)} title="Voltear V" active={flipV}>⇅ V</Btn>
                <Btn onClick={() => setInvert(i => !i)} title="Invertir" active={invert}>◑ Inv</Btn>
                <Sep />
                <Btn onClick={() => zoom(1.2)} title="Acercar">🔍+</Btn>
                <Btn onClick={() => zoom(1 / 1.2)} title="Alejar">🔍−</Btn>
                <Btn onClick={resetVP} title="Restablecer">⟲ Reset</Btn>
                <Btn onClick={clearMeasures} title="Borrar medidas">🗑 Medidas</Btn>
                <Btn onClick={capture} title="Captura PNG">📸</Btn>
                <Sep />
                <Btn onClick={() => setComparisonMode(c => !c)} title="Comparar imágenes" active={comparisonMode}>⚖️ Comparar</Btn>
                <Sep />
                <label title="Subir imagen" style={{ padding: '6px 12px', background: '#1565c0', border: '1px solid #4afdef', color: 'white', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', boxShadow: '0 0 10px rgba(21,101,192,0.5)' }}>
                    📂 Subir
                    <input type="file" accept=".dcm,.DCM,image/*" style={{ display: 'none' }} onChange={e => loadLocalFile(e.target.files[0])} />
                </label>
            </div>

            {/* ── Presets WW/WL + info ── */}
            <div style={{ padding: '4px 10px', background: '#0d1826', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#82b1ff', fontSize: 11, fontWeight: 700 }}>VENTANA:</span>
                {WL_PRESETS.map(p => (
                    <button key={p.label} onClick={() => setWL(p.ww, p.wc)} style={{ padding: '3px 9px', background: 'rgba(130,177,255,0.1)', border: '1px solid rgba(130,177,255,0.25)', color: '#82b1ff', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{p.label}</button>
                ))}
                <span style={{ marginLeft: 8, color: '#666', fontSize: 11 }}>
                    WW:<strong style={{ color: '#aaa' }}>{info.ww}</strong>&nbsp;
                    WC:<strong style={{ color: '#aaa' }}>{info.wc}</strong>&nbsp;
                    Zoom:<strong style={{ color: '#aaa' }}>{info.zoom}×</strong>
                    {info.hu !== '' && <>&nbsp;HU(<strong style={{ color: '#82b1ff' }}>{info.x},{info.y}</strong>):<strong style={{ color: '#fff' }}>{info.hu}</strong></>}
                </span>
            </div>

            {/* ── Cuerpo: miniaturas + canvas ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Miniaturas */}
                <div style={{ width: 76, background: '#060c17', borderRight: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', padding: 5, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {imagenes.map((img, i) => {
                        const url = normUrl(img);
                        const isWeb = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
                        return (
                            <div key={i} onClick={() => setIdx(i)} style={{
                                border: i === idx ? '2px solid #82b1ff' : '2px solid rgba(255,255,255,0.05)',
                                borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                                background: '#111c2e', minHeight: 56,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                            }}>
                                {isWeb
                                    ? <img src={(url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:') ? url : window.location.origin + url)} alt="" style={{ width: '100%', height: 56, objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                    : <div style={{ color: '#82b1ff', fontSize: 9, textAlign: 'center', padding: 2 }}>DICOM<br />{i + 1}</div>
                                }
                                <span style={{ position: 'absolute', bottom: 1, right: 3, color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>{i + 1}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Área del canvas cornerstone - Modo comparación soportado */}
                <div style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', flexDirection: comparisonMode ? 'row' : 'column' }}>
                    {/* Primer viewport */}
                    <div style={{ flex: 1, position: 'relative', borderRight: comparisonMode ? '2px solid #333' : 'none' }}>
                        {comparisonMode && (
                            <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 20, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4, color: '#82b1ff', fontSize: 11 }}>
                                Imagen {idx + 1}
                            </div>
                        )}
                        <div
                            ref={containerRef}
                            style={{ width: '100%', height: '100%', background: '#000' }}
                            onContextMenu={e => e.preventDefault()}
                            onWheel={e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 0.88); }}
                        />
                    </div>
                    
                    {/* Segundo viewport (solo en modo comparación) */}
                    {comparisonMode && imagenes.length > 1 && (
                        <div style={{ flex: 1, position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 20, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4, color: '#82b1ff', fontSize: 11 }}>
                                Imagen {idx2 + 1}
                            </div>
                            <div
                                ref={containerRef2}
                                style={{ width: '100%', height: '100%', background: '#000' }}
                                onContextMenu={e => e.preventDefault()}
                            />
                            {/* Controles del segundo viewport */}
                            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 8, background: 'rgba(17,28,46,0.9)', padding: '5px 10px', borderRadius: 6 }}>
                                <button onClick={() => setIdx2(i => Math.max(0, i - 1))} disabled={idx2 === 0}
                                    style={{ background: 'none', border: 'none', color: idx2 === 0 ? '#333' : '#82b1ff', cursor: idx2 === 0 ? 'not-allowed' : 'pointer', fontSize: 16 }}>◀</button>
                                <span style={{ color: '#888', fontSize: 12 }}>{idx2 + 1} / {imagenes.length}</span>
                                <button onClick={() => setIdx2(i => Math.min(imagenes.length - 1, i + 1))} disabled={idx2 === imagenes.length - 1}
                                    style={{ background: 'none', border: 'none', color: idx2 === imagenes.length - 1 ? '#333' : '#82b1ff', cursor: idx2 === imagenes.length - 1 ? 'not-allowed' : 'pointer', fontSize: 16 }}>▶</button>
                            </div>
                        </div>
                    )}
                    
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
                            <div style={{ color: 'white', textAlign: 'center' }}>
                                <div style={{ fontSize: 32, marginBottom: 8, animation: 'spin 1s linear infinite' }}>⏳</div>
                                <div style={{ fontSize: 13 }}>Cargando imagen DICOM…</div>
                            </div>
                        </div>
                    )}
                    {err && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                            <div style={{ color: '#ef5350', fontSize: 36 }}>⚠️</div>
                            <div style={{ color: '#ef5350', maxWidth: 380, textAlign: 'center', fontSize: 13, lineHeight: 1.5 }}>{err}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Navegación multi-imagen ── */}
            {imagenes.length > 1 && (
                <div style={{ background: '#111c2e', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', color: idx === 0 ? '#333' : '#82b1ff', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 18 }}>◀</button>
                    <span style={{ color: '#888', fontSize: 13 }}>
                        Imagen <strong style={{ color: 'white' }}>{idx + 1}</strong> / {imagenes.length}
                    </span>
                    <button onClick={() => setIdx(i => Math.min(imagenes.length - 1, i + 1))} disabled={idx === imagenes.length - 1}
                        style={{ background: 'none', border: 'none', color: idx === imagenes.length - 1 ? '#333' : '#82b1ff', cursor: idx === imagenes.length - 1 ? 'not-allowed' : 'pointer', fontSize: 18 }}>▶</button>
                </div>
            )}
        </div>
    );
};

export default DicomViewer;
