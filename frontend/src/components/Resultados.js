import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

const Resultados = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPaciente, setFiltroPaciente] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [resultadoEditar, setResultadoEditar] = useState(null);
  const [citas, setCitas] = useState([]);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [rolUsuario, setRolUsuario] = useState('recepcion');

  // Para crear resultado manual
  const [nuevoResultado, setNuevoResultado] = useState({
    valores: [],
    interpretacion: '',
    observaciones: '',
    conclusion: ''
  });

  const normalizarRol = (rol = '') =>
    String(rol || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const normalizarEstadoValor = (estado = '') => {
    const valor = String(estado || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (!valor) return 'normal';
    if (valor.includes('normal')) return 'normal';
    if (valor.includes('alto')) return valor.includes('crit') ? 'critico' : 'alto';
    if (valor.includes('bajo')) return valor.includes('crit') ? 'critico' : 'bajo';
    if (valor.includes('crit')) return 'critico';
    return 'normal';
  };

  const normalizarListaValores = (valores = []) => {
    if (!Array.isArray(valores) || valores.length === 0) {
      return [{ parametro: '', valor: '', unidad: '', valorReferencia: '', estado: 'normal' }];
    }
    return valores.map(v => ({
      ...v,
      estado: normalizarEstadoValor(v?.estado)
    }));
  };

  const esEstudioLaboratorio = (estudio = {}) => {
    const texto = `${estudio?.tipo || ''} ${estudio?.categoria || ''} ${estudio?.nombre || ''}`
      .toString()
      .toLowerCase();
    return /labor|bioquim|hemat|uroanal|parasit|copro|microbio|inmuno/.test(texto);
  };

  const fetchResultados = useCallback(async (isSilent = false, estado = filtroEstado) => {
    try {
      if (!isSilent) setLoading(true);
      const params = estado && estado !== 'Todos' ? { estado: estado.toLowerCase() } : {};
      const response = await api.getResultados(params);
      const lista = Array.isArray(response) ? response : (response.data || []);
      const soloLaboratorio = lista.filter(r => esEstudioLaboratorio(r?.estudio));
      setResultados(soloLaboratorio);
    } catch (err) {
      console.error(err);
      if (!isSilent) setResultados([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [filtroEstado]);

  const fetchCitasPendientes = useCallback(async (_isSilent = false) => {
    try {
      const response = await api.getCitas({ estado: 'completada' });
      let listaCitas = Array.isArray(response) ? response : (response.data || []);
      const soloLaboratorio = listaCitas.filter(c => {
        const estudio = c?.estudios?.[0]?.estudio;
        return esEstudioLaboratorio(estudio);
      });
      setCitas(soloLaboratorio);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      setRolUsuario(user?.role || user?.rol || 'recepcion');
    } catch {
      setRolUsuario('recepcion');
    }
  }, []);

  const rolActual = normalizarRol(rolUsuario);
  const canEditResultados = ['admin', 'bioanalista', 'recepcionista', 'recepcion', 'laboratorio'].includes(rolActual);
  const canValidarResultados = rolActual === 'bioanalista';

  useEffect(() => {
    fetchResultados();
    fetchCitasPendientes();

    // Auto-Sincronización Total en Segundo Plano (Cada 20 segundos)
    const interval = setInterval(() => {
      fetchResultados(true);
      fetchCitasPendientes(true);
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchResultados, fetchCitasPendientes]);

  useEffect(() => {
    const editResultId = location?.state?.editResultId;
    if (!editResultId || resultados.length === 0 || !canEditResultados) return;
    const objetivo = resultados.find(r => r?._id === editResultId);
    if (objetivo) {
      abrirModalEditar(objetivo);
      navigate('/resultados', { replace: true, state: {} });
    }
  }, [location?.state, resultados, canEditResultados, navigate]);

  const abrirModalNuevo = (cita) => {
    setCitaSeleccionada(cita);
    setNuevoResultado({
      valores: [{ parametro: '', valor: '', unidad: '', valorReferencia: '', estado: 'normal' }],
      interpretacion: '',
      observaciones: '',
      conclusion: ''
    });
    setShowModal(true);
  };

  const abrirModalEditar = (resultado) => {
    setResultadoEditar(resultado);
    setNuevoResultado({
      valores: normalizarListaValores(resultado.valores),
      interpretacion: resultado.interpretacion || '',
      observaciones: resultado.observaciones || '',
      conclusion: resultado.conclusion || ''
    });
    setShowModal(true);
  };

  const agregarValor = () => {
    setNuevoResultado({
      ...nuevoResultado,
      valores: [...nuevoResultado.valores, { parametro: '', valor: '', unidad: '', valorReferencia: '', estado: 'normal' }]
    });
  };

  const actualizarValor = (index, campo, value) => {
    const nuevosValores = [...nuevoResultado.valores];
    nuevosValores[index][campo] = value;
    setNuevoResultado({ ...nuevoResultado, valores: nuevosValores });
  };

  const eliminarValor = (index) => {
    const nuevosValores = nuevoResultado.valores.filter((_, i) => i !== index);
    setNuevoResultado({ ...nuevoResultado, valores: nuevosValores });
  };

  const asegurarFirmaDeSesion = () => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      const usuario = raw ? JSON.parse(raw) : null;
      if (usuario?.firmaDigital) return true;
    } catch (err) {
      console.error('No se pudo leer la firma en sesion:', err);
    }

    alert('Debe registrar su firma en Mi Perfil antes de guardar un resultado como completado.');
    navigate('/perfil');
    return false;
  };

  const guardarResultado = async () => {
    try {
      if (!canEditResultados) {
        alert('No tiene permisos para editar resultados.');
        return;
      }

      const estadoDestino = canValidarResultados ? 'completado' : 'en_proceso';
      if (canValidarResultados && !asegurarFirmaDeSesion()) return;

      if (resultadoEditar) {
        await api.updateResultado(resultadoEditar._id, {
          ...nuevoResultado,
          estado: estadoDestino
        });
        alert(canValidarResultados ? 'Resultado actualizado y validado' : 'Resultado actualizado (pendiente de validación por Bioanalista)');
      } else if (citaSeleccionada) {
        const estudio = citaSeleccionada.estudios?.[0]?.estudio;
        await api.createResultado({
          cita: citaSeleccionada._id,
          paciente: citaSeleccionada.paciente?._id || citaSeleccionada.paciente,
          estudio: estudio?._id || estudio,
          ...nuevoResultado,
          estado: estadoDestino
        });
        alert(canValidarResultados ? 'Resultado creado y validado' : 'Resultado creado (pendiente de validación por Bioanalista)');
      }
      setShowModal(false);
      setResultadoEditar(null);
      setCitaSeleccionada(null);
      fetchResultados();
      fetchCitasPendientes();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Filtrado Front-End Adicional
  const resultadosFiltrados = resultados.filter(r => {
    const term = filtroPaciente.toLowerCase();
    const isMatch = term === '' || 
                    r.paciente?.nombre?.toLowerCase().includes(term) || 
                    r.paciente?.apellido?.toLowerCase().includes(term) || 
                    r.estudio?.nombre?.toLowerCase().includes(term) ||
                    r.codigoMuestra?.toLowerCase().includes(term) ||
                    r.paciente?.cedula?.toLowerCase().includes(term);
    return isMatch;
  });

  const buscarPorCodigoBarras = async (codigo) => {
    try {
      setLoading(true);
      const res = await api.getResultadoPorCodigoMuestra(codigo);
      if (res && res.data) {
        if (canEditResultados) {
          abrirModalEditar(res.data);
        } else {
          alert('Su rol no tiene permisos para editar resultados.');
        }
      } else {
        alert('Código de muestra no encontrado o no tiene un resultado asociado.');
      }
    } catch (err) {
      console.error(err);
      alert('No se encontró ningún resultado para el código: ' + codigo);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && filtroPaciente.trim() !== '') {
      // Se asume que si tiene un guión o prefijo L, o es alfanumérico largo, es un código de barras
      const isBarcode = filtroPaciente.length > 3; 
      if (isBarcode) {
        buscarPorCodigoBarras(filtroPaciente.trim());
      }
    }
  };

  const citasPendientesList = citas.filter(c => !resultados.find(r => r.cita?._id === c._id || r.cita === c._id));
  const handleNuevoResultado = () => {
    if (!canEditResultados) {
      alert('No tiene permisos para editar resultados.');
      return;
    }
    if (!citasPendientesList.length) {
      alert('No hay citas pendientes para crear un resultado nuevo.');
      return;
    }
    abrirModalNuevo(citasPendientesList[0]);
  };
  const countPendientes = citasPendientesList.length;
  const countEnProceso = resultados.filter(r => r.estado === 'en_proceso' || r.estado === 'en proceso').length;
  const countCompletado = resultados.filter(r => r.estado === 'completado').length;
  const countCriticos = resultados.filter(r => r.valores?.some(v => v.estado?.toLowerCase().includes('critico') || v.estado?.toLowerCase().includes('crítico'))).length;

  if (loading && !resultados.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#4afdef]">autorenew</span>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Page Header */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-10">
        <div>
          <h2 className="text-4xl font-headline font-bold tracking-tight text-gray-900 dark:text-[#e0e2ec]">Gestión de Resultados</h2>
          <p className="text-gray-600 dark:text-[#bacac7] font-body mt-2">Monitoreo y carga de reportes de laboratorio en tiempo real.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => fetchResultados()} className="px-6 py-2.5 bg-[#104f4a] text-[#87c0b9] rounded-lg font-headline text-sm font-bold flex items-center gap-2 hover:bg-[#104f4a]/80 transition-all">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>refresh</span>
            Actualizar
          </button>
          <button onClick={handleNuevoResultado} className="px-6 py-2.5 bg-gradient-to-r from-[#00ded1] to-[#00716a] text-[#003733] font-headline text-sm font-bold rounded-lg shadow-[0_0_15px_rgba(71,251,237,0.2)] hover:shadow-[0_0_25px_rgba(71,251,237,0.3)] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">add</span>
            Nuevo Resultado
          </button>
        </div>
      </header>

      {!canValidarResultados && (
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Puede editar resultados, pero solo Bioanalista puede validarlos como completados.
        </div>
      )}

      {/* Citas Pendientes Blocks (Substitutes Header Card) */}
      {countPendientes > 0 && (
        <section className="mb-10 relative z-10">
          <div className="bg-white dark:bg-[#191b23]/80 backdrop-blur-[24px] p-8 rounded-xl border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.05)] relative overflow-hidden">
             <div className="relative z-10">
                <h3 className="font-headline text-xl font-bold mb-4 flex items-center gap-2 text-amber-500">
                    <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    Citas pendientes de resultado ({countPendientes})
                </h3>
                <div className="flex flex-wrap gap-4 mt-6">
                  {citasPendientesList.slice(0, 10).map(cita => (
                     <button
                        key={cita._id}
                        onClick={() => abrirModalNuevo(cita)}
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-label uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
                     >
                        <span className="material-symbols-outlined text-[18px]">add_box</span>
                        {cita.paciente?.nombre} - {cita.estudios?.[0]?.estudio?.nombre || 'General'}
                     </button>
                  ))}
                </div>
             </div>
             <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl"></div>
          </div>
        </section>
      )}

      {/* Summary Stats (If no pending to still show data) */}
      {!countPendientes && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
            <div className="col-span-2 bg-[rgba(29,32,39,0.7)] backdrop-blur-[24px] p-8 rounded-xl border border-gray-200 dark:border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="font-headline text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-[#e0e2ec]">
                        <span className="material-symbols-outlined text-[#47fbed]" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
                        Resumen de Laboratorio
                    </h3>
                    <div className="flex gap-12 mt-6">
                        <div>
                            <p className="text-4xl font-headline font-bold text-[#47fbed]">{countEnProceso}</p>
                            <p className="text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mt-1">En Proceso</p>
                        </div>
                        <div className="h-12 w-[1px] bg-white/5"></div>
                        <div>
                            <p className="text-4xl font-headline font-bold text-[#98d1ca]">{countCompletado}</p>
                            <p className="text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mt-1">Completados</p>
                        </div>
                        <div className="h-12 w-[1px] bg-white/5"></div>
                        <div>
                            <p className="text-4xl font-headline font-bold text-[#ffb4ab]">{countCriticos}</p>
                            <p className="text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mt-1">Valores Críticos</p>
                        </div>
                    </div>
                </div>
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#47fbed]/5 rounded-full blur-3xl"></div>
            </div>
          </section>
      )}

      {/* Filter Bar */}
      <section className="flex flex-wrap items-center gap-4 mb-6 relative z-10">
        <div className="relative flex-1 min-w-[300px]">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#bacac7]/50">search</span>
          <input 
              className="w-full bg-white dark:bg-[#1d2027] border border-gray-200 dark:border-white/5 rounded-lg pl-12 pr-4 py-3 text-sm font-label text-gray-900 dark:text-[#e0e2ec] focus:ring-1 focus:ring-[#47fbed]/30 transition-all outline-none placeholder:text-gray-600 dark:text-[#bacac7]/50" 
              placeholder="Buscar paciente... o Escanea código de muestra y pulsa Enter" 
              type="text"
              value={filtroPaciente}
              onChange={e => setFiltroPaciente(e.target.value)}
              onKeyDown={handleSearchKeyDown}
           />
        </div>
        <div className="flex items-center gap-3">
          <select 
             value={filtroEstado}
             onChange={e => setFiltroEstado(e.target.value)}
             className="bg-white dark:bg-[#1d2027] border border-gray-200 dark:border-white/5 rounded-lg px-4 py-3 text-sm font-label text-gray-600 dark:text-[#bacac7] outline-none focus:ring-1 focus:ring-[#47fbed]/30 min-w-[160px]"
          >
            <option value="">Estado: Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En Proceso</option>
            <option value="completado">Completado</option>
          </select>
        </div>
      </section>

      {/* Data Table Container */}
      <section className="bg-[rgba(29,32,39,0.7)] backdrop-blur-[24px] rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xl relative z-10">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-[#10131a]/50 border-b border-gray-200 dark:border-white/5">
                <tr>
                <th className="px-8 py-5 text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7]">Fecha</th>
                <th className="px-8 py-5 text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7]">Paciente</th>
                <th className="px-8 py-5 text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7]">Estudio</th>
                <th className="px-8 py-5 text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] text-center">Estado</th>
                <th className="px-8 py-5 text-xs font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {resultadosFiltrados.length === 0 ? (
                   <tr>
                       <td colSpan="5" className="px-8 py-10 text-center text-gray-600 dark:text-[#bacac7] font-body text-sm">
                           No se encontraron resultados registrados
                       </td>
                   </tr>
                ) : (
                   resultadosFiltrados.map((r, idx) => {
                       const estado = (r.estado || 'pendiente').toLowerCase();
                       let badgeClass = "bg-[#47fbed]/10 text-[#47fbed] border-[#47fbed]/20"; // En proceso
                       let estadoText = "En Proceso";
                       if (estado === 'completado') {
                           badgeClass = "bg-green-500/10 text-green-500 border-green-500/20";
                           estadoText = "Completado";
                       } else if (estado === 'pendiente') {
                           badgeClass = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                           estadoText = "Pendiente";
                       }

                       return (
                        <tr key={r._id || idx} className="hover:bg-white/5 transition-colors group">
                            <td className="px-8 py-5 font-label text-sm text-gray-600 dark:text-[#bacac7]">
                                {new Date(r.createdAt || r.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-8 py-5">
                                <div className="flex flex-col">
                                    <span className="font-headline font-bold text-gray-900 dark:text-[#e0e2ec]">{r.paciente?.nombre} {r.paciente?.apellido}</span>
                                    <span className="text-[10px] text-gray-600 dark:text-[#bacac7]/60 font-label uppercase">ID: {r.paciente?.cedula || r.paciente?._id?.substring(0,8) || '--'}</span>
                                </div>
                            </td>
                            <td className="px-8 py-5 font-body text-sm text-gray-900 dark:text-[#e0e2ec]">
                                {r.estudio?.nombre || 'Estudio General'}
                            </td>
                            <td className="px-8 py-5 text-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                                    {estadoText}
                                </span>
                            </td>
                            <td className="px-8 py-5 text-right flex justify-end gap-3">
                              {canEditResultados && (
                                <button onClick={() => abrirModalEditar(r)} className="material-symbols-outlined text-gray-600 dark:text-[#bacac7] hover:text-[#47fbed] transition-all p-2 bg-gray-100 dark:bg-[#32353c]/0 hover:bg-gray-100 dark:bg-[#32353c] rounded" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>
                                  {estado === 'completado' ? 'visibility' : 'edit_note'}
                                </button>
                              )}
                            </td>
                        </tr>
                       )
                   })
                )}
            </tbody>
            </table>
        </div>
      </section>

      {/* Data Entry Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-gray-100 dark:bg-[#32353c] w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-white/5 z-20 backdrop-blur-md flex-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#47fbed]/10 flex items-center justify-center text-[#47fbed]">
                  <span className="material-symbols-outlined">science</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-gray-900 dark:text-[#e0e2ec]">
                      {resultadoEditar ? 'Editar / Consultar Resultado' : 'Carga de Resultados'}
                  </h3>
                  {citaSeleccionada && (
                      <p className="text-xs text-gray-600 dark:text-[#bacac7] font-label">
                          Paciente: {citaSeleccionada.paciente?.nombre} • {citaSeleccionada.estudios?.[0]?.estudio?.nombre}
                      </p>
                  )}
                  {resultadoEditar && (
                      <p className="text-xs text-gray-600 dark:text-[#bacac7] font-label">
                          Paciente: {resultadoEditar.paciente?.nombre} • {resultadoEditar.estudio?.nombre}
                      </p>
                  )}
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setResultadoEditar(null); setCitaSeleccionada(null); }} className="text-gray-600 dark:text-[#bacac7] hover:text-[#ffb4ab] transition-colors p-1 rounded hover:bg-white/5">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
              {/* Parameter Table Inputs */}
              <div>
                  <h4 className="font-label text-xs uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-4">Parámetros del Estudio</h4>
                  <div className="space-y-3">
                      {nuevoResultado.valores.map((v, index) => (
                           <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-start bg-white dark:bg-[#191b23] p-3 rounded-lg border border-gray-200 dark:border-white/5">
                               <div className="flex-1 min-w-[150px]">
                                   <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-1 block">Parámetro</label>
                                   <input className="w-full bg-[#0b0e15] border border-[#3b4a48] rounded-lg p-2.5 text-xs text-gray-900 dark:text-[#e0e2ec] font-label focus:ring-1 focus:ring-[#47fbed] outline-none transition-all" type="text" value={v.parametro} onChange={e => actualizarValor(index, 'parametro', e.target.value)} placeholder="Ej. Glucosa" />
                               </div>
                               <div className="w-full md:w-32">
                                   <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-1 block">Valor</label>
                                   <input className="w-full bg-[#0b0e15] border border-[#3b4a48] rounded-lg p-2.5 text-xs text-gray-900 dark:text-[#e0e2ec] font-label focus:ring-1 focus:ring-[#47fbed] outline-none transition-all" type="text" value={v.valor} onChange={e => actualizarValor(index, 'valor', e.target.value)} placeholder="0.0" />
                               </div>
                               <div className="w-full md:w-24">
                                   <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-1 block">Unidad</label>
                                   <input className="w-full bg-[#0b0e15] border border-[#3b4a48] rounded-lg p-2.5 text-xs text-gray-900 dark:text-[#e0e2ec] font-label focus:ring-1 focus:ring-[#47fbed] outline-none transition-all" type="text" value={v.unidad} onChange={e => actualizarValor(index, 'unidad', e.target.value)} placeholder="mg/dL" />
                               </div>
                               <div className="flex-1 min-w-[120px]">
                                   <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-1 block">Referencia</label>
                                   <input className="w-full bg-[#0b0e15] border border-[#3b4a48] rounded-lg p-2.5 text-xs text-gray-900 dark:text-[#e0e2ec] font-label focus:ring-1 focus:ring-[#47fbed] outline-none transition-all" type="text" value={v.valorReferencia} onChange={e => actualizarValor(index, 'valorReferencia', e.target.value)} placeholder="70 - 100" />
                               </div>
                               <div className="w-full md:w-36">
                                   <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-1 block">Estado</label>
                                   <select className="w-full bg-[#0b0e15] border border-[#3b4a48] rounded-lg p-2.5 text-xs text-gray-900 dark:text-[#e0e2ec] font-label focus:ring-1 focus:ring-[#47fbed] outline-none transition-all appearance-none" value={v.estado} onChange={e => actualizarValor(index, 'estado', e.target.value)}>
                                     <option value="normal">Normal</option>
                                     <option value="alto">Alto</option>
                                     <option value="bajo">Bajo</option>
                                     <option value="critico">Crítico</option>
                                   </select>
                               </div>
                               <div className="mt-5">
                                   <button onClick={() => eliminarValor(index)} className="p-2.5 bg-[#ffb4ab]/10 text-[#ffb4ab] rounded-lg hover:bg-[#ffb4ab]/20 transition-all border border-[#ffb4ab]/20" title="Eliminar Parámetro">
                                       <span className="material-symbols-outlined text-[18px]">delete</span>
                                   </button>
                               </div>
                           </div>
                      ))}
                      <button onClick={agregarValor} className="w-full py-3 bg-white dark:bg-[#191b23] border border-dashed border-[#3b4a48] rounded-lg text-gray-600 dark:text-[#bacac7] hover:text-[#47fbed] hover:border-[#47fbed]/50 transition-all flex justify-center items-center gap-2 font-label text-xs uppercase tracking-widest mt-2">
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          Añadir Otro Parámetro
                      </button>
                  </div>
              </div>

              {/* Text Areas */}
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-2 block">Interpretación (Opcional)</label>
                    <textarea 
                       className="w-full bg-white dark:bg-[#191b23] border border-[#3b4a48] rounded-lg p-4 text-sm text-gray-900 dark:text-[#e0e2ec] font-body focus:ring-1 focus:ring-[#47fbed] outline-none transition-all resize-none min-h-[100px]" 
                       placeholder="Escriba la interpretación de los resultados..."
                       value={nuevoResultado.interpretacion}
                       onChange={e => setNuevoResultado({ ...nuevoResultado, interpretacion: e.target.value })}
                    />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-2 block">Observaciones (Opcional)</label>
                        <textarea 
                           className="w-full bg-white dark:bg-[#191b23] border border-[#3b4a48] rounded-lg p-4 text-sm text-gray-900 dark:text-[#e0e2ec] font-body focus:ring-1 focus:ring-[#47fbed] outline-none transition-all resize-none min-h-[80px]" 
                           placeholder="Detalles adicionales..."
                           value={nuevoResultado.observaciones}
                           onChange={e => setNuevoResultado({ ...nuevoResultado, observaciones: e.target.value })}
                        />
                     </div>
                     <div>
                        <label className="text-[10px] font-label uppercase tracking-widest text-gray-600 dark:text-[#bacac7] mb-2 block">Conclusión (Opcional)</label>
                        <textarea 
                           className="w-full bg-white dark:bg-[#191b23] border border-[#3b4a48] rounded-lg p-4 text-sm text-gray-900 dark:text-[#e0e2ec] font-body focus:ring-1 focus:ring-[#47fbed] outline-none transition-all resize-none min-h-[80px]" 
                           placeholder="Conclusión final..."
                           value={nuevoResultado.conclusion}
                           onChange={e => setNuevoResultado({ ...nuevoResultado, conclusion: e.target.value })}
                        />
                     </div>
                 </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-[#10131a]/80 border-t border-gray-200 dark:border-white/5 flex gap-4 justify-end z-20 backdrop-blur-md flex-none">
              <button onClick={() => { setShowModal(false); setResultadoEditar(null); setCitaSeleccionada(null); }} className="px-6 py-2.5 rounded-lg font-headline text-sm font-bold text-gray-600 dark:text-[#bacac7] hover:bg-white/10 transition-all">
                  Cancelar
              </button>
                <button onClick={guardarResultado} disabled={!canEditResultados} className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-[#00ded1] to-[#00716a] text-[#003733] font-headline text-sm font-bold shadow-[0_0_20px_rgba(71,251,237,0.3)] hover:shadow-[0_0_30px_rgba(71,251,237,0.5)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  {canValidarResultados ? 'Guardar y Validar' : 'Guardar (Pendiente de Validación)'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Resultados;
