import React, { startTransition, useEffect, useState } from 'react';
import api from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    AreaChart, Area
} from 'recharts';

/* ── Paleta para gráficos ──────────────────────────────────── */
const CHART_COLORS = ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const readStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user')) || {};
    } catch {
        return {};
    }
};

const getPayload = (result) => {
    if (result.status !== 'fulfilled') return null;
    return result.value?.data || result.value || null;
};

const StatCard = ({ title, value, subtext, icon, colorClass }) => {
    return (
        <div className="bg-white dark:bg-[#1d2027]/70 backdrop-blur-[24px] p-6 rounded-xl shadow-[0_0_40px_-15px_rgba(74,253,239,0.15)] group hover:bg-white dark:bg-[#1d2027] transition-all border border-gray-200 dark:border-white/5 flex flex-col justify-between h-48">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${colorClass}`}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>{icon}</span>
                </div>
            </div>
            <div>
                <p className="font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-[0.15em] mb-1">{title}</p>
                <h3 className="font-headline text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
                <p className="text-[10px] text-gray-600 dark:text-[#bacac7] mt-2">{subtext}</p>
            </div>
        </div>
    );
};

/* ── Tooltip personalizado para gráficos ──────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#191b23', border: '1px solid #3b4a48', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 20px rgba(0,0,0,0.5)' }}>
            <p style={{ margin: 0, fontSize: 10, color: '#bacac7', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: p.color || '#fff' }}>
                    {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('ingreso')
                        ? `RD$ ${p.value.toLocaleString('es-DO')}`
                        : p.value}
                </p>
            ))}
        </div>
    );
};

const Dashboard = () => {
    const [stats, setStats] = useState({ citasHoy: 0, estudiosRealizados: 0, ingresosHoy: 0, pacientesNuevos: 0, facturacionMes: 0 });
    const [citasHoy, setCitasHoy] = useState([]);
    const [citasGrafica, setCitasGrafica] = useState([]);
    const [topEstudios, setTopEstudios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user] = useState(readStoredUser);

    const fetchDashboardData = async () => {
        setLoading(true);
        const fechaActual = new Date().toISOString().split('T')[0];

        try {
            const [statsResult, citasResult, graficaResult, estudiosResult] = await Promise.allSettled([
                api.getDashboardStats(),
                api.getCitas({ fecha: fechaActual }),
                api.getCitasGrafica(),
                api.getTopEstudios()
            ]);

            const statsData = getPayload(statsResult);
            const citasData = getPayload(citasResult);
            const graficaData = getPayload(graficaResult);
            const estudiosData = getPayload(estudiosResult);

            startTransition(() => {
                if (statsData) {
                    setStats({
                        citasHoy: statsData.citas?.hoy ?? 0,
                        estudiosRealizados: statsData.resultados?.completadosMes ?? 0,
                        ingresosHoy: statsData.facturacion?.hoy?.total ?? 0,
                        facturacionMes: statsData.facturacion?.mes?.total ?? 0,
                        pacientesNuevos: statsData.pacientes?.nuevosMes ?? 0,
                        resultadosPendientes: statsData.resultados?.pendientes ?? 0,
                        totalPacientes: statsData.pacientes?.total ?? 0,
                    });
                }

                setCitasHoy(Array.isArray(citasData) ? citasData.slice(0, 6) : (citasData?.slice(0, 6) || []));
                setCitasGrafica((Array.isArray(graficaData) ? graficaData : []).map((item) => ({
                    fecha: item._id?.split('-').slice(1).join('/') || item.fecha || '--/--',
                    total: item.total || 0,
                    completadas: item.completadas || 0,
                })));
                setTopEstudios((Array.isArray(estudiosData) ? estudiosData : []).slice(0, 6));
            });
        } catch (error) {
            console.error('Dashboard error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 60000);
        return () => clearInterval(interval);
    }, []);

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    const fmtMoney = (n) => `RD$ ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 0 })}`;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Section 1: Welcome Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative z-10">
                <div>
                    <h1 className="font-headline text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {saludo}, <span className="bg-gradient-to-r from-[#00ded1] to-[#4afdef] bg-clip-text text-transparent">{user?.nombre?.split(' ')[0] || 'Doctor'}</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-gray-600 dark:text-[#bacac7]">
                        <p className="font-label text-sm uppercase tracking-wider">Panel de diagnóstico inteligente</p>
                        <span className="w-1 h-1 rounded-full bg-[#3b4a48]"></span>
                        <p className="font-label text-sm uppercase tracking-wider">{new Date().toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                </div>
                <button
                    onClick={fetchDashboardData}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#3b4a48]/50 hover:bg-gray-50 dark:bg-[#272a31]/50 transition-colors text-gray-900 dark:text-[#e0e2ec] active:scale-95 ${loading ? 'opacity-50' : ''}`}
                >
                    <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`} style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>refresh</span>
                    <span className="font-label text-xs uppercase tracking-widest">Actualizar</span>
                </button>
            </header>

            {/* Section 2: Metrics Cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 relative z-10">
                <StatCard title="Citas Hoy" value={stats.citasHoy} subtext={`${citasHoy.length} en espera`} icon="calendar_today" colorClass="bg-blue-500/10 text-blue-400" />
                <StatCard title="Resultados Mes" value={stats.estudiosRealizados} subtext={`${stats.resultadosPendientes || 0} pendientes`} icon="science" colorClass="bg-[#4afdef]/10 text-[#4afdef]" />
                <StatCard title="Ingresos Hoy" value={fmtMoney(stats.ingresosHoy)} subtext={`Mes: ${fmtMoney(stats.facturacionMes)}`} icon="payments" colorClass="bg-green-500/10 text-green-400" />
                <StatCard title="Pacientes Nuevos" value={stats.pacientesNuevos} subtext={`${stats.totalPacientes || 0} total`} icon="people" colorClass="bg-purple-500/10 text-purple-400" />
            </section>

            {/* Section 3: Bento Grid Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12 relative z-10">
                {/* Area Chart: Pacientes por Día */}
                <div className="lg:col-span-2 bg-white dark:bg-[#1d2027]/70 backdrop-blur-[24px] rounded-xl p-8 border border-gray-200 dark:border-white/5">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h4 className="font-headline text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Pacientes por Día</h4>
                            <p className="font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-widest">Últimos 30 días</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#4afdef]"></span>
                                <span className="text-[10px] font-label text-gray-600 dark:text-[#bacac7] uppercase tracking-widest">Total</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                                <span className="text-[10px] font-label text-gray-600 dark:text-[#bacac7] uppercase tracking-widest">Completadas</span>
                            </div>
                        </div>
                    </div>
                    {citasGrafica.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={citasGrafica}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4afdef" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#4afdef" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(186,202,199,0.05)" vertical={false} />
                                    <XAxis dataKey="fecha" tick={{ fill: '#bacac7', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#bacac7', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="total" name="Total" stroke="#4afdef" strokeWidth={2.5} fill="url(#colorTotal)" />
                                    <Area type="monotone" dataKey="completadas" name="Completadas" stroke="#10b981" strokeWidth={2} fill="url(#colorComp)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-600 dark:text-[#bacac7]/50">
                            <span className="material-symbols-outlined text-4xl mb-2" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>monitoring</span>
                            <span className="font-label text-xs uppercase tracking-widest">Sin datos</span>
                        </div>
                    )}
                </div>

                {/* Donut Chart: Estudios Populares */}
                <div className="bg-white dark:bg-[#1d2027]/70 backdrop-blur-[24px] rounded-xl p-8 border border-gray-200 dark:border-white/5 flex flex-col">
                    <div className="w-full text-left mb-8">
                        <h4 className="font-headline text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Estudios</h4>
                        <p className="font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-widest">Distribución por especialidad</p>
                    </div>
                    {topEstudios.length > 0 ? (
                        <div className="flex-1 min-h-[220px]">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={topEstudios.map(e => ({ name: e.nombre || 'Estudio', value: e.cantidad || 0 }))}
                                        cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={85}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {topEstudios.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-4 space-y-2">
                                {topEstudios.slice(0,3).map((est, i) => (
                                    <div key={i} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></span>
                                            <span className="font-label text-[10px] text-gray-900 dark:text-[#e0e2ec] uppercase tracking-wider truncate max-w-[120px]">{est.nombre}</span>
                                        </div>
                                        <span className="font-headline text-xs text-gray-900 dark:text-white">{est.cantidad}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 dark:text-[#bacac7]/50">
                            <span className="material-symbols-outlined text-4xl mb-2" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>donut_large</span>
                            <span className="font-label text-xs uppercase tracking-widest">Sin datos</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Actividad Semanal (Bar Chart) */}
            {citasGrafica.length > 0 && (
                <section className="bg-white dark:bg-[#1d2027]/70 backdrop-blur-[24px] rounded-xl p-8 border border-gray-200 dark:border-white/5 mb-12 relative z-10">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h4 className="font-headline text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Actividad de Citas</h4>
                            <p className="font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-widest">Total vs Completadas — últimos 30 días</p>
                        </div>
                        <span className="material-symbols-outlined text-gray-600 dark:text-[#bacac7]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>bar_chart</span>
                    </div>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={citasGrafica}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(186,202,199,0.05)" vertical={false} />
                                <XAxis dataKey="fecha" tick={{ fill: '#bacac7', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#bacac7', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="total" name="Total" fill="#4afdef" radius={[4, 4, 0, 0]} barSize={12} />
                                <Bar dataKey="completadas" name="Completadas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            )}

            {/* Section 4: Recent Activity Table */}
            <section className="bg-white dark:bg-[#1d2027]/70 backdrop-blur-[24px] rounded-xl overflow-hidden border border-gray-200 dark:border-white/5 relative z-10">
                <div className="px-8 py-6 flex justify-between items-center bg-white dark:bg-[#191b23]/30">
                    <h4 className="font-headline text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Pacientes de Hoy</h4>
                    <span className="bg-[#4afdef]/10 text-[#4afdef] px-3 py-1 rounded text-[10px] font-label font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(74,253,239,0.15)]">{citasHoy.length} ACTIVOS</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-[#10131a]/50 border-none">
                            <tr>
                                <th className="px-8 py-4 font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-[0.2em] font-medium">Paciente</th>
                                <th className="px-8 py-4 font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-[0.2em] font-medium">Estudio</th>
                                <th className="px-8 py-4 font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-[0.2em] font-medium">Estado</th>
                                <th className="px-8 py-4 font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-[0.2em] font-medium">Hora</th>
                                <th className="px-8 py-4 font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-[0.2em] font-medium text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-0">
                            {citasHoy.map((cita, i) => (
                                <tr key={i} className="group hover:bg-white/5 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#32353c] flex items-center justify-center font-headline text-sm font-bold text-[#4afdef]">
                                                {(cita.paciente?.nombre || 'P')[0]}
                                            </div>
                                            <div>
                                                <p className="font-headline text-sm text-gray-900 dark:text-white font-medium">{cita.paciente?.nombre} {cita.paciente?.apellido}</p>
                                                <p className="font-label text-[10px] text-gray-600 dark:text-[#bacac7] uppercase tracking-widest">ID: {cita.paciente?._id || cita.paciente_id || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="bg-gray-100 dark:bg-[#32353c] text-gray-900 dark:text-[#e0e2ec] px-3 py-1 rounded text-[10px] font-label uppercase tracking-widest">
                                            {cita.estudios?.[0]?.estudio?.nombre || 'General'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex h-2 w-2">
                                                {cita.estado !== 'Completada' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4afdef] opacity-75"></span>}
                                                <span className={`relative inline-flex rounded-full h-2 w-2 ${cita.estado === 'Completada' ? 'bg-green-500' : 'bg-[#4afdef]'}`}></span>
                                            </span>
                                            <span className={`font-label text-[10px] ${cita.estado === 'Completada' ? 'text-green-500' : 'text-[#4afdef]'} uppercase tracking-widest`}>
                                                {cita.estado}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 font-headline text-sm text-gray-600 dark:text-[#bacac7]">
                                        {cita.horaInicio || '--:--'}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button
                                            onClick={() => window.location.href = `/resultados?paciente=${cita.paciente?._id || cita.paciente_id || ''}`}
                                            className="p-2 hover:bg-gray-100 dark:bg-[#32353c] rounded transition-colors text-gray-600 dark:text-[#bacac7] hover:text-gray-900 dark:text-white"
                                        >
                                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>description</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {citasHoy.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-600 dark:text-[#bacac7]">No hay citas para hoy</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-8 py-4 bg-white dark:bg-[#191b23]/30 flex justify-center border-t border-gray-200 dark:border-white/5">
                    <button
                        onClick={() => window.location.href = '/consulta'}
                        className="font-label text-[10px] text-[#4afdef] uppercase tracking-[0.2em] hover:underline"
                    >
                        Ver todo el registro
                    </button>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
