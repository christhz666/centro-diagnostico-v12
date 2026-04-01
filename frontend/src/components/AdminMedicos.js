import React, { useState, useEffect } from 'react';
import { FaUserMd, FaChartBar, FaCalendarAlt, FaSpinner, FaSave } from 'react-icons/fa';
import api from '../services/api';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function AdminMedicos() {
    const [medicos, setMedicos] = useState([]);
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMedico, setSelectedMedico] = useState(null);
    const [activeTab, setActiveTab] = useState('schedules'); // schedules, stats

    useEffect(() => {
        fetchData();
    }, []);

                const fetchData = async () => {
        try {
            setLoading(true);
            const docsRes = await api.request('/admin/medicos');
            const statsRes = await api.request('/admin/estadisticas-medicos', { noUnwrap: true });
            if (docsRes) setMedicos(docsRes || []);
            if (statsRes && statsRes.success) setStats(statsRes.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSchedule = async (medicoId, nuevosHorarios) => {
        try {
            await api.request(`/admin/usuarios/${medicoId}`, { 
                method: 'PUT', 
                body: JSON.stringify({ horarios: nuevosHorarios }) 
            });
            // Refresh
            fetchData();
            setSelectedMedico(null);
        } catch (error) {
            console.error("Error guardando horario:", error);
            alert("Error al guardar horario.");
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <FaSpinner className="animate-spin text-primary text-4xl" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FaUserMd /> Gestión de Médicos
                </h1>
                <div className="flex bg-gray-100 dark:bg-surface-dark-high p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('schedules')}
                        className={`px-4 py-2 rounded-md transition-all font-semibold ${activeTab === 'schedules' ? 'bg-white dark:bg-[#3df5e7]/20 text-gray-900 dark:text-[#3df5e7] shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}
                    >
                        <FaCalendarAlt className="inline mr-2"/> Horarios y Áreas
                    </button>
                    <button 
                        onClick={() => setActiveTab('stats')}
                        className={`px-4 py-2 rounded-md transition-all font-semibold ${activeTab === 'stats' ? 'bg-white dark:bg-[#3df5e7]/20 text-gray-900 dark:text-[#3df5e7] shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}
                    >
                        <FaChartBar className="inline mr-2"/> Productividad
                    </button>
                </div>
            </div>

            {activeTab === 'schedules' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Lista de Médicos */}
                    <div className="md:col-span-1 bg-white dark:bg-surface-dark rounded-xl shadow-glass-glow border border-gray-200 dark:border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                            <h2 className="font-semibold text-gray-900 dark:text-white">Equipo Médico</h2>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-white/5 h-[600px] overflow-y-auto custom-scrollbar">
                            {medicos.map(doc => (
                                <div 
                                    key={doc._id} 
                                    onClick={() => setSelectedMedico(doc)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${selectedMedico?._id === doc._id ? 'bg-primary/5 dark:bg-[#3df5e7]/10 border-l-4 border-primary dark:border-[#3df5e7]' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className="font-semibold text-gray-900 dark:text-white">{doc.nombre} {doc.apellido}</div>
                                    <div className="text-sm text-gray-500 dark:text-slate-400">{doc.especialidad || 'General'}</div>
                                    <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                                        {(doc.horarios && doc.horarios.length > 0) ? `${doc.horarios.length} bloque(s) asignado(s)` : 'Sin horario'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Editor de Horario */}
                    <div className="md:col-span-2">
                        {selectedMedico ? (
                            <HorarioEditor medico={selectedMedico} onSave={(h) => handleSaveSchedule(selectedMedico._id, h)} />
                        ) : (
                            <div className="h-[600px] flex items-center justify-center bg-gray-50 dark:bg-surface-dark/50 rounded-xl border border-gray-200 dark:border-white/5">
                                <p className="text-gray-500 dark:text-slate-400 text-lg">Selecciona un médico para editar su horario</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {stats.map(stat => (
                            <div key={stat._id} className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-gray-200 dark:border-white/5 shadow-glass-glow">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Dr(a). {stat.nombre} {stat.apellido}</h3>
                                <p className="text-sm text-primary dark:text-[#3df5e7] mb-4">{stat.especialidad || 'Especialidad General'}</p>
                                
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-lg">
                                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.totalPacientes}</div>
                                        <div className="text-xs text-gray-500 dark:text-slate-400 uppercase">Pacientes</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-lg">
                                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.totalEstudios}</div>
                                        <div className="text-xs text-gray-500 dark:text-slate-400 uppercase">Estudios</div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2 border-b border-gray-200 dark:border-white/10 pb-1">Desglose de Estudios</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                        {stat.estudios && stat.estudios.length > 0 ? stat.estudios.map((est, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm">
                                                <span className="text-gray-600 dark:text-slate-400 truncate mr-2" title={est.nombre}>{est.nombre}</span>
                                                <span className="bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white px-2 py-0.5 rounded-full text-xs font-bold">{est.cantidad}</span>
                                            </div>
                                        )) : (
                                            <div className="text-xs text-gray-400">Sin estudios registrados.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {stats.length === 0 && (
                            <div className="col-span-3 text-center py-12 bg-white dark:bg-surface-dark rounded-xl">
                                <p className="text-gray-500 dark:text-slate-400">No hay datos de productividad en el período actual.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function HorarioEditor({ medico, onSave }) {
    const [horarios, setHorarios] = useState([]);

    useEffect(() => {
        if (medico && medico.horarios) {
            setHorarios([...medico.horarios]);
        } else {
            setHorarios([]);
        }
    }, [medico]);

    const addBloque = () => {
        setHorarios([...horarios, { dia: 'Lunes', horaInicio: '08:00', horaFin: '12:00', area: medico.especialidad || 'General' }]);
    };

    const removeBloque = (index) => {
        const h = [...horarios];
        h.splice(index, 1);
        setHorarios(h);
    };

    const handleChange = (index, field, value) => {
        const h = [...horarios];
        h[index][field] = value;
        setHorarios(h);
    };

    return (
        <div className="bg-white dark:bg-surface-dark h-full rounded-xl shadow-glass-glow border border-gray-200 dark:border-white/5 flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Horario de {medico.nombre} {medico.apellido}</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Configura los días, horas y áreas de atención.</p>
                </div>
                <button onClick={() => onSave(horarios)} className="bg-primary hover:bg-primary-dark dark:bg-[#3df5e7] dark:hover:bg-[#3df5e7]/80 dark:text-[#0b0e15] text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold flex items-center transition-colors">
                    <FaSave className="mr-2" /> Guardar Cambios
                </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
                {horarios.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-300 dark:border-white/10">
                        <p className="text-gray-500 dark:text-slate-400 mb-4">Este médico aún no tiene bloques de horario asignados.</p>
                        <button onClick={addBloque} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg transition-colors font-medium text-sm">
                            + Agregar Primer Bloque
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {horarios.map((h, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row gap-4 items-end bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 rounded-xl relative group">
                                <button onClick={() => removeBloque(idx)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110">
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                                
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Día</label>
                                    <select 
                                        value={h.dia} 
                                        onChange={(e) => handleChange(idx, 'dia', e.target.value)}
                                        className="w-full bg-white dark:bg-[#161a22] border border-gray-300 dark:border-[#454850] rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-primary dark:focus:ring-[#3df5e7]"
                                    >
                                        {DIAS.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Inicio</label>
                                    <input 
                                        type="time" 
                                        value={h.horaInicio} 
                                        onChange={(e) => handleChange(idx, 'horaInicio', e.target.value)}
                                        className="w-full bg-white dark:bg-[#161a22] border border-gray-300 dark:border-[#454850] rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fin</label>
                                    <input 
                                        type="time" 
                                        value={h.horaFin} 
                                        onChange={(e) => handleChange(idx, 'horaFin', e.target.value)}
                                        className="w-full bg-white dark:bg-[#161a22] border border-gray-300 dark:border-[#454850] rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Área / Servicio</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej. Ginecología"
                                        value={h.area} 
                                        onChange={(e) => handleChange(idx, 'area', e.target.value)}
                                        className="w-full bg-white dark:bg-[#161a22] border border-gray-300 dark:border-[#454850] rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600"
                                    />
                                </div>
                            </div>
                        ))}
                        <button onClick={addBloque} className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-primary dark:hover:border-[#3df5e7]/50 rounded-xl text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-[#3df5e7] transition-all font-semibold flex justify-center items-center gap-2">
                            <span className="material-icons-round">add</span> Agregar Bloque
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminMedicos;
