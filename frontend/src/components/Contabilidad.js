import React, { useState, useEffect, useCallback } from 'react';
import {
    FaChartLine, FaArrowUp, FaArrowDown, FaPlus, FaTrash,
    FaSpinner, FaExclamationTriangle, FaSyncAlt, FaSearch,
    FaMoneyBillWave, FaBalanceScale, FaCalendarAlt, FaFilter, FaFileExcel
} from 'react-icons/fa';
import api from '../services/api';
import { loadXLSX } from '../utils/loadXlsx';
import useDebounce from '../hooks/useDebounce';

const theme = {
    surface: 'var(--legacy-surface)',
    surfaceMuted: 'var(--legacy-surface-muted)',
    panel: 'var(--legacy-surface-panel)',
    border: 'var(--legacy-border)',
    text: 'var(--legacy-text)',
    textStrong: 'var(--legacy-text-strong)',
    textMuted: 'var(--legacy-text-muted)'
};

const CATEGORIAS_INGRESO = [
    { value: 'consultas', label: 'Consultas' },
    { value: 'laboratorio', label: 'Laboratorio' },
    { value: 'imagenologia', label: 'Imagenología' },
    { value: 'farmacia', label: 'Farmacia' },
    { value: 'otros_ingresos', label: 'Otros Ingresos' }
];

const CATEGORIAS_EGRESO = [
    { value: 'nomina', label: 'Nómina' },
    { value: 'alquiler', label: 'Alquiler' },
    { value: 'servicios', label: 'Servicios (Luz, Agua, Internet)' },
    { value: 'suministros', label: 'Suministros Médicos' },
    { value: 'equipos', label: 'Equipos' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
    { value: 'impuestos', label: 'Impuestos' },
    { value: 'otros_gastos', label: 'Otros Gastos' }
];

const Contabilidad = () => {
    const [resumen, setResumen] = useState(null);
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [facturasRecientes, setFacturasRecientes] = useState([]);
    const [facturacionDia, setFacturacionDia] = useState(null);
    const debouncedBusqueda = useDebounce(busqueda, 350);
    const [formData, setFormData] = useState({
        tipo: 'ingreso',
        categoria: 'consultas',
        descripcion: '',
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo',
        referencia: '',
        notas: ''
    });

    const cargarDatos = useCallback(async (searchOverride = debouncedBusqueda.trim()) => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            const searchTerm = String(searchOverride || '').trim();
            if (filtroTipo) params.tipo = filtroTipo;
            if (filtroCategoria) params.categoria = filtroCategoria;
            if (searchTerm) params.search = searchTerm;

            const [resumenRes, movimientosRes, facturasRes, facDiaRes] = await Promise.all([
                api.getResumenContable(),
                api.getMovimientosContables(params),
                api.getFacturas({}).catch(() => []),
                fetch('/api/contabilidad/facturacion-dia', { headers: api.getHeaders() })
                    .then(r => r.json()).then(d => d.data || null).catch(() => null)
            ]);

            setResumen(resumenRes);
            setMovimientos(Array.isArray(movimientosRes) ? movimientosRes : []);
            const facturas = Array.isArray(facturasRes) ? facturasRes : [];
            setFacturasRecientes(facturas.slice(0, 10));
            setFacturacionDia(facDiaRes);
        } catch (err) {
            console.error('Error cargando contabilidad:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filtroTipo, filtroCategoria, debouncedBusqueda]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createMovimientoContable({
                ...formData,
                monto: parseFloat(formData.monto)
            });
            setShowForm(false);
            setFormData({
                tipo: 'ingreso',
                categoria: 'consultas',
                descripcion: '',
                monto: '',
                fecha: new Date().toISOString().split('T')[0],
                metodoPago: 'efectivo',
                referencia: '',
                notas: ''
            });
            cargarDatos();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este movimiento?')) return;
        try {
            await api.deleteMovimientoContable(id);
            cargarDatos();
        } catch (err) {
            setError(err.message);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount || 0);
    };

    const getCategoriaLabel = (cat) => {
        const all = [...CATEGORIAS_INGRESO, ...CATEGORIAS_EGRESO];
        return all.find(c => c.value === cat)?.label || cat;
    };

    const exportarExcel = async () => {
        const XLSX = await loadXLSX();
        const data = movimientos.map(m => ({
            'Fecha': new Date(m.fecha).toLocaleDateString('es-DO'),
            'Tipo': m.tipo,
            'Categoría': getCategoriaLabel(m.categoria),
            'Descripción': m.descripcion,
            'Método': m.metodoPago || '',
            'Monto': m.tipo === 'ingreso' ? (m.monto || 0) : -(m.monto || 0),
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contabilidad');
        XLSX.writeFile(wb, `Contabilidad_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (loading && !resumen) {
        return (
            <div style={styles.loadingContainer}>
                <FaSpinner className="spin" style={{ fontSize: 40, color: '#3282b8' }} />
                <p style={{ marginTop: 15, color: theme.textMuted }}>Cargando contabilidad...</p>
            </div>
        );
    }

    if (error && !resumen) {
        return (
            <div style={styles.errorContainer}>
                <FaExclamationTriangle style={{ fontSize: 40, color: '#e74c3c' }} />
                <p style={{ margin: '15px 0', color: theme.textMuted }}>{error}</p>
                <button onClick={cargarDatos} style={styles.retryButton}>
                    <FaSyncAlt style={{ marginRight: 8 }} /> Reintentar
                </button>
            </div>
        );
    }

    const categorias = formData.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

    return (
        <div>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h2 style={{ margin: 0, color: '#1b262c' }}>
                        <FaBalanceScale style={{ marginRight: 10, color: '#3282b8' }} />
                        Contabilidad
                    </h2>
                    <p style={{ margin: '5px 0 0', color: theme.textMuted }}>Control financiero del negocio</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={exportarExcel} style={{ ...styles.btnPrimary, background: '#10b981' }}>
                        <FaFileExcel style={{ marginRight: 8 }} /> Exportar Excel
                    </button>
                    <button onClick={() => setShowForm(!showForm)} style={styles.btnPrimary}>
                        <FaPlus style={{ marginRight: 8 }} />
                        Nuevo Movimiento
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {/* Tarjetas de facturación real del día (conectadas a facturas) */}
            {facturacionDia && (
                <div style={{ background: '#fff3cd', borderRadius: 12, padding: 20, marginBottom: 25, border: '1px solid #ffc107' }}>
                    <h4 style={{ margin: '0 0 15px', color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
                        📊 Facturación Real del Día (datos de facturas)
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15 }}>
                        <div style={{ textAlign: 'center', background: theme.surface, padding: 15, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#27ae60' }}>RD$ {(facturacionDia.hoy?.totalFacturado || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: theme.textMuted }}>Total Facturado Hoy</div>
                        </div>
                        <div style={{ textAlign: 'center', background: theme.surface, padding: 15, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#3498db' }}>RD$ {(facturacionDia.hoy?.totalCobrado || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: theme.textMuted }}>Cobrado Hoy</div>
                        </div>
                        <div style={{ textAlign: 'center', background: theme.surface, padding: 15, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#9b59b6' }}>{facturacionDia.hoy?.cantidad || 0}</div>
                            <div style={{ fontSize: 12, color: theme.textMuted }}>Facturas Emitidas</div>
                        </div>
                        <div style={{ textAlign: 'center', background: theme.surface, padding: 15, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#8e44ad' }}>RD$ {(facturacionDia.mes?.totalFacturado || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: theme.textMuted }}>Facturado Mes</div>
                        </div>
                        <div style={{ textAlign: 'center', background: theme.surface, padding: 15, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#e67e22' }}>RD$ {(facturacionDia.mes?.totalCobrado || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: theme.textMuted }}>Cobrado Mes</div>
                        </div>
                    </div>
                    {facturacionDia.ultimasFacturas && facturacionDia.ultimasFacturas.length > 0 && (
                        <div style={{ marginTop: 15 }}>
                            <h5 style={{ margin: '0 0 10px', color: '#856404' }}>Últimas facturas del día:</h5>
                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                {facturacionDia.ultimasFacturas.map(f => (
                                    <div key={f._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #ffc10733', fontSize: 13 }}>
                                        <span><strong>{f.numero}</strong> · {f.datosCliente?.nombre || 'Paciente'}</span>
                                        <span style={{ fontWeight: 'bold', color: f.pagado ? '#27ae60' : '#e74c3c' }}>
                                            RD$ {(f.total || 0).toLocaleString()} {f.pagado ? '✓' : '⏳'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary Cards */}
            {resumen && (
                <div style={styles.cardsGrid}>
                    <div style={{ ...styles.card, background: 'linear-gradient(135deg, #2ecc71, #27ae60)' }}>
                        <div style={styles.cardContent}>
                            <FaArrowUp style={{ fontSize: 30, opacity: 0.8 }} />
                            <div>
                                <p style={styles.cardLabel}>Ingresos del Mes</p>
                                <h3 style={styles.cardValue}>{formatMoney(resumen.mes?.ingresos)}</h3>
                            </div>
                        </div>
                    </div>
                    <div style={{ ...styles.card, background: 'linear-gradient(135deg, #e74c3c, #c0392b)' }}>
                        <div style={styles.cardContent}>
                            <FaArrowDown style={{ fontSize: 30, opacity: 0.8 }} />
                            <div>
                                <p style={styles.cardLabel}>Egresos del Mes</p>
                                <h3 style={styles.cardValue}>{formatMoney(resumen.mes?.egresos)}</h3>
                            </div>
                        </div>
                    </div>
                    <div style={{ ...styles.card, background: resumen.mes?.balance >= 0 ? 'linear-gradient(135deg, #3498db, #2980b9)' : 'linear-gradient(135deg, #e67e22, #d35400)' }}>
                        <div style={styles.cardContent}>
                            <FaBalanceScale style={{ fontSize: 30, opacity: 0.8 }} />
                            <div>
                                <p style={styles.cardLabel}>Balance del Mes</p>
                                <h3 style={styles.cardValue}>{formatMoney(resumen.mes?.balance)}</h3>
                            </div>
                        </div>
                    </div>
                    <div style={{ ...styles.card, background: 'linear-gradient(135deg, #9b59b6, #8e44ad)' }}>
                        <div style={styles.cardContent}>
                            <FaMoneyBillWave style={{ fontSize: 30, opacity: 0.8 }} />
                            <div>
                                <p style={styles.cardLabel}>Cobrado del Mes</p>
                                <h3 style={styles.cardValue}>{formatMoney(resumen.facturacion?.totalCobrado)}</h3>
                                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.88 }}>
                                    Facturado: {formatMoney(resumen.facturacion?.totalFacturado)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Today/Year Summary */}
            {resumen && (
                <div style={styles.summaryRow}>
                    <div style={styles.summaryCard}>
                        <h4 style={styles.summaryTitle}>
                            <FaCalendarAlt style={{ marginRight: 8, color: '#3282b8' }} /> Hoy
                        </h4>
                        <div style={styles.summaryGrid}>
                            <div>
                                <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Ingresos:</span>
                                <span style={{ marginLeft: 8 }}>{formatMoney(resumen.hoy?.ingresos)}</span>
                            </div>
                            <div>
                                <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Egresos:</span>
                                <span style={{ marginLeft: 8 }}>{formatMoney(resumen.hoy?.egresos)}</span>
                            </div>
                            <div>
                                <span style={{ color: '#3498db', fontWeight: 'bold' }}>Balance:</span>
                                <span style={{ marginLeft: 8 }}>{formatMoney(resumen.hoy?.balance)}</span>
                            </div>
                        </div>
                    </div>
                    <div style={styles.summaryCard}>
                        <h4 style={styles.summaryTitle}>
                            <FaChartLine style={{ marginRight: 8, color: '#3282b8' }} /> Acumulado Anual
                        </h4>
                        <div style={styles.summaryGrid}>
                            <div>
                                <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Ingresos:</span>
                                <span style={{ marginLeft: 8 }}>{formatMoney(resumen.anio?.ingresos)}</span>
                            </div>
                            <div>
                                <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Egresos:</span>
                                <span style={{ marginLeft: 8 }}>{formatMoney(resumen.anio?.egresos)}</span>
                            </div>
                            <div>
                                <span style={{ color: '#3498db', fontWeight: 'bold' }}>Balance:</span>
                                <span style={{ marginLeft: 8 }}>{formatMoney(resumen.anio?.balance)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Facturación Reciente - Connected from billing */}
            {facturasRecientes.length > 0 && (
                <div style={styles.formContainer}>
                    <h3 style={{ margin: '0 0 15px', color: '#1b262c' }}>
                        <FaMoneyBillWave style={{ marginRight: 8, color: '#27ae60' }} />
                        Facturación Reciente
                    </h3>
                    <div style={styles.tableContainer}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Factura</th>
                                    <th style={styles.th}>Fecha</th>
                                    <th style={styles.th}>Paciente</th>
                                    <th style={styles.th}>Total</th>
                                    <th style={styles.th}>Pagado</th>
                                    <th style={styles.th}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {facturasRecientes.map(f => (
                                    <tr key={f._id || f.id} style={styles.tr}>
                                        <td style={styles.td}>{f.numero || f.numero_factura}</td>
                                        <td style={styles.td}>
                                            {new Date(f.fecha_factura || f.createdAt).toLocaleDateString('es-DO')}
                                        </td>
                                        <td style={styles.td}>
                                            {f.datosCliente?.nombre || f.paciente?.nombre || 'N/A'}
                                        </td>
                                        <td style={{ ...styles.td, fontWeight: 'bold' }}>
                                            {formatMoney(f.total)}
                                        </td>
                                        <td style={{ ...styles.td, color: f.montoPagado >= f.total ? '#27ae60' : '#e74c3c' }}>
                                            {formatMoney(f.montoPagado || 0)}
                                        </td>
                                        <td style={styles.td}>
                                            <span style={{
                                                ...styles.badge,
                                                background: f.estado === 'pagada' ? '#d4edda' : f.estado === 'emitida' ? '#fff3cd' : '#f8d7da',
                                                color: f.estado === 'pagada' ? '#155724' : f.estado === 'emitida' ? '#856404' : '#721c24'
                                            }}>
                                                {f.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* New Movement Form */}
            {showForm && (
                <div style={styles.formContainer}>
                    <h3 style={{ margin: '0 0 20px', color: '#1b262c' }}>Registrar Movimiento</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={styles.formGrid}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Tipo</label>
                                <select
                                    value={formData.tipo}
                                    onChange={(e) => {
                                        const tipo = e.target.value;
                                        setFormData({
                                            ...formData,
                                            tipo,
                                            categoria: tipo === 'ingreso' ? 'consultas' : 'nomina'
                                        });
                                    }}
                                    style={styles.input}
                                >
                                    <option value="ingreso">Ingreso</option>
                                    <option value="egreso">Egreso</option>
                                </select>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Categoría</label>
                                <select
                                    value={formData.categoria}
                                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                                    style={styles.input}
                                >
                                    {categorias.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Descripción *</label>
                                <input
                                    type="text"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    style={styles.input}
                                    required
                                    placeholder="Descripción del movimiento"
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Monto (RD$) *</label>
                                <input
                                    type="number"
                                    value={formData.monto}
                                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                                    style={styles.input}
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Fecha</label>
                                <input
                                    type="date"
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                    style={styles.input}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Método de Pago</label>
                                <select
                                    value={formData.metodoPago}
                                    onChange={(e) => setFormData({ ...formData, metodoPago: e.target.value })}
                                    style={styles.input}
                                >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Referencia</label>
                                <input
                                    type="text"
                                    value={formData.referencia}
                                    onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                                    style={styles.input}
                                    placeholder="No. factura, recibo, etc."
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Notas</label>
                                <input
                                    type="text"
                                    value={formData.notas}
                                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                                    style={styles.input}
                                    placeholder="Notas adicionales"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            <button type="submit" style={styles.btnPrimary}>Guardar</button>
                            <button type="button" onClick={() => setShowForm(false)} style={styles.btnSecondary}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filters */}
            <div style={styles.filterBar}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FaFilter style={{ color: theme.textMuted }} />
                    <select
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                        style={styles.filterSelect}
                    >
                        <option value="">Todos los tipos</option>
                        <option value="ingreso">Ingresos</option>
                        <option value="egreso">Egresos</option>
                    </select>
                    <select
                        value={filtroCategoria}
                        onChange={(e) => setFiltroCategoria(e.target.value)}
                        style={styles.filterSelect}
                    >
                        <option value="">Todas las categorías</option>
                        {[...CATEGORIAS_INGRESO, ...CATEGORIAS_EGRESO].map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                    <div style={styles.searchBox}>
                        <FaSearch style={{ color: theme.textMuted, marginRight: 8 }} />
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar..."
                            style={styles.searchInput}
                        />
                    </div>
                </div>
            </div>

            {/* Movements Table */}
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Fecha</th>
                            <th style={styles.th}>Tipo</th>
                            <th style={styles.th}>Categoría</th>
                            <th style={styles.th}>Descripción</th>
                            <th style={styles.th}>Método</th>
                            <th style={styles.th}>Monto</th>
                            <th style={styles.th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movimientos.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ ...styles.td, textAlign: 'center', color: theme.textMuted, padding: 40 }}>
                                    No hay movimientos registrados
                                </td>
                            </tr>
                        ) : (
                            movimientos.map(mov => (
                                <tr key={mov._id} style={styles.tr} className="hover-row">
                                    <td style={styles.td}>
                                        {new Date(mov.fecha).toLocaleDateString('es-DO')}
                                    </td>
                                    <td style={styles.td}>
                                        <span style={{
                                            ...styles.badge,
                                            background: mov.tipo === 'ingreso' ? '#d4edda' : '#f8d7da',
                                            color: mov.tipo === 'ingreso' ? '#155724' : '#721c24'
                                        }}>
                                            {mov.tipo === 'ingreso' ? '▲' : '▼'} {mov.tipo}
                                        </span>
                                    </td>
                                    <td style={styles.td}>{getCategoriaLabel(mov.categoria)}</td>
                                    <td style={styles.td}>{mov.descripcion}</td>
                                    <td style={styles.td}>{mov.metodoPago}</td>
                                    <td style={{
                                        ...styles.td,
                                        fontWeight: 'bold',
                                        color: mov.tipo === 'ingreso' ? '#27ae60' : '#e74c3c'
                                    }}>
                                        {mov.tipo === 'ingreso' ? '+' : '-'}{formatMoney(mov.monto)}
                                    </td>
                                    <td style={styles.td}>
                                        <button
                                            onClick={() => handleDelete(mov._id)}
                                            style={styles.btnDanger}
                                            title="Eliminar"
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const styles = {
    loadingContainer: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '60vh'
    },
    errorContainer: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '60vh'
    },
    retryButton: {
        padding: '10px 20px', background: '#3282b8', color: 'white',
        border: 'none', borderRadius: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 25, flexWrap: 'wrap', gap: 15
    },
    btnPrimary: {
        padding: '10px 20px', background: '#3282b8', color: 'white',
        border: 'none', borderRadius: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 'bold'
    },
    btnSecondary: {
        padding: '10px 20px', background: '#6c757d', color: 'white',
        border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14
    },
    btnDanger: {
        padding: '6px 10px', background: '#e74c3c', color: 'white',
        border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12
    },
    cardsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 20, marginBottom: 25
    },
    card: {
        borderRadius: 12, padding: 20, color: 'white',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    cardContent: {
        display: 'flex', alignItems: 'center', gap: 15
    },
    cardLabel: {
        margin: 0, fontSize: 13, opacity: 0.9
    },
    cardValue: {
        margin: '5px 0 0', fontSize: 22
    },
    summaryRow: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 20, marginBottom: 25
    },
    summaryCard: {
        background: 'var(--legacy-surface)', borderRadius: 12, padding: 20, border: '1px solid var(--legacy-border)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
    },
    summaryTitle: {
        margin: '0 0 15px', color: 'var(--legacy-text-strong)', fontSize: 16
    },
    summaryGrid: {
        display: 'flex', flexDirection: 'column', gap: 8
    },
    formContainer: {
        background: 'var(--legacy-surface)', borderRadius: 12, padding: 25, marginBottom: 25,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '2px solid #3282b8'
    },
    formGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 15
    },
    formGroup: {
        display: 'flex', flexDirection: 'column'
    },
    label: {
        fontSize: 13, fontWeight: 'bold', color: 'var(--legacy-text)', marginBottom: 5
    },
    input: {
        padding: '8px 12px', border: '1px solid var(--legacy-border)', borderRadius: 6,
        background: 'var(--legacy-surface)', color: 'var(--legacy-text)', fontSize: 14, outline: 'none'
    },
    filterBar: {
        background: 'var(--legacy-surface)', borderRadius: 12, padding: 15, marginBottom: 20, border: '1px solid var(--legacy-border)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
    },
    filterSelect: {
        padding: '8px 12px', border: '1px solid var(--legacy-border)', borderRadius: 6,
        fontSize: 13, outline: 'none', background: 'var(--legacy-surface)', color: 'var(--legacy-text)'
    },
    searchBox: {
        display: 'flex', alignItems: 'center', border: '1px solid var(--legacy-border)',
        borderRadius: 6, padding: '0 10px', background: 'var(--legacy-surface)'
    },
    searchInput: {
        border: 'none', outline: 'none', padding: '8px 0', fontSize: 13, width: 150, background: 'transparent', color: 'var(--legacy-text)'
    },
    tableContainer: {
        background: 'var(--legacy-surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--legacy-border)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
    },
    table: {
        width: '100%', borderCollapse: 'collapse'
    },
    th: {
        background: 'var(--legacy-surface-muted)', padding: '12px 15px', textAlign: 'left',
        fontSize: 13, fontWeight: 'bold', color: 'var(--legacy-text-muted)', borderBottom: '2px solid var(--legacy-border)'
    },
    td: {
        padding: '12px 15px', borderBottom: '1px solid var(--legacy-border-soft)', fontSize: 14, color: 'var(--legacy-text)'
    },
    tr: {
        transition: 'background 0.2s'
    },
    badge: {
        padding: '4px 10px', borderRadius: 15, fontSize: 12,
        fontWeight: 'bold', textTransform: 'capitalize'
    }
};

export default Contabilidad;
