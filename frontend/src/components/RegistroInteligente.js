import React, { useState, useEffect, useCallback } from 'react';
import { FaSpinner } from 'react-icons/fa';
import api from '../services/api';
import FacturaTermica from './FacturaTermica';
import useDebounce from '../hooks/useDebounce';

const RegistroInteligente = () => {
  const [paso, setPaso] = useState(1);
  const [modoPaciente, setModoPaciente] = useState('nuevo');
  const [vieneDeCotizacion, setVieneDeCotizacion] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [estudios, setEstudios] = useState([]);
  const [estudiosSeleccionados, setEstudiosSeleccionados] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [medicoSeleccionado, setMedicoSeleccionado] = useState('');
  const [loading, setLoading] = useState(false);
  const [facturaGenerada, setFacturaGenerada] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuento, setDescuento] = useState(0);
  const [montoPagado, setMontoPagado] = useState(0);
  const [mostrarFactura, setMostrarFactura] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const debouncedBusqueda = useDebounce(busqueda, 300);

  const [nuevoPaciente, setNuevoPaciente] = useState({
    nombre: '', apellido: '', cedula: '', esMenor: false,
    telefono: '', email: '', fechaNacimiento: '', sexo: 'M',
    nacionalidad: 'Dominicano', tipoSangre: '', seguroNombre: '', seguroNumeroAfiliado: ''
  });

  useEffect(() => { fetchEstudios(); fetchMedicos(); }, []);

  const fetchMedicos = async () => {
    try {
      const response = await api.getMedicos();
      setMedicos(response.data || []);
    } catch(err) { setMedicos([]); }
  };

  const fetchEstudios = async () => {
    try {
      const response = await api.getEstudios();
      setEstudios(Array.isArray(response) ? response : []);
    } catch (err) { setEstudios([]); }
  };

  const buscarPaciente = useCallback(async (queryInput = '') => {
    const query = String(queryInput || '').trim();
    if (!query || query.length < 2) {
      setPacientes([]);
      return;
    }
    try {
      setLoading(true);
      const response = await api.getPacientes({ search: query });
      setPacientes(Array.isArray(response) ? response : []);
    } catch (err) { setPacientes([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (modoPaciente !== 'existente') return;
    buscarPaciente(debouncedBusqueda);
  }, [debouncedBusqueda, buscarPaciente, modoPaciente]);

  const seleccionarPacienteExistente = (paciente) => {
    setPacienteSeleccionado(paciente);
    setPaso(2);
  };

  const crearPaciente = async () => {
    if (!nuevoPaciente.nombre || !nuevoPaciente.apellido || !nuevoPaciente.telefono || !nuevoPaciente.fechaNacimiento) {
      alert('Complete los campos obligatorios (Nombre, Apellido, Teléfono, F. Nacimiento)');
      return;
    }
    try {
      setLoading(true);
      const pacienteData = {
        nombre: nuevoPaciente.nombre,
        apellido: nuevoPaciente.apellido,
        cedula: nuevoPaciente.cedula,
        esMenor: nuevoPaciente.esMenor,
        telefono: nuevoPaciente.telefono,
        email: nuevoPaciente.email,
        fechaNacimiento: nuevoPaciente.fechaNacimiento,
        sexo: nuevoPaciente.sexo,
        nacionalidad: nuevoPaciente.nacionalidad,
        tipoSangre: nuevoPaciente.tipoSangre,
        seguro: {
          nombre: nuevoPaciente.seguroNombre || '',
          numeroAfiliado: nuevoPaciente.seguroNumeroAfiliado || '',
          tipo: nuevoPaciente.seguroNombre ? 'ARS' : ''
        }
      };
      const response = await api.createPaciente(pacienteData);
      setPacienteSeleccionado(response.data || response);
      // Si viene de cotización, ir directo a liquidación (paso 3)
      if (vieneDeCotizacion) {
        setPaso(3);
      } else {
        setPaso(2);
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.mensaje || err.message));
    } finally { setLoading(false); }
  };

  const crearPacienteCotizacion = async () => {
    if (!nuevoPaciente.nombre || !nuevoPaciente.apellido || !nuevoPaciente.telefono || !nuevoPaciente.fechaNacimiento) {
      alert('Complete los campos obligatorios (Nombre, Apellido, Teléfono, F. Nacimiento)');
      return;
    }
    try {
      setLoading(true);
      const pacienteData = {
        nombre: nuevoPaciente.nombre,
        apellido: nuevoPaciente.apellido,
        cedula: nuevoPaciente.cedula,
        esMenor: nuevoPaciente.esMenor,
        telefono: nuevoPaciente.telefono,
        email: nuevoPaciente.email,
        fechaNacimiento: nuevoPaciente.fechaNacimiento,
        sexo: nuevoPaciente.sexo,
        nacionalidad: nuevoPaciente.nacionalidad,
        tipoSangre: nuevoPaciente.tipoSangre,
        seguro: {
          nombre: nuevoPaciente.seguroNombre || '',
          numeroAfiliado: nuevoPaciente.seguroNumeroAfiliado || '',
          tipo: nuevoPaciente.seguroNombre ? 'ARS' : ''
        }
      };
      const response = await api.createPaciente(pacienteData);
      setPacienteSeleccionado(response.data || response);
      // Después de registrar en cotización, ir a liquidación (factura)
      setPaso(3);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.mensaje || err.message));
    } finally { setLoading(false); }
  };

  const seleccionarPacienteExistenteCotizacion = (paciente) => {
    setPacienteSeleccionado(paciente);
    // Después de seleccionar paciente existente en cotización, ir a liquidación (factura)
    setPaso(3);
  };

  const agregarEstudio = (estudio) => {
    if (!estudiosSeleccionados.find(e => (e._id || e.id) === (estudio._id || estudio.id))) {
      setEstudiosSeleccionados([...estudiosSeleccionados, { ...estudio, cantidad: 1, cobertura: 0 }]);
    }
  };

  const quitarEstudio = (id) => {
    setEstudiosSeleccionados(estudiosSeleccionados.filter(e => (e._id || e.id) !== id));
  };

  const actualizarCobertura = (id, cobertura) => {
    setEstudiosSeleccionados(estudiosSeleccionados.map(e =>
      (e._id || e.id) === id ? { ...e, cobertura: parseFloat(cobertura) || 0 } : e
    ));
  };

  const calcularSubtotal = () => estudiosSeleccionados.reduce((sum, e) => sum + ((e.precio || 0) * (e.cantidad || 1)), 0);
  const calcularCobertura = () => estudiosSeleccionados.reduce((sum, e) => sum + (e.cobertura || 0), 0);
  const calcularTotal = () => Math.max(0, calcularSubtotal() - calcularCobertura() - descuento);
  
  const finalizarRegistro = async () => {
    if (estudiosSeleccionados.length === 0) { alert('Agregue al menos un estudio'); return; }
    try {
      setLoading(true);
      const ahora = new Date();
      const CATEGORIAS_RAYOS_X = ['radiologia', 'radiography', 'rayos_x', 'rayos x', 'rx', 'radio', 'imagen', 'imagenologia', 'radiology'];
      const tieneRayosX = estudiosSeleccionados.some(e => {
        const cat = (e.categoria || e.category || '').toLowerCase();
        const nom = (e.nombre || e.name || '').toLowerCase();
        return CATEGORIAS_RAYOS_X.some(k => cat.includes(k) || nom.includes('rx') || nom.includes('radio') || nom.includes('rayos'));
      });
      let sucursalRayosXId = null;
      if (tieneRayosX) {
        try {
          const cfgResp = await fetch('/api/configuracion/empresa');
          const cfgData = await cfgResp.json();
          sucursalRayosXId = cfgData?.sucursal_rayos_x_id || null;
        } catch (_) {}
      }

      const citaData = {
        paciente: pacienteSeleccionado._id || pacienteSeleccionado.id,
        fecha: ahora.toISOString().split('T')[0],
        horaInicio: ahora.toTimeString().split(' ')[0].substring(0, 5),
        estudios: estudiosSeleccionados.map(e => ({ estudio: e._id || e.id, precio: e.precio || 0, descuento: e.cobertura || 0 })),
        subtotal: calcularSubtotal(),
        descuentoTotal: calcularCobertura() + descuento,
        total: calcularTotal(),
        metodoPago: metodoPago,
        pagado: montoPagado >= calcularTotal(),
        estado: 'completada',
        ...(medicoSeleccionado ? { medico: medicoSeleccionado } : {}),
        ...(sucursalRayosXId ? { sucursalRayosX: sucursalRayosXId } : {})
      };
      const citaRes = await api.createCita(citaData);
      const cita = citaRes.orden || citaRes.data || citaRes;

      const facturaData = {
        paciente: pacienteSeleccionado._id || pacienteSeleccionado.id,
        cita: cita._id || cita.id,
        items: estudiosSeleccionados.map(e => ({ descripcion: e.nombre, estudio: e._id || e.id, cantidad: 1, precioUnitario: e.precio || 0, descuento: e.cobertura || 0, subtotal: (e.precio || 0) - (e.cobertura || 0) })),
        subtotal: calcularSubtotal(),
        descuento: descuento, total: calcularTotal(),
        montoPagado: montoPagado, metodoPago,
        estado: montoPagado >= calcularTotal() ? 'pagada' : 'emitida',
        datosCliente: { nombre: `${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido}`, cedula: pacienteSeleccionado.cedula || '', telefono: pacienteSeleccionado.telefono || '' },
        ...(medicoSeleccionado ? { medico: medicoSeleccionado } : {}),
        ...(sucursalRayosXId ? { sucursal: sucursalRayosXId } : {})
      };
      const factRes = await api.createFactura(facturaData);
      setFacturaGenerada({ ...factRes.data || factRes, montoPagado });
      setMostrarFactura(true);
      // Auto-imprimir después de un breve delay para que el componente se renderice
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.mensaje || err.message));
    } finally { setLoading(false); }
  };

  const reiniciar = () => {
    setModoPaciente('nuevo');
    setPaso(1); setBusqueda(''); setPacientes([]); setPacienteSeleccionado(null); setEstudiosSeleccionados([]);
    setFacturaGenerada(null); setMostrarFactura(false); setDescuento(0); setMontoPagado(0); setMedicoSeleccionado('');
    setNuevoPaciente({ nombre: '', apellido: '', cedula: '', esMenor: false, telefono: '', email: '', fechaNacimiento: '', sexo: 'M', nacionalidad: 'Dominicano', tipoSangre: '', seguroNombre: '', seguroNumeroAfiliado: '' });
  };

  const Steps = [
    { num: 1, label: 'Identidad' },
    { num: 2, label: 'Servicios' },
    { num: 3, label: 'Liquidación' }
  ];

  if (mostrarFactura && facturaGenerada) return <FacturaTermica factura={facturaGenerada} paciente={pacienteSeleccionado} estudios={estudiosSeleccionados} onClose={reiniciar} />;

  return (
    <div className="min-h-full pb-16 animate-in fade-in zoom-in-95 duration-500 font-body">
      
      {/* 1. Header & Progress Stepper */}
      <section className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white dark:bg-[#191b23] p-6 rounded-2xl mb-8 border border-gray-200 dark:border-white/5 shadow-2xl">
        <div className="flex flex-col">
          <h2 className="font-headline text-2xl font-bold tracking-tight text-gray-900 dark:text-[#e0e2ec]">Admisión de Paciente</h2>
          <p className="text-gray-600 dark:text-[#bacac7] text-sm font-body">Complete el flujo para generar el ticket clínico.</p>
        </div>
        
        <div className="flex items-center gap-4">
          {Steps.map((s, i) => {
            const isActive = paso === s.num;
            const isCompleted = paso > s.num;
            return (
              <React.Fragment key={s.num}>
                <div 
                    onClick={() => { if (isCompleted) setPaso(s.num); }}
                    className={`flex items-center gap-3 transition-all duration-300 ${isCompleted ? 'cursor-pointer hover:opacity-80' : ''} ${isActive ? 'text-[#00e0d3] px-4 py-2 bg-gray-100 dark:bg-[#32353c] rounded-full shadow-[0_0_15px_rgba(0,224,211,0.2)]' : isCompleted ? 'text-[#00e0d3] opacity-70' : 'text-gray-900 dark:text-[#e0e2ec] opacity-40'}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-label text-base font-black ${isActive ? 'bg-[#4afdef] !text-black' : isCompleted ? 'border border-[#00e0d3] text-[#00e0d3] dark:bg-[#4afdef] dark:!text-black' : 'border border-[#bacac7] text-gray-500 dark:text-[#849491]'}`}>
                    {isCompleted ? '✓' : `0${s.num}`}
                  </span>
                  <span className={`font-headline text-sm ${isActive ? 'font-bold' : 'font-medium'} hidden sm:block`}>{s.label}</span>
                </div>
                {i < Steps.length - 1 && <div className={`w-8 sm:w-12 h-px transition-colors ${paso > s.num ? 'bg-[#00e0d3]/50' : 'bg-white/10'}`}></div>}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      <div className="mt-8 transition-all duration-500 relative">
        
        {/* BLOCK 1 (IDENTIDAD) */}
        {paso === 1 && (
          <section className="bg-white dark:bg-[#1d2027]/70 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/5 animate-in slide-in-from-right-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#0b0e15] p-1.5 rounded-xl border border-gray-200 dark:border-white/5">
                <button onClick={() => { setModoPaciente('nuevo'); setBusqueda(''); setPacientes([]); }} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all focus:outline-none ${modoPaciente === 'nuevo' ? 'bg-[#4afdef] text-black shadow-[0_0_15px_rgba(74,253,239,0.3)]' : 'text-gray-900 hover:text-[#00e0d3] dark:text-teal-600 dark:text-[#4afdef] bg-transparent'}`}>Nuevo Paciente</button>
                <button onClick={() => setModoPaciente('existente')} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all focus:outline-none ${modoPaciente === 'existente' ? 'bg-[#4afdef] text-black shadow-[0_0_15px_rgba(74,253,239,0.3)]' : 'text-gray-900 hover:text-[#00e0d3] dark:text-teal-600 dark:text-[#4afdef] bg-transparent'}`}>Paciente Existente</button>
                <button onClick={() => setModoPaciente('cotizacion')} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all focus:outline-none ${modoPaciente === 'cotizacion' ? 'bg-[#4afdef] text-black shadow-[0_0_15px_rgba(74,253,239,0.3)]' : 'text-gray-900 hover:text-[#00e0d3] dark:text-teal-600 dark:text-[#4afdef] bg-transparent'}`}>Cotización</button>
              </div>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white bg-primary/10 px-4 py-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px] text-teal-600 dark:text-[#4afdef]" style={{ fontVariationSettings: "'FILL' 1" }}>supervised_user_circle</span>
                <span className="text-xs font-label uppercase tracking-widest font-bold">Identidad</span>
              </div>
            </div>

            {modoPaciente === 'existente' ? (
                <div className="space-y-6">
                    <div className="relative max-w-2xl">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#bacac7]">search</span>
                        <input className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-4 pl-12 pr-4 rounded-t-xl font-body text-lg shadow-inner" placeholder="Escriba nombre o cédula para buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                        {pacientes.map(p => (
                            <div key={p._id || p.id} onClick={() => seleccionarPacienteExistente(p)} className="bg-gray-50 dark:bg-[#272a31] border border-gray-200 dark:border-white/5 hover:border-[#4afdef]/50 hover:bg-gray-100 dark:bg-[#32353c] p-5 rounded-xl cursor-pointer transition-all group hover:shadow-[0_0_15px_rgba(74,253,239,0.1)]">
                                <div className="flex justify-between items-start mb-2">
                                    <strong className="text-gray-900 dark:text-white font-headline text-lg group-hover:text-teal-600 dark:text-[#4afdef] transition-colors line-clamp-1">{p.nombre} {p.apellido}</strong>
                                    <span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">chevron_right</span>
                                </div>
                                <div className="text-[11px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest flex items-center gap-4">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">badge</span> {p.cedula || 'N/A'}</span>
                                </div>
                                {p.telefono && <div className="text-[11px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest flex items-center gap-4 mt-1">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">call</span> {p.telefono}</span>
                                </div>}
                            </div>
                        ))}
                    </div>
                    {pacientes.length === 0 && !loading && busqueda && <p className="text-gray-500 dark:text-[#849491] font-label text-sm">No se encontraron pacientes que coincidan con la búsqueda.</p>}
                    {loading && <div className="flex items-center gap-3 text-teal-600 dark:text-[#00e0d3] p-4"><FaSpinner className="animate-spin" /> Buscando pacientes...</div>}
                </div>
            ) : modoPaciente === 'cotizacion-nuevo' ? (
                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="bg-gradient-to-r from-[#4afdef]/10 to-[#00e0d3]/10 p-4 rounded-xl border border-[#4afdef]/20 mb-4">
                        <p className="text-sm text-gray-600 dark:text-[#849491] flex items-center gap-2">
                            <span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef]">calculate</span>
                            <strong>Cotización:</strong> Registre un nuevo paciente para generar el presupuesto.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Nombre *</label>
                            <input value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente({ ...nuevoPaciente, nombre: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body" placeholder="Ej. Juan Alberto" />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Apellido *</label>
                            <input value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente({ ...nuevoPaciente, apellido: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body" placeholder="Ej. Pérez Rosario" />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Cédula / ID</label>
                            <input value={nuevoPaciente.cedula} onChange={e => setNuevoPaciente({ ...nuevoPaciente, cedula: e.target.value })} disabled={nuevoPaciente.esMenor} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-label disabled:opacity-50" placeholder={nuevoPaciente.esMenor ? 'Menor de edad' : '000-0000000-0'} />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">F. Nacimiento *</label>
                            <input type="date" value={nuevoPaciente.fechaNacimiento} onChange={e => {
                                const val = e.target.value;
                                const updates = { ...nuevoPaciente, fechaNacimiento: val };
                                if (val) {
                                  const hoy = new Date(); const nac = new Date(val);
                                  let edad = hoy.getFullYear() - nac.getFullYear();
                                  const m = hoy.getMonth() - nac.getMonth();
                                  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
                                  if (edad < 18) { updates.esMenor = true; updates.cedula = 'MENOR DE EDAD'; }
                                  else { updates.esMenor = false; if (updates.cedula === 'MENOR DE EDAD') updates.cedula = ''; }
                                }
                                setNuevoPaciente(updates);
                              }} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-label uppercase" />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Sexo *</label>
                            <select value={nuevoPaciente.sexo} onChange={e => setNuevoPaciente({ ...nuevoPaciente, sexo: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body appearance-none">
                                <option value="M">Masculino</option>
                                <option value="F">Femenino</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Teléfono *</label>
                            <input value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente({ ...nuevoPaciente, telefono: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-label" placeholder="809-000-0000" />
                        </div>
                        <div className="relative group lg:col-span-3">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Email</label>
                            <input value={nuevoPaciente.email} onChange={e => setNuevoPaciente({ ...nuevoPaciente, email: e.target.value })} type="email" className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body" placeholder="correo@ejemplo.com" />
                        </div>
                    </div>
                    <div className="flex justify-between pt-4">
                        <button onClick={() => setModoPaciente('cotizacion')} className="px-8 py-4 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-headline font-bold text-[15px] rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined">arrow_back</span>
                            Volver
                        </button>
                        <button onClick={crearPacienteCotizacion} disabled={loading} className="px-10 py-4 bg-[#4afdef] text-black font-headline font-bold text-[15px] rounded-xl shadow-[0_0_20px_rgba(74,253,239,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
                            {loading ? <FaSpinner className="animate-spin" /> : 'Continuar a Servicios'}
                            {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
                        </button>
                    </div>
                </div>
            ) : modoPaciente === 'cotizacion-existente' ? (
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-[#4afdef]/10 to-[#00e0d3]/10 p-4 rounded-xl border border-[#4afdef]/20 mb-4">
                        <p className="text-sm text-gray-600 dark:text-[#849491] flex items-center gap-2">
                            <span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef]">calculate</span>
                            <strong>Cotización:</strong> Seleccione un paciente existente para generar el presupuesto.
                        </p>
                    </div>
                    <div className="relative max-w-2xl">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#bacac7]">search</span>
                        <input className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-4 pl-12 pr-4 rounded-t-xl font-body text-lg shadow-inner" placeholder="Escriba nombre o cédula para buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {pacientes.map(p => (
                            <div key={p._id || p.id} onClick={() => seleccionarPacienteExistenteCotizacion(p)} className="bg-gray-50 dark:bg-[#272a31] border border-gray-200 dark:border-white/5 hover:border-[#4afdef]/50 hover:bg-gray-100 dark:hover:bg-[#32353c] p-5 rounded-xl cursor-pointer transition-all group hover:shadow-[0_0_15px_rgba(74,253,239,0.1)]">
                                <div className="flex justify-between items-start mb-2">
                                    <strong className="text-gray-900 dark:text-white font-headline text-lg group-hover:text-teal-600 dark:text-[#4afdef] transition-colors line-clamp-1">{p.nombre} {p.apellido}</strong>
                                    <span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">chevron_right</span>
                                </div>
                                <div className="text-[11px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest flex items-center gap-4">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">badge</span> {p.cedula || 'N/A'}</span>
                                </div>
                                {p.telefono && <div className="text-[11px] font-label text-gray-500 dark:text-[#849491] uppercase tracking-widest flex items-center gap-4 mt-1">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">call</span> {p.telefono}</span>
                                </div>}
                            </div>
                        ))}
                    </div>
                    {pacientes.length === 0 && !loading && busqueda && <p className="text-gray-500 dark:text-[#849491] font-label text-sm">No se encontraron pacientes que coincidan con la búsqueda.</p>}
                    {loading && <div className="flex items-center gap-3 text-teal-600 dark:text-[#00e0d3] p-4"><FaSpinner className="animate-spin" /> Buscando pacientes...</div>}
                    <div className="flex justify-start pt-4">
                        <button onClick={() => setModoPaciente('cotizacion')} className="px-8 py-4 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-headline font-bold text-[15px] rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined">arrow_back</span>
                            Volver
                        </button>
                    </div>
                </div>
            ) : modoPaciente === 'cotizacion' ? (
                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="bg-gradient-to-r from-[#4afdef]/10 to-[#00e0d3]/10 p-6 rounded-2xl border border-[#4afdef]/20">
                        <h3 className="font-headline text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef]">calculate</span>
                            Nueva Cotización
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-[#849491]">Genere un presupuesto. Primero seleccione los servicios, luego puede registrar el paciente.</p>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                        <button onClick={() => { setVieneDeCotizacion(true); setPaso(2); setPacienteSeleccionado({ nombre: 'Cotización', apellido: 'Temporal', cedula: 'N/A', telefono: '' }); }} className="px-10 py-4 bg-[#4afdef] text-black font-headline font-bold text-[15px] rounded-xl shadow-[0_0_20px_rgba(74,253,239,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
                            Continuar a Servicios
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Nombre *</label>
                            <input value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente({ ...nuevoPaciente, nombre: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body" placeholder="Ej. Juan Alberto" />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Apellido *</label>
                            <input value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente({ ...nuevoPaciente, apellido: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body" placeholder="Ej. Pérez Rosario" />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Cédula / ID</label>
                            <input value={nuevoPaciente.cedula} onChange={e => setNuevoPaciente({ ...nuevoPaciente, cedula: e.target.value })} disabled={nuevoPaciente.esMenor} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-label disabled:opacity-50" placeholder={nuevoPaciente.esMenor ? 'Menor de edad' : '000-0000000-0'} />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">F. Nacimiento *</label>
                            <input type="date" value={nuevoPaciente.fechaNacimiento} onChange={e => {
                                const val = e.target.value;
                                const updates = { ...nuevoPaciente, fechaNacimiento: val };
                                if (val) {
                                  const hoy = new Date(); const nac = new Date(val);
                                  let edad = hoy.getFullYear() - nac.getFullYear();
                                  const m = hoy.getMonth() - nac.getMonth();
                                  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
                                  if (edad < 18) { updates.esMenor = true; updates.cedula = 'MENOR DE EDAD'; }
                                  else { updates.esMenor = false; if (updates.cedula === 'MENOR DE EDAD') updates.cedula = ''; }
                                }
                                setNuevoPaciente(updates);
                              }} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-label uppercase" />
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Sexo *</label>
                            <select value={nuevoPaciente.sexo} onChange={e => setNuevoPaciente({ ...nuevoPaciente, sexo: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body appearance-none">
                                <option value="M">Masculino</option>
                                <option value="F">Femenino</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div className="relative group">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Teléfono *</label>
                            <input value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente({ ...nuevoPaciente, telefono: e.target.value })} className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-label" placeholder="809-000-0000" />
                        </div>
                        <div className="relative group lg:col-span-3">
                            <label className="block text-sm uppercase tracking-wide text-gray-900 dark:text-[#849491] mb-2 ml-1 font-bold">Email</label>
                            <input value={nuevoPaciente.email} onChange={e => setNuevoPaciente({ ...nuevoPaciente, email: e.target.value })} type="email" className="w-full bg-gray-100 dark:bg-[#32353c] border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-3 px-4 rounded-t-lg font-body" placeholder="correo@ejemplo.com" />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-white/5">
                        <div className="bg-gray-50 dark:bg-[#4afdef]/5 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-8 border border-gray-200 dark:border-[#4afdef]/10">
                            <div className="flex items-center gap-4 min-w-[200px]">
                                <div className="w-12 h-12 rounded-full bg-[#4afdef]/20 flex items-center justify-center text-teal-600 dark:text-[#4afdef] shadow-[0_0_15px_rgba(74,253,239,0.2)]">
                                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shield_locked</span>
                                </div>
                                <div>
                                    <h4 className="font-headline text-sm font-bold text-gray-900 dark:text-teal-600 dark:text-[#4afdef]">Cobertura Aseguradora</h4>
                                    <p className="text-[10px] text-gray-600 dark:text-teal-600 dark:text-[#4afdef]/70 uppercase font-bold tracking-tighter">Plan de Salud</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                                <div className="relative">
                                    <label className="block text-[10px] text-gray-600 dark:text-teal-600 dark:text-[#4afdef]/80 uppercase tracking-widest mb-1 ml-1 font-bold">ARS / Aseguradora</label>
                                    <input value={nuevoPaciente.seguroNombre} onChange={e => setNuevoPaciente({ ...nuevoPaciente, seguroNombre: e.target.value })} className="w-full bg-gray-50 dark:bg-[#10131a]/50 border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-2.5 px-3 rounded-t-lg text-sm font-body" placeholder="Ej. ARS Universal, Senasa..." />
                                </div>
                                <div className="relative">
                                    <label className="block text-[10px] text-gray-600 dark:text-teal-600 dark:text-[#4afdef]/80 uppercase tracking-widest mb-1 ml-1 font-bold">No. Afiliado</label>
                                    <input value={nuevoPaciente.seguroNumeroAfiliado} onChange={e => setNuevoPaciente({ ...nuevoPaciente, seguroNumeroAfiliado: e.target.value })} className="w-full bg-gray-50 dark:bg-[#10131a]/50 border-0 border-b-2 border-transparent focus:border-[#4afdef] focus:ring-0 transition-all text-gray-900 dark:text-white py-2.5 px-3 rounded-t-lg text-sm font-label" placeholder="882734412-01" />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                        <button onClick={crearPaciente} disabled={loading} className="px-10 py-4 bg-[#4afdef] text-[#00201d] font-headline font-bold text-[15px] rounded-xl shadow-[0_0_20px_rgba(74,253,239,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
                            {loading ? <FaSpinner className="animate-spin" /> : 'Registrar y Continuar' }
                            {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
                        </button>
                    </div>
                </div>
            )}
          </section>
        )}

        {/* BLOCK 2 (SERVICIOS Y ORDEN) */}
        {paso === 2 && (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in slide-in-from-right-8">
                {/* Left: Catalog */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
                        <h3 className="font-headline text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef]">medical_services</span> Catálogo de Servicios
                        </h3>
                        <div className="relative w-full sm:w-72">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-[#849491]">search</span>
                            <input value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="w-full bg-gray-50 dark:bg-[#272a31] border border-gray-200 dark:border-white/5 focus:border-[#4afdef]/50 rounded-full pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-0 transition-all font-body shadow-inner" placeholder="Buscar estudio o código..." />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                        {estudios.filter(e => (e.nombre || '').toLowerCase().includes(filtroCategoria.toLowerCase()) || (e.codigo || '').toLowerCase().includes(filtroCategoria.toLowerCase())).map(e => (
                            <div key={e._id || e.id} onClick={() => agregarEstudio(e)} className="bg-gray-50 dark:bg-[#272a31] p-5 rounded-xl border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-[#32353c] hover:border-[#4afdef]/30 transition-all group cursor-pointer hover:shadow-[0_0_15px_rgba(74,253,239,0.1)] flex flex-col justify-between min-h-[140px]">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-[10px] font-label font-bold text-teal-600 dark:text-[#4afdef] bg-[#4afdef]/10 px-2 py-0.5 rounded tracking-widest">{e.codigo || 'S/C'}</span>
                                        <span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0" style={{ fontVariationSettings: "'FILL' 1" }}>add_box</span>
                                    </div>
                                    <h4 className="font-headline font-bold text-gray-900 dark:text-white mb-1 leading-tight text-[15px]">{e.nombre}</h4>
                                    <p className="text-[11px] text-gray-500 dark:text-[#849491] mb-4 font-body line-clamp-2">Tarifa general del laboratorio.</p>
                                </div>
                                <div className="flex justify-between items-end border-t border-gray-200 dark:border-white/5 pt-3 mt-auto">
                                    <span className="font-label text-gray-900 dark:text-[#4afdef] font-bold text-lg">${(e.precio || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Resumen (Cart) */}
                <aside className="sticky top-24 bg-white dark:bg-[#1d2027]/80 backdrop-blur-2xl rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xl flex flex-col max-h-[calc(100vh-120px)]">
                    <div className="p-5 border-b border-[#4afdef]/20 bg-white dark:bg-[#191b23]/50 flex items-center justify-between shrink-0">
                        <h3 className="font-headline font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2"><span className="material-symbols-outlined text-teal-600 dark:text-[#4afdef]">shopping_cart_checkout</span> Resumen de Orden</h3>
                        <span className="bg-[#4afdef]/20 text-teal-600 dark:text-[#4afdef] text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">{estudiosSeleccionados.length} ITEMS</span>
                    </div>
                    
                    <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                        {estudiosSeleccionados.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <span className="material-symbols-outlined text-4xl text-gray-500 dark:text-[#849491]">inventory_2</span>
                                <p className="text-xs text-gray-500 dark:text-[#849491] mt-2 font-body">No hay estudios en la orden.</p>
                            </div>
                        ) : estudiosSeleccionados.map(e => (
                             <div key={e._id || e.id} className="bg-gray-50 dark:bg-[#272a31] p-4 rounded-xl border border-gray-200 dark:border-white/5 relative group">
                                <h5 className="text-[13px] font-bold text-gray-900 dark:text-white pr-8 leading-tight mb-2">{e.nombre}</h5>
                                <button onClick={() => quitarEstudio(e._id || e.id)} className="absolute top-3 right-3 text-[#ffb4ab] hover:text-gray-900 dark:text-white hover:bg-[#ffb4ab]/20 w-7 h-7 flex items-center justify-center rounded transition-colors"><span className="material-symbols-outlined text-[16px]">close</span></button>
                                
                                <div className="flex items-center justify-between border-t border-gray-200 dark:border-white/5 pt-3 mt-1">
                                    <span className="text-xs text-teal-600 dark:text-[#00e0d3] font-label font-bold tracking-wider">${(e.precio || 0).toLocaleString()}</span>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#10131a] p-1 rounded-lg border border-gray-200 dark:border-white/5">
                                        <span className="text-[9px] text-gray-500 dark:text-[#849491] uppercase tracking-widest font-bold ml-1">ARS</span>
                                        <input type="number" placeholder="0" value={e.cobertura || ''} onClick={ev => ev.target.select()} onChange={ev => actualizarCobertura(e._id || e.id, ev.target.value)} className="w-[70px] bg-transparent border-0 text-right text-xs text-gray-900 dark:text-white font-label focus:ring-0 p-1 appearance-none" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {estudiosSeleccionados.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5">
                                <label className="block text-[10px] text-teal-600 dark:text-[#4afdef] font-bold uppercase tracking-widest mb-2">Médico Tratante / Referidor</label>
                                <select 
                                    value={medicoSeleccionado} 
                                    onChange={(e) => setMedicoSeleccionado(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#10131a] border border-gray-300 dark:border-[#32353c] rounded-xl text-gray-900 dark:text-white font-body py-2.5 px-3 focus:border-[#4afdef] focus:ring-1 focus:ring-[#4afdef] transition-all outline-none text-sm"
                                >
                                    <option value="">-- Sin Médico Asignado --</option>
                                    {medicos.map(m => (
                                        <option key={m._id} value={m._id}>
                                            Dr(a). {m.nombre} {m.apellido} - {m.especialidad || 'General'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-white dark:bg-gradient-to-t dark:from-gray-900 dark:to-gray-800 space-y-4 shrink-0 border-t border-gray-200 dark:border-white/5">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 dark:text-[#849491] font-bold uppercase tracking-widest text-[10px]">Neto Calculado</span>
                            <span className="text-gray-900 dark:text-white font-headline text-2xl font-bold">${calcularTotal().toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {vieneDeCotizacion ? (
                                <>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setPaso(1); setModoPaciente('cotizacion-existente'); }} disabled={estudiosSeleccionados.length === 0} className="flex-1 py-3 bg-[#4afdef] hover:bg-[#00e0d3] text-[#00201d] font-headline font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(74,253,239,0.2)] hover:shadow-[0_0_20px_rgba(74,253,239,0.4)] disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">person_search</span>
                                            Paciente Existente
                                        </button>
                                        <button onClick={() => { setPaso(1); setModoPaciente('cotizacion-nuevo'); }} disabled={estudiosSeleccionados.length === 0} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-headline font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">person_add</span>
                                            Nuevo Paciente
                                        </button>
                                    </div>
                                    <button onClick={() => { setVieneDeCotizacion(false); setPaso(1); setModoPaciente('nuevo'); setEstudiosSeleccionados([]); }} className="w-full py-3 bg-gray-100 dark:bg-[#32353c] hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl text-gray-900 dark:text-white transition-colors flex items-center justify-center gap-2 font-bold text-sm">
                                        <span className="material-symbols-outlined">arrow_back</span>
                                        Volver al Registro
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setPaso(1)} className="p-3 bg-gray-100 dark:bg-[#32353c] hover:bg-white/10 rounded-xl text-gray-900 dark:text-white transition-colors flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
                                    <button onClick={() => setPaso(3)} disabled={estudiosSeleccionados.length === 0} className="flex-1 py-3 bg-[#4afdef] hover:bg-[#00e0d3] text-[#00201d] font-headline font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(74,253,239,0.2)] hover:shadow-[0_0_20px_rgba(74,253,239,0.4)] disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2">
                                        CONTINUAR <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </section>
        )}

        {/* BLOCK 3 (LIQUIDACIÓN) */}
        {paso === 3 && (
            <section className="bg-white dark:bg-[#191b23] max-w-4xl mx-auto p-8 md:p-12 rounded-3xl border-t-[6px] border-[#4afdef] shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-8">
                <div className="text-center mb-10">
                    <span className="material-symbols-outlined text-5xl text-teal-600 dark:text-[#4afdef] mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
                    <h2 className="font-headline text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Liquidación de Servicios</h2>
                    <p className="text-gray-500 dark:text-[#849491] font-body text-sm mt-2">Verifique los montos y emita el comprobante definitivo.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-5 bg-gray-50 dark:bg-[#10131a]/50 p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#4afdef]/5 blur-3xl rounded-full pointer-events-none"></div>

                        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-white/5">
                            <span className="text-gray-600 dark:text-[#bacac7] font-body text-sm">Subtotal</span>
                            <span className="font-label text-gray-900 dark:text-white font-bold tracking-wider">${calcularSubtotal().toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-white/5">
                            <span className="text-[#ffb4ab] font-body text-sm">Cobertura Seguro</span>
                            <span className="font-label text-[#ffb4ab] font-bold tracking-wider">-${(calcularCobertura() + descuento).toLocaleString()}</span>
                        </div>
                        
                        <div className="flex flex-col pt-4">
                            <span className="text-gray-500 dark:text-[#849491] text-[10px] font-bold uppercase tracking-widest mb-1">Total a Pagar</span>
                            <span className="font-headline text-5xl font-black text-gray-900 dark:text-[#4afdef] tracking-tighter drop-shadow-[0_0_15px_rgba(74,253,239,0.2)]">${calcularTotal().toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-[10px] uppercase tracking-widest text-gray-500 dark:text-[#849491] mb-2 font-bold ml-1">Método de Pago</label>
                                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className="w-full bg-gray-100 dark:bg-[#32353c] border border-transparent rounded-xl text-gray-900 dark:text-white font-body py-3.5 px-4 focus:ring-1 focus:ring-[#4afdef] transition-all appearance-none outline-none">
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta (POS)</option>
                                    <option value="transferencia">Transferencia</option>
                                </select>
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] uppercase tracking-widest text-gray-500 dark:text-[#849491] mb-2 font-bold ml-1">Monto Recibido</label>
                                <input type="number" onClick={ev => ev.target.select()} value={montoPagado} onChange={e => setMontoPagado(parseFloat(e.target.value) || 0)} className="w-full bg-gray-50 dark:bg-[#10131a] border border-gray-300 dark:border-[#32353c] rounded-xl text-[#00e0d3] font-label font-bold text-lg py-2.5 px-4 focus:border-[#4afdef] focus:ring-1 focus:ring-[#4afdef] transition-all outline-none" />
                            </div>
                        </div>

                        {calcularTotal() > 0 && montoPagado >= calcularTotal() && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex justify-between items-center text-emerald-400 font-label text-sm animate-in fade-in">
                                <span className="font-bold">Cambio a devolver:</span>
                                <span className="font-bold tracking-wider text-base">${(montoPagado - calcularTotal()).toLocaleString()}</span>
                            </div>
                        )}

                        <button onClick={finalizarRegistro} disabled={loading} className="w-full py-5 bg-gradient-to-r from-[#4afdef] to-[#00e0d3] text-[#00201d] font-headline font-extrabold text-base tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(74,253,239,0.3)] hover:shadow-[0_0_30px_rgba(74,253,239,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 mt-4">
                            {loading ? <FaSpinner className="animate-spin text-xl" /> : <span className="material-symbols-outlined text-[20px]">receipt_long</span>}
                            {loading ? 'Procesando...' : 'Procesar y Emitir Ticket'}
                        </button>
                        
                        <button onClick={() => setPaso(2)} className="w-full py-3 bg-transparent border border-gray-200 dark:border-white/5 text-gray-500 dark:text-[#849491] hover:text-gray-900 dark:text-white hover:bg-white/5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all">
                            VOLVER A SERVICIOS
                        </button>
                    </div>
                </div>
            </section>
        )}

      </div>
    </div>
  );
};

export default RegistroInteligente;
