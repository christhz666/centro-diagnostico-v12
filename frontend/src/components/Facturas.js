import React, { useState, useEffect, useCallback } from 'react';
import { FaFileInvoiceDollar, FaEye, FaPrint, FaSpinner, FaPlus, FaChartLine, FaMoneyBillWave, FaFileExcel } from 'react-icons/fa';
import api from '../services/api';
import FacturaTermica from './FacturaTermica';
import { loadXLSX } from '../utils/loadXlsx';

const theme = {
  surface: 'var(--legacy-surface)',
  surfaceMuted: 'var(--legacy-surface-muted)',
  surfaceHover: 'var(--legacy-surface-hover)',
  panel: 'var(--legacy-surface-panel)',
  border: 'var(--legacy-border)',
  borderSoft: 'var(--legacy-border-soft)',
  text: 'var(--legacy-text)',
  textStrong: 'var(--legacy-text-strong)',
  textMuted: 'var(--legacy-text-muted)'
};

const Facturas = () => {
  const [facturas, setFacturas] = useState([]);
  const [resumenFiscal, setResumenFiscal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [facturaDetalle, setFacturaDetalle] = useState(null);
  const [citasPendientes, setCitasPendientes] = useState([]);
  const [showModalNueva, setShowModalNueva] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [facturaImprimir, setFacturaImprimir] = useState(null);
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [showModalPago, setShowModalPago] = useState(null);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  const fetchTurnoActivo = useCallback(async () => {
    try {
      const response = await api.getTurnoActivo();
      if (response && (response.data || response)) setTurnoActivo(response.data || response);
      else setTurnoActivo(null);
    } catch (err) {
      console.error('Error cargando turno:', err);
      setTurnoActivo(null);
    }
  }, []);

  const abrirTurnoManual = async () => {
    try {
      setLoading(true);
      await api.abrirTurnoCaja();
      fetchTurnoActivo();
    } catch (err) {
      console.error('Error abriendo caja:', err);
    } finally {
      setLoading(false);
    }
  };

  const cerrarTurnoManual = async () => {
    if (!window.confirm('¿Desea cerrar la caja actual?')) return;
    try {
      setLoading(true);
      await api.cerrarTurnoCaja();
      setTurnoActivo(null);
    } catch (err) {
      console.error('Error cerrando caja:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacturas = useCallback(async (isSilent = false, estado = filtroEstado) => {
    try {
      if (!isSilent) setLoading(true);
      const params = estado ? { estado } : {};
      const response = await api.getFacturas(params);
      setFacturas(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error(err);
      if (!isSilent) setFacturas([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [filtroEstado]);

  const fetchResumenFiscal = useCallback(async () => {
    try {
      const response = await api.getResumenFacturas();
      setResumenFiscal(response?.data || response || null);
    } catch (err) {
      console.error('Error cargando resumen fiscal:', err);
      setResumenFiscal(null);
    }
  }, []);

  const fetchCitasPendientes = useCallback(async (isSilent = false) => {
    try {
      const response = await api.getCitas({ pagado: false });
      const citas = Array.isArray(response) ? response : (response.data || []);
      setCitasPendientes(citas.filter(c => c.estado === 'completada' || c.estado === 'programada'));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchFacturas();
    fetchCitasPendientes();
    fetchTurnoActivo();
    fetchResumenFiscal();

    const interval = setInterval(() => {
      fetchFacturas(true);
      fetchCitasPendientes(true);
      fetchResumenFiscal();
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchFacturas, fetchCitasPendientes, fetchTurnoActivo, fetchResumenFiscal]);

  const verDetalle = async (factura) => {
    try {
      const response = await api.getFactura(factura._id || factura.id);
      setFacturaDetalle(response);
    } catch (err) {
      console.error(err);
    }
  };

  const imprimirFactura = async (factura) => {
    try {
      const response = await api.getFactura(factura._id || factura.id);
      const facturaCompleta = response;
      let pacienteData = facturaCompleta.paciente || facturaCompleta.datosCliente;

      if (typeof pacienteData === 'string') {
        try {
          const pacienteResponse = await api.getPaciente(pacienteData);
          pacienteData = pacienteResponse.data;
        } catch (e) {
          pacienteData = facturaCompleta.datosCliente || { nombre: 'N/A' };
        }
      }

      const estudios = (facturaCompleta.detalles || facturaCompleta.items || []).map(item => ({
        nombre: item.descripcion || item.nombre || 'Estudio',
        precio: item.precioUnitario || item.precio_unitario || item.precio || 0,
        cobertura: item.descuento || item.cobertura || 0
      }));

      setFacturaImprimir({
        factura: { ...facturaCompleta, numero: facturaCompleta.numero || facturaCompleta.numero_factura },
        paciente: pacienteData,
        estudios: estudios
      });
    } catch (err) {
      console.error('Error al cargar factura:', err);
    }
  };

  const crearFactura = async () => {
    if (!turnoActivo) { alert("Inicie el turno de caja."); return; }
    if (!citaSeleccionada) return;

    try {
      const items = citaSeleccionada.estudios?.map(e => ({
        descripcion: e.estudio?.nombre || 'Estudio',
        nombre: e.estudio?.nombre || 'Estudio',
        estudio: e.estudio?._id || e.estudio,
        cantidad: 1,
        precio: e.precio || 0,
        precioUnitario: e.precio || 0,
        cobertura: e.cobertura || 0,
        subtotal: e.precio || 0
      })) || [];

      const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
      const cobertura = items.reduce((sum, i) => sum + (i.cobertura || 0), 0);
      const total = subtotal - cobertura;

      await api.createFactura({
        paciente: citaSeleccionada.paciente?._id || citaSeleccionada.paciente,
        cita: citaSeleccionada._id,
        items, subtotal, cobertura, total,
        montoPagado: total, metodoPago: 'efectivo', estado: 'pagada'
      });

      setShowModalNueva(false);
      setCitaSeleccionada(null);
      fetchFacturas();
      fetchCitasPendientes();
      fetchResumenFiscal();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const registrarPago = async () => {
    if (!showModalPago || !montoPago) return;
    const monto = parseFloat(montoPago);
    if (isNaN(monto) || monto <= 0) { alert('Ingrese un monto válido'); return; }

    try {
      setLoading(true);
      await api.pagarFactura(showModalPago._id || showModalPago.id, monto, metodoPago);
      setShowModalPago(null);
      setMontoPago('');
      setMetodoPago('efectivo');
      fetchFacturas();
      fetchResumenFiscal();
    } catch (err) {
      alert('Error al registrar pago: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calcularTotalHoy = () => {
    if (!turnoActivo) return 0;
    const inicioTurno = new Date(turnoActivo.fechaInicio).getTime();
    return facturas
      .filter(f => {
        if (f.estado === 'anulada') return false;
        const fTime = new Date(f.fecha_factura || f.createdAt).getTime();
        return fTime >= inicioTurno;
      })
      .reduce((sum, f) => sum + (f.total || 0), 0);
  };

  const exportarExcel = async () => {
    const XLSX = await loadXLSX();
    const data = facturas.map(f => ({
      'Número': f.numero || f._id,
      'Paciente': `${f.paciente?.nombre || ''} ${f.paciente?.apellido || ''}`.trim(),
      'Cédula': f.paciente?.cedula || '',
      'Fecha': new Date(f.fecha_factura || f.createdAt).toLocaleDateString('es-DO'),
      'Estado': f.estado || '',
      'Total': f.total || 0,
      'Pagado': f.montoPagado || 0,
      'Pendiente': Math.max(0, (f.total || 0) - (f.montoPagado || 0)),
      'Método': f.metodoPago || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    XLSX.writeFile(wb, `Facturas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <FaSpinner className="spin" style={{ fontSize: 32, color: '#2563eb' }} />
      <p style={{ color: theme.textMuted, fontWeight: 500 }}>Sincronizando caja fiscal...</p>
    </div>
  );

  if (facturaImprimir) {
    return (
      <FacturaTermica
        factura={facturaImprimir.factura}
        paciente={facturaImprimir.paciente}
        estudios={facturaImprimir.estudios}
        onClose={() => setFacturaImprimir(null)}
      />
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 44, flexWrap: 'wrap', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(37, 99, 235, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <FaFileInvoiceDollar size={20} />
            </div>
            Gestión Fiscal
          </h1>
          <p style={{ margin: '8px 0 0', color: theme.textMuted, fontSize: 16, fontWeight: 500 }}>Control de ingresos y comprobantes autorizados</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={exportarExcel}
            style={{
              padding: '14px 20px', borderRadius: 10,
              background: '#10b981', color: 'white',
              border: 'none', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
            }}
          >
            <FaFileExcel /> EXPORTAR EXCEL
          </button>
          <button
            onClick={() => setShowModalNueva(true)}
            style={{
              padding: '14px 24px', borderRadius: 10,
              background: '#2563eb', color: 'white',
              border: 'none', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
          >
            <FaPlus /> FACTURACIÓN RÁPIDA
          </button>
        </div>
      </div>

      {/* ── Stat Tiles ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Card 1 */}
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-xl flex justify-between" data-purpose="stat-card">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-2">Caja de Hoy</span>
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-4">RD$ {calcularTotalHoy().toLocaleString()}</div>
            <span style={{ cursor: 'pointer' }} onClick={turnoActivo ? cerrarTurnoManual : abrirTurnoManual} className={`${turnoActivo ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'} text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest`}>
              {turnoActivo ? 'ACTIVA (Cerrar)' : 'CERRADA (Abrir)'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center border border-slate-300 dark:border-slate-700">
            <FaMoneyBillWave className="text-slate-400 w-6 h-6" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white dark:bg-[#1a2235] rounded-2xl p-8 border border-slate-200 dark:border-slate-800/50 shadow-xl flex justify-between" data-purpose="stat-card">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-2">Operaciones del Mes</span>
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-4">RD$ {(resumenFiscal?.mes?.totalFacturado || 0).toLocaleString()}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center border border-slate-300 dark:border-slate-700">
            <FaChartLine className="text-emerald-500 w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Tabla de Historial ── */}
      <section className="bg-white dark:bg-[#1a2235] rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-2xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">Registros Emitidos</h4>
          <div className="flex items-center">
            <label className="text-xs text-slate-600 dark:text-slate-400 mr-2">Estados:</label>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-gray-900 dark:text-white focus:ring-[#00e1ff] px-2 py-1 outline-none">
              <option value="">Todos</option>
              <option value="pagada">Pagadas</option>
              <option value="emitida">Pendientes</option>
              <option value="anulada">Anuladas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100 dark:bg-slate-900/40 text-[10px] uppercase tracking-widest text-slate-600 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800/50">
              <tr>
                <th className="px-8 py-4">Comprobante</th>
                <th className="px-4 py-4">Fecha</th>
                <th className="px-4 py-4">Paciente</th>
                <th className="px-4 py-4 text-right">Total RD$</th>
                <th className="px-4 py-4 text-right">Pagado</th>
                <th className="px-4 py-4 text-right">Pendiente</th>
                <th className="px-4 py-4">Estado</th>
                <th className="px-8 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30">
              {facturas.length === 0 ? (
                <tr><td colSpan="8" className="px-8 py-10 text-center text-slate-500 text-sm">Sin transacciones registradas</td></tr>
              ) : (
                facturas.map(f => {
                  const pendiente = Math.max(0, (f.total || 0) - (f.montoPagado || 0));
                  const tienePendiente = pendiente > 0 && f.estado !== 'anulada';
                  return (
                    <tr key={f._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-8 py-4 font-mono text-xs text-gray-900 dark:text-white">#{f.numero || f.numero_factura}</td>
                      <td className="px-4 py-4 text-xs text-slate-700 dark:text-slate-300">{new Date(f.fecha_factura || f.createdAt).toLocaleDateString('es-DO')}</td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-800 dark:text-slate-200">{f.datosCliente?.nombre || f.paciente?.nombre || 'Paciente'}</td>
                      <td className="px-4 py-4 text-xs font-bold text-gray-900 dark:text-white text-right">${(f.total || 0).toLocaleString()}</td>
                      <td className="px-4 py-4 text-xs text-emerald-400 font-semibold text-right">${(f.montoPagado || 0).toLocaleString()}</td>
                      <td className={`px-4 py-4 text-xs ${tienePendiente ? 'text-red-400 font-bold' : 'text-slate-500'} text-right`}>
                        {tienePendiente ? `$${pendiente.toLocaleString()}` : '$0'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`${
                          f.estado === 'pagada' ? 'bg-emerald-500/20 text-emerald-400' :
                          (f.estado === 'anulada' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500')
                        } text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>
                          {f.estado === 'emitida' && tienePendiente ? 'Pendiente' : f.estado}
                        </span>
                      </td>
                      <td className="px-8 py-4 flex justify-center gap-2">
                        <button onClick={() => verDetalle(f)} className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                          <FaEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => imprimirFactura(f)} className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 text-[#2563eb] transition-colors">
                          <FaPrint className="w-4 h-4" />
                        </button>
                        {tienePendiente && (
                          <button onClick={() => { setShowModalPago(f); setMontoPago(pendiente.toString()); }} className="p-2 bg-emerald-900/30 hover:bg-emerald-800/50 rounded-lg border border-emerald-800/50 text-emerald-400 transition-colors" title="Registrar pago">
                            <FaMoneyBillWave className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Modales ── */}
      {facturaDetalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 500, padding: 32 }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: theme.textStrong }}>Comprobante #{facturaDetalle.numero || facturaDetalle.numero_factura}</h3>
            <div style={{ background: theme.surfaceMuted, padding: 20, borderRadius: 10, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ color: theme.textMuted }}>Subtotal</span><span style={{ color: theme.text }}>{(facturaDetalle.subtotal || 0).toLocaleString() ? `$${(facturaDetalle.subtotal || 0).toLocaleString()}` : '$0'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ color: '#ef4444' }}>Cobertura</span><span style={{ color: '#ef4444' }}>-${(facturaDetalle.cobertura || facturaDetalle.descuento || 0).toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.border}`, paddingTop: 10, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: theme.text }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: theme.textStrong }}>${(facturaDetalle.total || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ color: '#10b981' }}>Monto Pagado</span><span style={{ color: '#10b981', fontWeight: 700 }}>${(facturaDetalle.montoPagado || 0).toLocaleString()}</span></div>
              {Math.max(0, (facturaDetalle.total || 0) - (facturaDetalle.montoPagado || 0)) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
                  <span style={{ fontWeight: 800, color: '#ef4444' }}>PENDIENTE</span>
                  <span style={{ fontWeight: 900, color: '#ef4444', fontSize: 22 }}>${Math.max(0, (facturaDetalle.total || 0) - (facturaDetalle.montoPagado || 0)).toLocaleString()}</span>
                </div>
              )}
              {Math.max(0, (facturaDetalle.total || 0) - (facturaDetalle.montoPagado || 0)) <= 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.border}`, paddingTop: 15 }}>
                  <span style={{ fontWeight: 800, color: theme.text }}>PAGADO COMPLETO</span>
                  <span style={{ fontWeight: 900, color: '#10b981', fontSize: 22 }}>✓</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setFacturaDetalle(null); imprimirFactura(facturaDetalle); }} style={{ flex: 1, padding: 12, borderRadius: 8, background: '#2563eb', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>REIMPRIMIR</button>
              <button onClick={() => setFacturaDetalle(null)} style={{ padding: 12, borderRadius: 8, background: theme.surfaceMuted, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, cursor: 'pointer' }}>CERRAR</button>
            </div>
          </div>
        </div>
      )}

      {showModalNueva && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 500, padding: 32 }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: theme.textStrong }}>Admisiones Pendientes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 350, overflowY: 'auto', marginBottom: 24 }}>
              {citasPendientes.map(cita => (
                <div key={cita._id} onClick={() => setCitaSeleccionada(cita)} style={{
                  padding: 16, borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${citaSeleccionada?._id === cita._id ? '#2563eb' : theme.border}`,
                  background: citaSeleccionada?._id === cita._id ? theme.panel : theme.surface
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontSize: 14, color: theme.textStrong }}>{cita.paciente?.nombre} {cita.paciente?.apellido}</strong>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>${cita.total?.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>ESTUDIOS: {cita.estudios?.length || 0}</div>
                </div>
              ))}
              {citasPendientes.length === 0 && <p style={{ textAlign: 'center', color: theme.textMuted }}>No hay registros por cobrar</p>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={crearFactura} disabled={!citaSeleccionada} style={{ flex: 1, padding: 14, borderRadius: 8, background: '#2563eb', color: 'white', border: 'none', fontWeight: 700, cursor: citaSeleccionada ? 'pointer' : 'not-allowed', opacity: citaSeleccionada ? 1 : 0.5 }}>COBRAR SERVICIOS</button>
              <button onClick={() => setShowModalNueva(false)} style={{ padding: 14, borderRadius: 8, background: theme.surfaceMuted, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, cursor: 'pointer' }}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {showModalPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: theme.textStrong }}>Registrar Pago</h3>
            <p style={{ margin: '0 0 20px', color: theme.textMuted, fontSize: 14 }}>Factura #{showModalPago.numero || showModalPago.numero_factura}</p>

            <div style={{ background: theme.surfaceMuted, padding: 16, borderRadius: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: theme.textMuted }}>Total factura</span>
                <span style={{ fontWeight: 700, color: theme.text }}>${(showModalPago.total || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#10b981' }}>Ya pagado</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>${(showModalPago.montoPagado || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
                <span style={{ fontWeight: 800, color: '#ef4444' }}>Pendiente</span>
                <span style={{ fontWeight: 800, color: '#ef4444' }}>${Math.max(0, (showModalPago.total || 0) - (showModalPago.montoPagado || 0)).toLocaleString()}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Monto a pagar (RD$)</label>
              <input
                type="number"
                value={montoPago}
                onChange={e => setMontoPago(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `2px solid ${theme.border}`, fontSize: 16, fontWeight: 700, boxSizing: 'border-box', background: theme.surface, color: theme.textStrong }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Método de pago</label>
              <select
                value={metodoPago}
                onChange={e => setMetodoPago(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `2px solid ${theme.border}`, fontSize: 14, boxSizing: 'border-box', background: theme.surface, color: theme.text }}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={registrarPago} style={{ flex: 1, padding: 14, borderRadius: 8, background: '#10b981', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <FaMoneyBillWave />REGISTRAR PAGO
              </button>
              <button onClick={() => { setShowModalPago(null); setMontoPago(''); }} style={{ padding: 14, borderRadius: 8, background: theme.surfaceMuted, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 700, cursor: 'pointer' }}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Facturas;
