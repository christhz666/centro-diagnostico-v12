import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = '/api';

function BuscadorPacientes() {
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [historial, setHistorial] = useState(null);
  const timeoutRef = useRef(null);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (termino.length < 2) { setResultados(null); return; }

    timeoutRef.current = setTimeout(() => buscar(), 400);
    return () => clearTimeout(timeoutRef.current);
  }, [termino]);

  const buscar = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/busqueda/global?q=${encodeURIComponent(termino)}`, { headers });
      setResultados(res.data.resultados);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verHistorial = async (pacienteId) => {
    try {
      const res = await axios.get(`${API}/medico/historial/${pacienteId}`, { headers });
      setPacienteSeleccionado(res.data.paciente);
      setHistorial(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const formatMoney = (n) => `RD$ ${Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  const resultCount = resultados 
    ? resultados.pacientes.length + resultados.ordenes.length + resultados.facturas.length 
    : 0;

  return (
    <div className="relative font-body text-[#e1e2eb] min-h-[calc(100vh-4rem)] p-8 overflow-hidden">
      {/* Background Atmospheric Glows */}
      <div className="fixed top-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#4afdef]/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] left-[20%] w-[30vw] h-[30vw] bg-[#104f4a]/20 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto">
        {/* Page Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-gray-600 dark:text-[#bacac7] font-label text-[10px] tracking-[0.3em] uppercase block mb-1">Clinical Directory</span>
            <h2 className="font-headline text-4xl font-extrabold tracking-tight text-[#e1e2eb] drop-shadow-[0_0_15px_rgba(74,253,239,0.2)]">Patient Operations</h2>
            <p className="text-gray-600 dark:text-[#bacac7] mt-1 text-sm">Manage current admissions and diagnostic pipelines</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            {/* Search Input directly in header for quick access without TopBar */}
            <div className="relative w-full md:w-80 group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-[#bacac7] group-focus-within:text-[#00e0d3] transition-colors" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>search</span>
              <input 
                className="w-full bg-gray-100 dark:bg-[#32353c] border-none rounded-lg py-2.5 pl-10 pr-4 text-[#e1e2eb] focus:ring-1 focus:ring-[#4afdef]/30 transition-all placeholder:text-gray-600 dark:text-[#bacac7]/50 text-sm" 
                placeholder="Search by name, ID, phone..." 
                type="text"
                autoFocus
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
              />
              {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00e0d3] material-symbols-outlined animate-spin" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>sync</span>}
            </div>
            <button className="hidden md:flex px-6 py-2.5 rounded-lg bg-gradient-to-br from-[#4afdef] to-[#00e0d3] text-[#00201e] font-bold shadow-[0_8px_24px_-8px_rgba(0,224,211,0.5)] active:scale-[0.98] transition-all items-center gap-2 whitespace-nowrap">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>person_add</span>
              New Patient
            </button>
          </div>
        </div>

        {/* Global Content Container (Glassmorphism) */}
        <div className="bg-[rgba(29,32,38,0.7)] backdrop-blur-[24px] rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] flex h-[calc(100vh-280px)] border border-gray-200 dark:border-white/5 overflow-hidden">
          
          {/* Main List (Left/Center) */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {!resultados && termino.length < 2 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 dark:text-[#bacac7] opacity-60">
                <span className="material-symbols-outlined text-6xl mb-4" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}>group_find</span>
                <p>Type at least 2 characters to search the global directory.</p>
              </div>
            )}

            {resultados && resultCount === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 dark:text-[#bacac7]">
                <span className="material-symbols-outlined text-4xl mb-4 text-[#ffb4ab]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}>search_off</span>
                <p>No results found for "{termino}"</p>
              </div>
            )}

            {resultados && resultCount > 0 && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-600 dark:text-[#bacac7] border-b border-gray-200 dark:border-white/10">
                    <th className="px-6 py-4 font-semibold">Identity / Entity</th>
                    <th className="px-6 py-4 font-semibold">Reference ID</th>
                    <th className="px-6 py-4 font-semibold">Date / Info</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  
                  {/* Pacientes */}
                  {resultados.pacientes.map(p => (
                    <tr key={`p-${p.id}`} onClick={() => verHistorial(p.id)} className={`group hover:bg-gray-50 dark:bg-[#272a31]/60 transition-colors cursor-pointer ${pacienteSeleccionado?.id === p.id ? 'bg-gray-50 dark:bg-[#272a31]/80 border-l-2 border-[#00e0d3]' : 'border-l-2 border-transparent'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#32353c] text-[#00e0d3] flex items-center justify-center font-bold font-headline shadow-inner">
                            {p.nombre.charAt(0)}{p.apellido ? p.apellido.charAt(0) : ''}
                          </div>
                          <div>
                            <p className="font-bold text-[#e1e2eb]">{p.nombre} {p.apellido}</p>
                            <p className="text-xs text-gray-600 dark:text-[#bacac7] flex items-center gap-2">
                              {p.telefono && <><span className="material-symbols-outlined text-[12px]">call</span> {p.telefono}</>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-[#bacac7]">{p.cedula || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[#e1e2eb]">{p.codigo || '--'}</p>
                        <p className="text-[10px] text-gray-600 dark:text-[#bacac7]">Internal Code</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${p.estado === 'Activo' ? 'bg-[#00e0d3] shadow-[0_0_8px_#00e0d3]' : 'bg-[#849491]'}`}></div>
                          <span className="text-sm text-[#e1e2eb]">{p.estado || 'Registrado'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="material-symbols-outlined text-gray-600 dark:text-[#bacac7] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>chevron_right</span>
                      </td>
                    </tr>
                  ))}

                  {/* Órdenes */}
                  {resultados.ordenes.map(o => (
                    <tr key={`o-${o.id}`} className="group hover:bg-gray-50 dark:bg-[#272a31]/40 transition-colors cursor-pointer border-l-2 border-transparent">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#104f4a]/30 text-[#87c0b9] flex items-center justify-center font-bold">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>clinical_notes</span>
                          </div>
                          <div>
                            <p className="font-bold text-[#e1e2eb]">Order: {o.numero_orden}</p>
                            <p className="text-xs text-gray-600 dark:text-[#bacac7]">{o.paciente}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-[#bacac7]">{o.numero_orden}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[#e1e2eb]">{new Date(o.fecha).toLocaleDateString('es-DO')}</p>
                        <p className="text-[10px] text-gray-600 dark:text-[#bacac7]">Creation Date</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-gray-100 dark:bg-[#32353c] text-[#e1e2eb] text-[11px] font-medium border border-gray-200 dark:border-white/10">{o.estado}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="material-symbols-outlined text-gray-600 dark:text-[#bacac7] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>open_in_new</span>
                      </td>
                    </tr>
                  ))}

                  {/* Facturas */}
                  {resultados.facturas.map(f => (
                    <tr key={`f-${f.id}`} className="group hover:bg-gray-50 dark:bg-[#272a31]/40 transition-colors cursor-pointer border-l-2 border-transparent">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#93000a]/20 text-[#ffb4ab] flex items-center justify-center font-bold">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>receipt_long</span>
                          </div>
                          <div>
                            <p className="font-bold text-[#e1e2eb]">Invoice: {f.numero_factura}</p>
                            <p className="text-xs text-gray-600 dark:text-[#bacac7]">{f.paciente}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-[#bacac7]">{f.ncf || 'Sin NCF'}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[#e1e2eb]">{formatMoney(f.total)}</p>
                        <p className="text-[10px] text-gray-600 dark:text-[#bacac7]">Total Amount</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${f.estado === 'Pagada' ? 'bg-[#00e0d3]' : 'bg-[#ffb4ab]'}`}></div>
                          <span className="text-sm text-[#e1e2eb]">{f.estado}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="material-symbols-outlined text-gray-600 dark:text-[#bacac7] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>open_in_new</span>
                      </td>
                    </tr>
                  ))}
                  
                </tbody>
              </table>
            )}
          </div>

          {/* Detail Panel (Right) */}
          {pacienteSeleccionado && historial && (
            <aside className="w-96 bg-gray-50 dark:bg-[#272a31] border-l border-gray-200 dark:border-white/5 flex flex-col relative overflow-hidden transition-all duration-300">
              <button onClick={() => { setPacienteSeleccionado(null); setHistorial(null); }} className="absolute top-4 right-4 text-gray-600 dark:text-[#bacac7] hover:text-[#ffb4ab] transition-colors z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>close</span>
              </button>
              
              <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#32353c] flex items-center justify-center border border-[#00e0d3]/20 text-[#00e0d3] font-headline text-2xl font-bold shadow-lg">
                    {pacienteSeleccionado.nombre.charAt(0)}{pacienteSeleccionado.apellido ? pacienteSeleccionado.apellido.charAt(0) : ''}
                  </div>
                  <div className="mt-1">
                    <h3 className="font-headline text-xl font-bold text-[#e1e2eb] leading-tight">{pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}</h3>
                    <p className="text-sm text-gray-600 dark:text-[#bacac7] font-mono mt-1">ID: {pacienteSeleccionado.cedula || 'N/A'}</p>
                  </div>
                </div>

                {/* Patient Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-100 dark:bg-[#32353c] p-3 rounded-xl border border-gray-200 dark:border-white/5">
                     <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-[#bacac7] block mb-1">Blood Type</span>
                     <span className="text-[#e1e2eb] font-bold text-sm">{pacienteSeleccionado.tipo_sangre || 'Unknown'}</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-[#32353c] p-3 rounded-xl border border-gray-200 dark:border-white/5">
                     <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-[#bacac7] block mb-1">Allergies</span>
                     <span className="text-[#ffb4ab] font-bold text-sm truncate" title={pacienteSeleccionado.alergias || 'None'}>{pacienteSeleccionado.alergias || 'None'}</span>
                  </div>
                </div>

                {/* Vitals Sparklines (Simulated for visual fidelity per design system) */}
                <div className="space-y-4">
                  <div className="bg-gray-100 dark:bg-[#32353c] p-4 rounded-xl border border-gray-200 dark:border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#4afdef]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-center mb-2 relative z-10">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-[#bacac7]">System Engagements</span>
                      <span className="text-[#00e0d3] font-headline font-bold">{historial.total_ordenes} Orders</span>
                    </div>
                    {/* Simulated Sparkline */}
                    <div className="h-8 flex items-end gap-[2px] relative z-10">
                      <div className="flex-1 bg-[#4afdef]/10 h-3 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/20 h-5 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/30 h-4 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/20 h-6 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/40 h-8 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/30 h-7 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/20 h-5 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/50 h-6 rounded-t-sm"></div>
                      <div className="flex-1 bg-[#4afdef]/10 h-4 rounded-t-sm"></div>
                    </div>
                  </div>
                </div>

                {/* Activity Log */}
                <div className="mt-2">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-600 dark:text-[#bacac7] mb-4">Recent Activity Log</h4>
                  <div className="space-y-6 relative before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-px before:bg-white/10">
                    
                    {historial.ordenes.slice(0, 3).map((o, idx) => (
                      <div key={`ho-${o.id}`} className="relative pl-8">
                        <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full flex items-center justify-center border ${idx === 0 ? 'bg-[#4afdef]/20 border-[#4afdef]/40' : 'bg-gray-100 dark:bg-[#32353c] border-white/20'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-[#4afdef]' : 'bg-[#bacac7]'}`}></div>
                        </div>
                        <p className="text-xs font-bold text-[#e1e2eb]">Order Created: {o.numero_orden}</p>
                        <p className="text-[10px] text-gray-600 dark:text-[#bacac7] capitalize mt-0.5">{new Date(o.fecha_orden).toLocaleDateString('es-DO')} • {o.estado}</p>
                      </div>
                    ))}

                    {historial.facturas.slice(0, 2).map((f) => (
                      <div key={`hf-${f.id}`} className="relative pl-8">
                        <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-gray-100 dark:bg-[#32353c] border border-white/20 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#bacac7]"></div>
                        </div>
                        <p className="text-xs font-bold text-[#e1e2eb]">Invoice Generated {formatMoney(f.total)}</p>
                        <p className="text-[10px] text-gray-600 dark:text-[#bacac7] capitalize mt-0.5">{new Date(f.fecha_factura).toLocaleDateString('es-DO')} • {f.estado}</p>
                      </div>
                    ))}
                    
                    {historial.ordenes.length === 0 && historial.facturas.length === 0 && (
                       <p className="text-xs text-gray-600 dark:text-[#bacac7] pl-8 italic">No recent activities on record.</p>
                    )}

                  </div>
                </div>
              </div>
              
              <div className="mt-auto p-4 border-t border-gray-200 dark:border-white/5 bg-[#1d2026]">
                <button className="w-full py-3 bg-gray-100 dark:bg-[#32353c] hover:bg-[#104f4a] transition-colors rounded-lg text-[#00e0d3] font-semibold text-sm flex items-center justify-center gap-2 border border-[#00e0d3]/20 shadow-[0_0_15px_rgba(0,224,211,0.05)]">
                  Full Clinical Profile
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>open_in_new</span>
                </button>
              </div>
            </aside>
          )}
        </div>
        
        {/* Footnote / Quick Info if needed, to match spacing constraints */}
        {!pacienteSeleccionado && (
           <div className="flex justify-between items-center px-2 py-1">
             <span className="text-[10px] text-gray-600 dark:text-[#bacac7]/40 uppercase tracking-[0.2em] font-medium">Global Patient Repository Active</span>
             <span className="text-[10px] text-gray-600 dark:text-[#bacac7]/40 uppercase tracking-[0.2em] font-medium">Secured Node Connection</span>
           </div>
        )}
      </div>
    </div>
  );
}

export default BuscadorPacientes;
