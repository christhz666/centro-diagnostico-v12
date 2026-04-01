import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useDebounce from '../hooks/useDebounce';

const PortalMedico = () => {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [resultadoDetalle, setResultadoDetalle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [firmandoResultado, setFirmandoResultado] = useState(false);
  const [firmaMedico, setFirmaMedico] = useState('');
  const [medicoSesion, setMedicoSesion] = useState(null);
  const debouncedBusqueda = useDebounce(busqueda, 350);

  const CODIGO_MUESTRA_PREFIX = 'MUE-';
  const CODIGO_MUESTRA_MIN_LENGTH = 13;

  const cargarFirmaSesion = useCallback(async () => {
    try {
      const response = await api.getMe();
      const user = response?.user || response?.data || response || null;
      setMedicoSesion(user);
      setFirmaMedico(user?.firmaDigital || '');
    } catch (err) {
      console.error('Error cargando firma del médico:', err);
    }
  }, []);

  const cargarHistorial = useCallback(async (paciente) => {
    setPacienteSeleccionado(paciente);
    setResultadoDetalle(null);
    setEditando(false);

    try {
      setLoadingHistorial(true);
      const pacienteId = paciente._id || paciente.id;
      const response = await api.getResultadosPorPaciente(pacienteId);
      const datos = response.data || response || [];
      setHistorial(Array.isArray(datos) ? datos : []);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  const buscarPacientes = useCallback(async (queryInput = '') => {
    const query = String(queryInput || '').trim();

    if (!query) {
      try {
        setLoading(true);
        const response = await api.getPacientes({});
        const datos = response.data || response || [];
        setPacientes(Array.isArray(datos) ? datos : []);
      } catch (err) {
        setPacientes([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    const esFormatoSimple = /^L?\d+$/.test(query);
    if (query.length < 2 && !(esFormatoSimple || (query.startsWith(CODIGO_MUESTRA_PREFIX) && query.length >= CODIGO_MUESTRA_MIN_LENGTH))) {
      setPacientes([]);
      return;
    }

    if (esFormatoSimple || (query.startsWith(CODIGO_MUESTRA_PREFIX) && query.length >= CODIGO_MUESTRA_MIN_LENGTH)) {
      try {
        setLoading(true);
        const response = await api.getResultadoPorCodigoMuestra(query);
        const resultado = response.data || response;
        if (resultado && resultado.paciente) {
          const pacienteId = resultado.paciente._id || resultado.paciente.id || resultado.paciente;
          const pacResponse = await api.getPaciente(pacienteId);
          const pac = pacResponse.data || pacResponse;
          setPacientes([pac]);
          await cargarHistorial(pac);
        }
      } catch (err) {
        setPacientes([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const response = await api.getPacientes({ search: query });
      let datos = response.data || response || [];
      if (!Array.isArray(datos)) datos = [];

      if (datos.length === 0) {
        const allResponse = await api.getPacientes({});
        const allDatos = allResponse.data || allResponse || [];
        const busquedaLower = query.toLowerCase();
        datos = allDatos.filter(p =>
          (p.nombre && p.nombre.toLowerCase().includes(busquedaLower)) ||
          (p.apellido && p.apellido.toLowerCase().includes(busquedaLower)) ||
          (p.cedula && p.cedula.includes(query)) ||
          (p.telefono && p.telefono.includes(query))
        );
      }
      setPacientes(datos);
    } catch (err) {
      setPacientes([]);
    } finally {
      setLoading(false);
    }
  }, [cargarHistorial]);

  useEffect(() => {
    cargarFirmaSesion();
  }, [cargarFirmaSesion]);

  const verResultado = (resultado) => {
    setResultadoDetalle(resultado);
    setEditando(false);
  };

  const irAPerfilFirma = useCallback(() => navigate('/perfil'), [navigate]);

  const asegurarFirmaDeSesion = useCallback(() => {
    if (firmaMedico) return true;
    alert('Debe registrar su firma en Mi Perfil antes de validar o imprimir resultados.');
    irAPerfilFirma();
    return false;
  }, [firmaMedico, irAPerfilFirma]);

  const asegurarResultadoFirmado = useCallback(async (resultadoBase) => {
    if (!resultadoBase) return null;
    if (resultadoBase.firmaDigital) return resultadoBase;
    if (!asegurarFirmaDeSesion()) return null;

    const firmado = await api.firmarResultado(resultadoBase._id || resultadoBase.id);
    const resultadoFirmado = {
      ...resultadoBase,
      ...(firmado?.data || firmado || {}),
      firmaDigital: (firmado?.data || firmado || {}).firmaDigital || firmaMedico,
      firmadoPor: (firmado?.data || firmado || {}).firmadoPor || resultadoBase.firmadoPor || medicoSesion,
      validadoPor: (firmado?.data || firmado || {}).validadoPor || resultadoBase.validadoPor
    };
    setResultadoDetalle((prev) => (prev && (prev._id || prev.id) === (resultadoBase._id || resultadoBase.id) ? resultadoFirmado : prev));
    return resultadoFirmado;
  }, [asegurarFirmaDeSesion, firmaMedico, medicoSesion]);

  const marcarFirmaResultado = useCallback(async (checked) => {
    if (!checked || !resultadoDetalle || resultadoDetalle.firmaDigital) return;
    try {
      setFirmandoResultado(true);
      await asegurarResultadoFirmado(resultadoDetalle);
    } catch (err) {
      alert(err.message || 'No se pudo firmar el resultado.');
    } finally {
      setFirmandoResultado(false);
    }
  }, [asegurarResultadoFirmado, resultadoDetalle]);

  const guardarResultado = async () => {
    if (!resultadoDetalle) return;
    try {
      setGuardando(true);
      await api.updateResultado(resultadoDetalle._id || resultadoDetalle.id, {
        valores: resultadoDetalle.valores,
        interpretacion: resultadoDetalle.interpretacion,
        conclusion: resultadoDetalle.conclusion
      });
      setEditando(false);
      alert('Resultado guardado correctamente');
      cargarHistorial(pacienteSeleccionado);
    } catch (err) {
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  const validarResultado = async () => {
    if (!resultadoDetalle) return;
    if (!asegurarFirmaDeSesion()) return;
    const id = resultadoDetalle._id || resultadoDetalle.id;
    try {
      setGuardando(true);
      await api.validarResultado(id, { estado: 'completado' });
      alert('Resultado validado correctamente');
      cargarHistorial(pacienteSeleccionado);
      setResultadoDetalle(null);
    } catch (err) {
      alert('Error al validar: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  const actualizarValor = (index, campo, valor) => {
    const nuevosValores = [...(resultadoDetalle.valores || [])];
    nuevosValores[index] = { ...nuevosValores[index], [campo]: valor };
    setResultadoDetalle({ ...resultadoDetalle, valores: nuevosValores });
  };

  const agregarParametro = () => {
    const nuevosValores = [...(resultadoDetalle.valores || []), { parametro: '', valor: '', unidad: '', valorReferencia: '', estado: 'normal' }];
    setResultadoDetalle({ ...resultadoDetalle, valores: nuevosValores });
  };

  const eliminarParametro = (index) => {
    const nuevosValores = (resultadoDetalle.valores || []).filter((_, i) => i !== index);
    setResultadoDetalle({ ...resultadoDetalle, valores: nuevosValores });
  };

  const calcularEdad = (fecha) => {
    if (!fecha) return 'N/A';
    const hoy = new Date();
    const nac = new Date(fecha);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad + ' años';
  };

  const getSeguroNombre = (pac) => {
    if (!pac?.seguro) return 'Sin seguro';
    if (typeof pac.seguro === 'string') return pac.seguro;
    return pac.seguro.nombre || 'Sin seguro';
  };

  const imprimirResultado = async () => {
    if (!resultadoDetalle || !pacienteSeleccionado) return;
    let resultadoActivo = null;
    try {
      resultadoActivo = await asegurarResultadoFirmado(resultadoDetalle);
    } catch (err) {
      return;
    }
    if (!resultadoActivo) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const ventana = iframe.contentWindow;

    const valoresHTML = (resultadoActivo.valores || []).map(v => {
      const estadoColor = v.estado === 'normal' ? '#d4edda' : v.estado === 'alto' ? '#f8d7da' : '#fff3cd';
      const estadoTexto = v.estado === 'normal' ? '#155724' : v.estado === 'alto' ? '#721c24' : '#856404';
      return `<tr>
        <td style="padding:10px;border:1px solid #87CEEB;">${v.parametro || ''}</td>
        <td style="padding:10px;border:1px solid #87CEEB;text-align:center;font-weight:bold;color:#1a3a5c;">${v.valor || ''} ${v.unidad || ''}</td>
        <td style="padding:10px;border:1px solid #87CEEB;text-align:center;font-size:12px;color:#666;">${v.valorReferencia || '-'}</td>
        <td style="padding:10px;border:1px solid #87CEEB;text-align:center;">
          <span style="padding:4px 12px;border-radius:12px;font-size:11px;background:${estadoColor};color:${estadoTexto};">${v.estado || 'N/A'}</span>
        </td>
      </tr>`;
    }).join('');

    const edadPaciente = calcularEdad(pacienteSeleccionado.fechaNacimiento);
    const nombreEstudio = resultadoActivo.estudio?.nombre || resultadoActivo.nombreEstudio || 'ESTUDIO CLINICO';
    const fechaResultado = new Date(resultadoActivo.createdAt || resultadoActivo.fecha || new Date()).toLocaleDateString('es-DO');
    const doctorNombre = resultadoActivo.firmadoPor?.nombre || resultadoActivo.validadoPor?.nombre || resultadoActivo.medico?.nombre || medicoSesion?.nombre || '________________';
    const doctorApellido = resultadoActivo.firmadoPor?.apellido || resultadoActivo.validadoPor?.apellido || resultadoActivo.medico?.apellido || medicoSesion?.apellido || '';
    const firmaActiva = resultadoActivo.firmaDigital || firmaMedico || '';
    const firmaHtml = firmaActiva ? `<div style="margin-bottom:12px;"><img src="${firmaActiva}" style="max-width:220px;max-height:70px;object-fit:contain;" /></div>` : '<div style="height:60px"></div>';

    let htmlContent = `<!DOCTYPE html><html><head><title>Resultado - ${pacienteSeleccionado.nombre}</title>
      <style>
        @page { size: A4; margin: 10mm 15mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; color: #1a3a5c; font-size: 12px; }
        .header { text-align: center; border-bottom: 3px solid #1a3a5c; padding-bottom: 10px; margin-bottom: 15px; }
        .header img { max-width: 180px; }
        .section-title { background: #1a3a5c; color: white; padding: 8px 15px; border-radius: 5px; margin: 15px 0 10px; font-size: 13px; font-weight: bold; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; background: #f0f8ff; padding: 12px; border-radius: 8px; border-left: 4px solid #1a3a5c; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #1a3a5c; color: white; padding: 10px; text-align: left; font-size: 11px; }
        .firma { margin-top: 50px; text-align: center; }
        .firma-linea { border-top: 2px solid #1a3a5c; width: 200px; margin: 0 auto; padding-top: 8px; }
        .footer { background: #1a3a5c; color: white; padding: 10px; text-align: center; border-radius: 5px; margin-top: 15px; font-size: 10px; }
      </style></head><body>
      <div class="header"><img src="${resultadoActivo.logo_resultados || '/logo-centro.png'}" alt="Centro Diagnóstico" onerror="this.style.display='none'" /><div style="font-size:10px;margin-top:5px;">Reporte clínico generado por el sistema</div></div>
      <div class="section-title">INFORMACION DEL PACIENTE</div>
      <div class="info-grid">
        <div><strong>Paciente:</strong> ${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido || ''}</div>
        <div><strong>Cedula:</strong> ${pacienteSeleccionado.cedula || 'N/A'}</div>
        <div><strong>Edad:</strong> ${edadPaciente}</div>
        <div><strong>Sexo:</strong> ${pacienteSeleccionado.sexo === 'M' ? 'Masculino' : 'Femenino'}</div>
        <div><strong>Nacionalidad:</strong> ${pacienteSeleccionado.nacionalidad || 'Dominicano'}</div>
        <div><strong>Fecha:</strong> ${fechaResultado}</div>
      </div>
      <div class="section-title">RESULTADO: ${nombreEstudio}</div>
      <table><thead><tr><th style="width:35%;">Parametro</th><th style="width:25%;text-align:center;">Resultado</th><th style="width:25%;text-align:center;">Valor Referencia</th><th style="width:15%;text-align:center;">Estado</th></tr></thead><tbody>
      ${valoresHTML || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#999;">Sin valores</td></tr>'}
      </tbody></table>
      ${resultadoActivo.interpretacion ? `<div style="background:#e6f3ff;border-left:4px solid #1a3a5c;padding:10px;border-radius:5px;margin:10px 0;"><strong>INTERPRETACION:</strong><p style="margin:5px 0 0;">${resultadoActivo.interpretacion}</p></div>` : ''}
      ${resultadoActivo.conclusion ? `<div style="background:#e8f5e9;border-left:4px solid #27ae60;padding:10px;border-radius:5px;margin:10px 0;"><strong>CONCLUSION:</strong><p style="margin:5px 0 0;">${resultadoActivo.conclusion}</p></div>` : ''}
      <div class="firma">${firmaHtml}<div class="firma-linea">Dr(a). ${doctorNombre} ${doctorApellido}</div><div style="font-size:10px;color:#666;margin-top:3px;">Firma y Sello</div></div>
      <div class="footer"><strong>Gracias por confiar en nosotros!</strong> | <span style="color:#87CEEB;">Su salud es nuestra prioridad</span></div>
      <script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 250); }); window.addEventListener('afterprint', function () { setTimeout(function () { window.close(); }, 150); });</script>
      </body></html>`;

    ventana.document.write(htmlContent);
    ventana.document.close();
    
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 10000);
  };

  useEffect(() => {
    buscarPacientes(debouncedBusqueda);
  }, [debouncedBusqueda, buscarPacientes]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full h-full pb-8">
      {/* Header moved inside component layout */}
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-headline font-bold text-gray-900 dark:text-[#e0e2ec] tracking-tighter flex items-center gap-3">
              <span className="material-symbols-outlined text-[#4afdef] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_information</span>
              Portal Médico
          </h2>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
        {/* Left Column: Patient Search & List */}
        <section className={`transition-all duration-300 flex-shrink-0 flex flex-col border border-gray-200 dark:border-white/5 bg-white dark:bg-[#191b23] rounded-2xl overflow-hidden shadow-2xl ${pacienteSeleccionado ? 'w-[350px] hidden md:flex' : 'w-full flex'}`}>
          <div className="p-6 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#1d2027]">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#4afdef] transition-colors">search</span>
              <input 
                className="w-full bg-gray-50 dark:bg-[#10131a] border border-gray-200 dark:border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm font-label focus:ring-1 focus:ring-[#4afdef]/50 focus:border-[#4afdef]/50 text-gray-900 dark:text-[#e0e2ec] transition-all placeholder:text-slate-600 outline-none" 
                placeholder="Buscar paciente por nombre o ID..." 
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 custom-scrollbar">
            {loading ? (
                <div className="text-center p-8">
                    <span className="material-symbols-outlined animate-spin text-[#4afdef] text-3xl">autorenew</span>
                </div>
            ) : pacientes.length === 0 ? (
                <p className="text-center text-slate-500 font-label text-sm mt-8">No se encontraron pacientes activos</p>
            ) : (
                pacientes.map(p => {
                    const idSelected = pacienteSeleccionado && ((pacienteSeleccionado._id || pacienteSeleccionado.id) === (p._id || p.id));
                    return (
                        <div 
                           key={p._id || p.id} 
                           onClick={() => cargarHistorial(p)}
                           className={`p-4 rounded-xl cursor-pointer transition-all border ${idSelected ? 'bg-gray-100 dark:bg-[#32353c] border-[#4afdef]/30 shadow-[0_0_15px_rgba(74,253,239,0.05)]' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-gray-200 dark:border-white/10'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-headline font-bold truncate pr-3 ${idSelected ? 'text-gray-900 dark:text-white' : 'text-slate-300'}`}>{p.nombre} {p.apellido}</h4>
                                {idSelected && <span className="text-[9px] font-label px-2 py-0.5 rounded bg-[#4afdef]/10 text-[#4afdef] uppercase tracking-wider flex-shrink-0 border border-[#4afdef]/20">ACTIVO</span>}
                            </div>
                            <p className="text-xs text-slate-500 font-label">ID: {p.cedula || '--'}</p>
                            <div className="mt-2 text-[10px] text-slate-400 font-label flex gap-2">
                                <span><span className="material-symbols-outlined text-[12px] align-middle">phone_iphone</span> {p.telefono || 'N/A'}</span>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </section>

        {/* Right Column: Patient Data & Results (Only mounts when selected) */}
        {pacienteSeleccionado && (
          <section className="flex-1 flex flex-col overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Patient Demographic Bento Box */}
            <div className="bg-[#1d2026]/70 backdrop-blur-xl rounded-2xl p-8 border border-gray-200 dark:border-white/5 grid grid-cols-2 lg:grid-cols-4 gap-6 shadow-xl relative overflow-hidden">
                <div className="space-y-1 relative z-10">
                    <span className="text-[10px] uppercase font-label tracking-widest text-slate-500">Paciente</span>
                    <p className="text-xl font-headline font-bold text-gray-900 dark:text-[#e0e2ec] truncate">{pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}</p>
                </div>
                <div className="space-y-1 relative z-10">
                    <span className="text-[10px] uppercase font-label tracking-widest text-slate-500">Información</span>
                    <p className="text-gray-900 dark:text-[#e0e2ec] font-label text-sm">{calcularEdad(pacienteSeleccionado.fechaNacimiento)} / {pacienteSeleccionado.sexo === 'M' ? 'Masculino' : 'Femenino'}</p>
                </div>
                <div className="space-y-1 relative z-10">
                    <span className="text-[10px] uppercase font-label tracking-widest text-slate-500">Contacto</span>
                    <p className="text-gray-900 dark:text-[#e0e2ec] font-label text-sm">{pacienteSeleccionado.telefono || 'Sin registrar'}</p>
                </div>
                <div className="space-y-1 relative z-10">
                    <span className="text-[10px] uppercase font-label tracking-widest text-slate-500">Seguro Médico</span>
                    <p className="text-[#4afdef] font-label text-sm font-bold" style={{textShadow: '0 0 8px rgba(74,253,239,0.3)'}}>{getSeguroNombre(pacienteSeleccionado)}</p>
                </div>
                
                {/* Visual Flair */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-[#4afdef]/5 rounded-bl-full blur-2xl"></div>
            </div>

            {/* History List or Result View */}
            {!resultadoDetalle ? (
                 <div className="space-y-4">
                     <h3 className="font-headline font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                         <span className="material-symbols-outlined text-[#4afdef]">history</span>
                         Historial de Estudios
                     </h3>
                     
                     {loadingHistorial ? (
                         <div className="p-8 text-center"><span className="material-symbols-outlined animate-spin text-[#4afdef] text-3xl">autorenew</span></div>
                     ) : historial.length === 0 ? (
                         <div className="bg-white dark:bg-[#191b23] border border-gray-200 dark:border-white/5 rounded-2xl p-12 text-center">
                             <span className="material-symbols-outlined text-[#32353c] text-6xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
                             <p className="text-slate-400 font-body">No hay resultados registrados en el historial para este paciente.</p>
                         </div>
                     ) : (
                         <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                             {historial.map(r => {
                                 const completado = (r.estado || 'pendiente').toLowerCase() === 'completado';
                                 return (
                                     <div key={r._id || r.id} onClick={() => verResultado(r)}
                                          className="bg-[#1d2026]/70 backdrop-blur-xl p-5 rounded-xl border border-gray-200 dark:border-white/5 hover:border-[#4afdef]/30 transition-all cursor-pointer shadow-lg group">
                                         <div className="flex justify-between items-start mb-4">
                                             <span className="text-[11px] font-label text-slate-500">{new Date(r.createdAt || r.fecha).toLocaleDateString('es-DO')}</span>
                                             <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-bold border ${completado ? 'bg-[#4afdef]/10 text-[#4afdef] border-[#4afdef]/20 shadow-[0_0_8px_rgba(74,253,239,0.15)]' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                                 {r.estado || 'PENDIENTE'}
                                             </span>
                                         </div>
                                         <h5 className="font-headline font-bold text-slate-200 mb-4 truncate group-hover:text-gray-900 dark:text-white transition-colors">{r.estudio?.nombre || r.nombreEstudio || 'Estudio Clínico'}</h5>
                                         <button className={`${completado ? 'text-[#00e0d3]/70 hover:text-[#00e0d3]' : 'text-slate-500 hover:text-slate-300'} flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors`}>
                                             <span className="material-symbols-outlined text-sm">{completado ? 'visibility' : 'edit_document'}</span> 
                                             {completado ? 'Ver detalles' : 'Examinar'}
                                         </button>
                                     </div>
                                 );
                             })}
                         </div>
                     )}
                 </div>
            ) : (
                /* Detail Modal / Panel */
                <div className="bg-[#1d2026]/90 backdrop-blur-2xl rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 relative">
                    <div className="bg-gray-50 dark:bg-[#272a31] px-6 py-4 flex justify-between items-center border-b border-gray-200 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setResultadoDetalle(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-white/10 transition-colors">
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <div>
                                <h4 className="font-headline font-bold text-gray-900 dark:text-[#e0e2ec]">{resultadoDetalle.estudio?.nombre || resultadoDetalle.nombreEstudio || 'Resultado Clínico'}</h4>
                                <span className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7]">Identificador: #{resultadoDetalle._id?.substring(0,8) || resultadoDetalle.id?.substring(0,8) || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                             {!editando ? (
                                <button onClick={() => setEditando(true)} className="px-4 py-2 bg-gray-100 dark:bg-[#32353c] text-gray-900 dark:text-white text-xs font-bold rounded-lg hover:bg-white/10 transition-all flex items-center gap-2 border border-gray-200 dark:border-white/5">
                                    <span className="material-symbols-outlined text-sm">edit</span> Editar
                                </button>
                             ) : (
                                <button onClick={() => setEditando(false)} className="px-4 py-2 bg-transparent text-slate-400 text-xs font-bold rounded-lg hover:text-gray-900 dark:text-white transition-all flex items-center gap-2">
                                    Cancelar
                                </button>
                             )}
                        </div>
                    </div>

                    <div className="p-6 md:p-8 space-y-8 no-scrollbar overflow-y-auto">
                        {/* Table of values */}
                        <div className="rounded-xl border border-gray-300 dark:border-[#32353c] overflow-hidden bg-gray-50 dark:bg-[#10131a]/50">
                            <table className="w-full text-left font-label">
                                <thead>
                                    <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-[#3b4a48]/50 bg-white dark:bg-[#191b23]">
                                        <th className="px-6 py-3 font-medium">Parámetro</th>
                                        <th className="px-6 py-3 font-medium text-center">Valor</th>
                                        <th className="px-6 py-3 font-medium text-center">Unidad</th>
                                        <th className="px-6 py-3 font-medium text-center">Rango Ref.</th>
                                        <th className="px-6 py-3 font-medium text-center">Estado</th>
                                        {editando && <th className="px-6 py-3 font-medium"></th>}
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-[#3b4a48]/30">
                                    {(!resultadoDetalle.valores || resultadoDetalle.valores.length === 0) ? (
                                        <tr><td colSpan={editando ? 6 : 5} className="py-8 text-center text-slate-500 text-xs">{editando ? 'No hay parámetros. Añada uno.' : 'Sin valores registrados'}</td></tr>
                                    ) : (
                                        resultadoDetalle.valores.map((v, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-300">
                                                    {editando ? <input className="w-full bg-white dark:bg-[#1d2027] border border-[#3b4a48] rounded p-2 text-xs text-gray-900 dark:text-white focus:border-[#4afdef] outline-none" value={v.parametro} onChange={e => actualizarValor(i, 'parametro', e.target.value)} placeholder="Parámetro" /> : v.parametro}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {editando ? <input className="w-20 bg-white dark:bg-[#1d2027] border border-[#3b4a48] rounded p-2 text-xs text-gray-900 dark:text-white text-center focus:border-[#4afdef] outline-none" value={v.valor} onChange={e => actualizarValor(i, 'valor', e.target.value)} placeholder="Valor" /> : <span className="font-bold text-[#4afdef]" style={{textShadow: '0 0 6px rgba(74,253,239,0.3)'}}>{v.valor}</span>}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-center text-xs">
                                                    {editando ? <input className="w-16 bg-white dark:bg-[#1d2027] border border-[#3b4a48] rounded p-2 text-xs text-gray-900 dark:text-white text-center focus:border-[#4afdef] outline-none" value={v.unidad} onChange={e => actualizarValor(i, 'unidad', e.target.value)} placeholder="Unidad" /> : v.unidad}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-center text-xs">
                                                    {editando ? <input className="w-24 bg-white dark:bg-[#1d2027] border border-[#3b4a48] rounded p-2 text-xs text-gray-900 dark:text-white text-center focus:border-[#4afdef] outline-none" value={v.valorReferencia} onChange={e => actualizarValor(i, 'valorReferencia', e.target.value)} placeholder="Ref." /> : (v.valorReferencia || '-')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center items-center">
                                                        {editando ? (
                                                            <select className="bg-white dark:bg-[#1d2027] border border-[#3b4a48] rounded p-2 text-[10px] text-gray-900 dark:text-white uppercase focus:border-[#4afdef] outline-none appearance-none font-bold" value={v.estado} onChange={e => actualizarValor(i, 'estado', e.target.value)}>
                                                                <option value="normal">Normal</option>
                                                                <option value="alto">Alto</option>
                                                                <option value="bajo">Bajo</option>
                                                            </select>
                                                        ) : (
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${v.estado === 'normal' || v.estado === 'Normal' ? 'bg-[#00ded1]/10 text-[#00ded1] border-[#00ded1]/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                                                {v.estado === 'normal' || v.estado === 'Normal' ? <div className="w-1.5 h-1.5 rounded-full bg-[#00ded1]"></div> : <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>}
                                                                {v.estado || 'N/A'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                {editando && (
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => eliminarParametro(i)} className="text-rose-400 hover:text-rose-300 p-1"><span className="material-symbols-outlined text-sm">delete</span></button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {editando && (
                                <div className="p-4 bg-white dark:bg-[#191b23] border-t border-[#3b4a48]/50 flex justify-center">
                                    <button onClick={agregarParametro} className="text-xs font-bold text-[#4afdef] hover:text-[#00e0d3] flex items-center gap-2"><span className="material-symbols-outlined text-sm">add_circle</span> Añadir Parámetro</button>
                                </div>
                            )}
                        </div>

                        {/* Textareas */}
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-label uppercase tracking-widest text-slate-500 mb-2 block">Interpretación Clínica</label>
                                {editando ? (
                                    <textarea className="w-full bg-white dark:bg-[#191b23] border border-[#3b4a48] rounded-xl p-4 text-sm font-body text-slate-200 focus:border-[#4afdef] outline-none min-h-[100px] resize-none transition-all placeholder:text-slate-600" value={resultadoDetalle.interpretacion || ''} onChange={e => setResultadoDetalle({...resultadoDetalle, interpretacion: e.target.value})} placeholder="Elaborar interpretación..." />
                                ) : (
                                    <div className="bg-white dark:bg-[#191b23] border border-gray-200 dark:border-white/5 rounded-xl p-4 min-h-[80px]">
                                        <p className="text-sm text-slate-300 font-body leading-relaxed">{resultadoDetalle.interpretacion || 'Ninguna interpretación adjunta.'}</p>
                                    </div>
                                )}
                            </div>
                            
                            {editando && (
                                <div>
                                    <label className="text-[10px] font-label uppercase tracking-widest text-slate-500 mb-2 block">Conclusión</label>
                                    <textarea className="w-full bg-white dark:bg-[#191b23] border border-[#3b4a48] rounded-xl p-4 text-sm font-body text-slate-200 focus:border-[#4afdef] outline-none min-h-[80px] resize-none transition-all placeholder:text-slate-600" value={resultadoDetalle.conclusion || ''} onChange={e => setResultadoDetalle({...resultadoDetalle, conclusion: e.target.value})} placeholder="Conclusión final..." />
                                </div>
                            )}
                            
                            {!editando && resultadoDetalle.conclusion && (
                                <div>
                                    <label className="text-[10px] font-label uppercase tracking-widest text-slate-500 mb-2 block">Conclusión</label>
                                    <div className="bg-[#4afdef]/5 border border-[#4afdef]/20 rounded-xl p-4 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[#4afdef]"></div>
                                        <p className="text-sm text-[#4afdef] font-body leading-relaxed">{resultadoDetalle.conclusion}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Signature Section */}
                        <div className={`p-6 bg-surface-container-lowest rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border ${resultadoDetalle.firmaDigital ? 'border-[#00e0d3]/30 shadow-[0_0_15px_rgba(0,224,211,0.05)]' : 'border-gray-200 dark:border-white/5'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${resultadoDetalle.firmaDigital ? 'bg-[#00e0d3]/10 border-[#00e0d3]/20' : 'bg-white dark:bg-[#191b23] border-gray-200 dark:border-white/10'}`}>
                                    <span className={`material-symbols-outlined ${resultadoDetalle.firmaDigital ? 'text-[#00e0d3]' : 'text-slate-500'}`} style={{ fontVariationSettings: "'FILL' 1" }}>{resultadoDetalle.firmaDigital ? 'verified' : 'draw'}</span>
                                </div>
                                <div>
                                    <p className="font-headline font-bold text-gray-900 dark:text-white">Validación de Especialista</p>
                                    <p className="text-[11px] text-slate-500 font-label tracking-wide">
                                        {resultadoDetalle.firmaDigital
                                          ? `Firmado por Dr(a). ${resultadoDetalle.firmadoPor?.nombre || resultadoDetalle.validadoPor?.nombre || medicoSesion?.nombre || 'Médico'}`
                                          : firmaMedico ? 'Firma biometrada disponible en sesión' : 'Requiere registrar firma en su perfil'}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Checkbox logic styled beautifully */}
                            <label className={`flex items-center gap-3 ${resultadoDetalle.firmaDigital ? 'cursor-default' : 'cursor-pointer group'}`}>
                                <span className={`text-sm font-label font-bold tracking-wide transition-colors ${resultadoDetalle.firmaDigital ? 'text-[#00e0d3]' : 'text-slate-400 group-hover:text-gray-900 dark:text-white'}`}>
                                    {firmandoResultado ? 'Validando...' : resultadoDetalle.firmaDigital ? 'Validado y Firmado' : 'Integrar Firma'}
                                </span>
                                <div className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${resultadoDetalle.firmaDigital ? 'bg-[#00e0d3] border-[#00e0d3]' : 'bg-white dark:bg-[#191b23] border-[#3b4a48] group-hover:border-[#4afdef]'}`}>
                                    <span className={`material-symbols-outlined text-[16px] text-zinc-900 ${resultadoDetalle.firmaDigital ? 'block' : 'hidden'}`} style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                                </div>
                                <input className="hidden" type="checkbox" checked={Boolean(resultadoDetalle.firmaDigital)} disabled={firmandoResultado || resultadoDetalle.firmaDigital} onChange={(e) => marcarFirmaResultado(e.target.checked)}/>
                            </label>
                        </div>

                    </div>
                    
                    {/* Action Bar Base */}
                    <div className="p-6 bg-white dark:bg-[#1d2027]/70 backdrop-blur-3xl border-t border-gray-200 dark:border-white/5 flex gap-4 mt-auto">
                        {editando ? (
                            <button onClick={guardarResultado} disabled={guardando} className="flex-1 py-3 px-6 rounded-xl font-headline text-sm font-bold flex items-center justify-center gap-2 bg-[#4afdef] text-slate-900 shadow-[0_0_20px_rgba(74,253,239,0.3)] hover:shadow-[0_0_30px_rgba(74,253,239,0.5)] transition-all">
                                {guardando ? <span className="material-symbols-outlined animate-spin text-sm">autorenew</span> : <span className="material-symbols-outlined text-sm">save</span>}
                                Guardar Cambios
                            </button>
                        ) : (
                            <>
                                {resultadoDetalle.estado !== 'completado' && (
                                    <button onClick={validarResultado} disabled={guardando} className="flex-1 py-3 px-6 rounded-xl font-headline text-[13px] font-bold flex items-center justify-center gap-2 bg-gradient-to-br from-[#4afdef] to-[#00e0d3] text-slate-900 shadow-[0_0_20px_rgba(74,253,239,0.2)] hover:shadow-[0_0_30px_rgba(74,253,239,0.4)] transition-all">
                                        {guardando ? <span className="material-symbols-outlined animate-spin text-sm">autorenew</span> : <span className="material-symbols-outlined text-sm">verified</span>}
                                        Aprobar y Finalizar
                                    </button>
                                )}
                                <button onClick={imprimirResultado} className="px-6 py-3 rounded-xl border border-[#3b4a48] bg-white dark:bg-[#191b23] font-headline text-[13px] text-slate-300 font-bold flex items-center gap-2 hover:bg-white/5 hover:text-gray-900 dark:text-white transition-all">
                                    <span className="material-symbols-outlined text-sm">print</span>
                                    Dossier / Impresión
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
          </section>
        )}
      </div>

    </div>
  );
};

export default PortalMedico;
