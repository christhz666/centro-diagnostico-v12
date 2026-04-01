import React, { useEffect, useState } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';

const PAPER_WIDTH_PX = 286;

const FacturaTermica = ({ factura, paciente, estudios, onClose }) => {
  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const [empresaConfig, setEmpresaConfig] = useState({});
  const [logoSrc, setLogoSrc] = useState('/logo-centro.png');

  useEffect(() => {
    fetch('/api/configuracion/empresa')
      .then(res => res.json())
      .then(data => setEmpresaConfig(data || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLogoSrc(empresaConfig.logo_factura || empresaConfig.logo || '/logo-centro.png');
  }, [empresaConfig.logo_factura, empresaConfig.logo]);

  useEffect(() => {
    if (!factura || !paciente) {
      console.error('Datos incompletos:', { factura, paciente, estudios });
    }
  }, [factura, paciente, estudios]);

  const getTexto = (valor) => {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number') return valor.toString();
    if (typeof valor === 'object') return valor.nombre || valor.tipo || valor.descripcion || '';
    return String(valor);
  };

  if (!factura || !paciente) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--legacy-surface-muted)',
          color: 'var(--legacy-text)'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--legacy-surface)',
            border: '1px solid var(--legacy-border)',
            borderRadius: 16,
            padding: 24,
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--legacy-text-strong)', marginBottom: 10 }}>
            Error: datos incompletos para generar la factura
          </div>
          <button
            onClick={onClose}
            style={{
              marginTop: 12,
              padding: '12px 22px',
              background: 'var(--legacy-surface-muted)',
              color: 'var(--legacy-text)',
              border: '1px solid var(--legacy-border)',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const estudiosArray = Array.isArray(estudios) ? estudios : [];
  const subtotal = estudiosArray.reduce((sum, e) => sum + (e.precio || e.precioUnitario || 0), 0);
  const cobertura = estudiosArray.reduce((sum, e) => sum + (e.cobertura || 0), 0);
  const totalPagar = subtotal - cobertura;
  const montoPagado = factura?.montoPagado || factura?.monto_pagado || 0;
  const pendiente = Math.max(0, totalPagar - montoPagado);
  const cambio = montoPagado > totalPagar ? montoPagado - totalPagar : 0;

  const numeroFactura = factura?.numero || factura?.numero_factura || `F-${Date.now().toString().slice(-8)}`;
  const fechaFactura = new Date(factura?.fecha_factura || factura?.createdAt || Date.now());
  const empresaNombre = empresaConfig.empresa_nombre || empresaConfig.nombre || 'Centro Diagnostico';
  const empresaDireccion = empresaConfig.empresa_direccion || 'Sin direccion configurada';
  const empresaTelefono = empresaConfig.empresa_telefono || '';
  const empresaEmail = empresaConfig.empresa_email || '';
  const cajero = getTexto(usuario?.nombre || usuario?.username || usuario?.email) || 'Sistema';
  const barcodeValue = factura?.codigoBarras || factura?.registroIdNumerico || numeroFactura;

  const getSeguroNombre = () => {
    if (!paciente?.seguro) return 'Sin seguro';
    if (typeof paciente.seguro === 'string') return paciente.seguro || 'Sin seguro';
    if (typeof paciente.seguro === 'object') return paciente.seguro.nombre || 'Sin seguro';
    return 'Sin seguro';
  };

  const getSeguroAfiliado = () => {
    if (!paciente?.seguro) return 'N/A';
    if (typeof paciente.seguro === 'object') {
      return paciente.seguro.numeroAfiliado || paciente.seguro.numeroPoliza || 'N/A';
    }
    return 'N/A';
  };

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return '';
    try {
      const hoy = new Date();
      const nacimiento = new Date(fechaNac);
      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      const mes = hoy.getMonth() - nacimiento.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
      return `${edad} años`;
    } catch {
      return '';
    }
  };

  const getSexo = () => {
    const sexo = paciente?.sexo || paciente?.genero || '';
    if (sexo === 'M' || sexo === 'masculino' || sexo === 'Masculino') return 'Masculino';
    if (sexo === 'F' || sexo === 'femenino' || sexo === 'Femenino') return 'Femenino';
    return sexo || '';
  };

  const getCedulaDisplay = () => {
    const cedula = getTexto(paciente?.cedula).trim();

    if (paciente?.esMenor || /^MENOR-/i.test(cedula) || /^MENOR(?:\s+DE\s+EDAD)?$/i.test(cedula)) {
      return 'MENOR';
    }

    return cedula || 'N/A';
  };

  const edad = calcularEdad(paciente?.fechaNacimiento || paciente?.fecha_nacimiento);
  const sexo = getSexo();
  const nacionalidad = paciente?.nacionalidad || 'Dominicano';
  const nombreCompleto = `${getTexto(paciente?.nombre)} ${getTexto(paciente?.apellido)}`.trim() || paciente?.nombre_completo || 'N/A';

  const rawUsername =
    factura.pacienteUsername ||
    (paciente?.nombre || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') ||
    'paciente';
  const derivedUsername = rawUsername.replace(/\d+$/g, '') || 'paciente';
  const derivedPassword =
    factura._plainPassword ||
    (paciente?.apellido || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') ||
    'paciente';

  const handleLogoError = (event) => {
    if (logoSrc !== '/logo-centro.svg') {
      setLogoSrc('/logo-centro.svg');
      return;
    }
    event.currentTarget.style.display = 'none';
  };

  const handlePrint = () => {
    window.print();
  };

  const portalUrl = factura?.codigoQR ? `${window.location.origin}/mis-resultados?qr=${factura.codigoQR}` : `${window.location.origin}/mis-resultados`;

  return (
    <div
      className="thermal-view-shell"
      style={{
        minHeight: '100%',
        padding: '20px 16px 32px',
        background: 'linear-gradient(180deg, var(--legacy-surface-muted), var(--legacy-surface))',
        color: 'var(--legacy-text)'
      }}
    >
      <style>
        {`
          .thermal-view-shell {
            box-sizing: border-box;
          }

          html.dark .thermal-view-shell {
            background: linear-gradient(180deg, #0b1120, #111827) !important;
            color: #e2e8f0 !important;
          }

          .thermal-view-shell *,
          .thermal-ticket,
          .thermal-ticket * {
            box-sizing: border-box;
          }

          .thermal-ticket {
            width: ${PAPER_WIDTH_PX}px;
            max-width: 100%;
            margin: 0 auto;
            padding: 12px 11px 14px;
            background: #ffffff !important;
            border: 1px solid #111111;
            box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
            color: #111111 !important;
            font-family: "Courier New", Courier, monospace;
            font-size: 11px;
            line-height: 1.35;
          }

          html.dark .thermal-ticket,
          html.dark .thermal-ticket * {
            color: #111111 !important;
          }

          html.dark .thermal-ticket {
            background: #ffffff !important;
            border-color: #111111 !important;
          }

          .thermal-ticket,
          .thermal-ticket div,
          .thermal-ticket span,
          .thermal-ticket p,
          .thermal-ticket strong,
          .thermal-ticket td,
          .thermal-ticket th {
            color: inherit !important;
          }

          .thermal-logo {
            display: block;
            max-width: 188px;
            max-height: 54px;
            margin: 0 auto 6px;
            object-fit: contain;
            filter: grayscale(1) contrast(2.2) brightness(0.14);
          }

          .thermal-header {
            text-align: center;
            padding-bottom: 10px;
            border-bottom: 2px solid #111111;
          }

          .thermal-company-name {
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin: 0 0 4px;
          }

          .thermal-company-meta {
            font-size: 10px;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .thermal-block {
            border-bottom: 1px dashed #111111;
            padding: 9px 0;
          }

          .thermal-block:last-of-type {
            border-bottom: none;
          }

          .thermal-section-title {
            display: block;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 7px;
          }

          .thermal-muted-box {
            background: #f2f2f2 !important;
            border: 1px solid #111111;
            padding: 8px;
          }

          .thermal-row {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 3px;
          }

          .thermal-row:last-child {
            margin-bottom: 0;
          }

          .thermal-row-label {
            font-weight: 700;
            white-space: nowrap;
          }

          .thermal-row-value {
            text-align: right;
            flex: 1;
            overflow-wrap: anywhere;
          }

          .thermal-items-head,
          .thermal-item-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 60px 54px;
            gap: 6px;
            align-items: start;
          }

          .thermal-items-head {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0 0 6px;
            border-bottom: 1px solid #111111;
          }

          .thermal-item-row {
            padding: 6px 0;
            border-bottom: 1px dashed #b8b8b8;
          }

          .thermal-item-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .thermal-item-name {
            padding-right: 6px;
            overflow-wrap: anywhere;
          }

          .thermal-amount {
            text-align: right;
            white-space: nowrap;
          }

          .thermal-total-box {
            margin-top: 8px;
            border-top: 2px solid #111111;
            padding-top: 8px;
          }

          .thermal-total-line {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 3px;
          }

          .thermal-inverse {
            background: #111111 !important;
            color: #ffffff !important;
            padding: 7px 8px;
            margin: 6px 0 0;
            border: 1px solid #111111;
          }

          .thermal-inverse * {
            color: #ffffff !important;
          }

          html.dark .thermal-ticket .thermal-inverse {
            background: #111111 !important;
            color: #ffffff !important;
            border-color: #111111 !important;
          }

          html.dark .thermal-ticket .thermal-inverse *,
          html.dark .thermal-ticket .thermal-total-banner,
          html.dark .thermal-ticket .thermal-total-banner span,
          html.dark .thermal-ticket .thermal-total-banner strong {
            color: #ffffff !important;
          }

          .thermal-total-banner {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            color: #ffffff !important;
          }

          .thermal-total-banner span,
          .thermal-total-banner strong {
            color: #ffffff !important;
          }

          .thermal-alert {
            border: 1px solid #111111;
            background: #f2f2f2 !important;
            padding: 7px 8px;
            margin-top: 6px;
            font-weight: 800;
          }

          html.dark .thermal-muted-box,
          html.dark .thermal-credentials,
          html.dark .thermal-alert {
            background: #f2f2f2 !important;
            color: #111111 !important;
            border-color: #111111 !important;
          }

          .thermal-center {
            text-align: center;
          }

          .thermal-code-wrap {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            margin-top: 6px;
          }

          .thermal-credentials {
            margin-top: 8px;
            padding: 8px;
            border: 1px dashed #111111;
            background: #f7f7f7 !important;
          }

          .thermal-credentials .thermal-row {
            margin-bottom: 4px;
          }

          .thermal-credentials .thermal-row:last-child {
            margin-bottom: 0;
          }

          .thermal-footer {
            text-align: center;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 2px solid #111111;
            font-size: 10px;
          }

          .thermal-toolbar {
            width: ${PAPER_WIDTH_PX}px;
            max-width: 100%;
            margin: 0 auto 14px;
            text-align: center;
            color: var(--legacy-text-muted);
            font-size: 13px;
            font-weight: 600;
          }

          html.dark .thermal-toolbar {
            color: #cbd5e1 !important;
          }

          .thermal-actions {
            width: ${PAPER_WIDTH_PX}px;
            max-width: 100%;
            margin: 18px auto 0;
            display: flex;
            gap: 10px;
            justify-content: center;
          }

          .thermal-action-btn {
            min-width: 120px;
            padding: 12px 18px;
            border-radius: 10px;
            border: 1px solid var(--legacy-border);
            background: var(--legacy-surface);
            color: var(--legacy-text-strong);
            cursor: pointer;
            font-weight: 700;
          }

          .thermal-action-btn.primary {
            background: #111111;
            color: #ffffff;
            border-color: #111111;
          }

          html.dark .thermal-action-btn {
            background: #0f172a !important;
            color: #f8fafc !important;
            border-color: rgba(148, 163, 184, 0.3) !important;
          }

          html.dark .thermal-action-btn.primary {
            background: #f8fafc !important;
            color: #0f172a !important;
            border-color: #f8fafc !important;
          }

          @media print {
            @page {
              size: auto;
              margin: 0;
            }

            body {
              margin: 0 !important;
              background: #ffffff !important;
            }

            body * {
              visibility: hidden;
            }

            .thermal-ticket,
            .thermal-ticket * {
              visibility: visible;
            }

            .thermal-view-shell {
              padding: 0 !important;
              background: #ffffff !important;
            }

            .thermal-ticket {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: 76mm;
              margin: 0;
              padding: 1.5mm 1.75mm 2mm;
              border: none;
              box-shadow: none;
              font-size: 9.5px;
              line-height: 1.25;
            }

            .thermal-logo {
              max-width: 46mm;
              max-height: 12mm;
              filter: grayscale(1) contrast(2.2) brightness(0.12);
            }

            .thermal-header {
              padding-bottom: 7px;
            }

            .thermal-block {
              padding: 6px 0;
            }

            .thermal-muted-box,
            .thermal-credentials,
            .thermal-alert {
              padding: 5px 6px;
            }

            .thermal-items-head,
            .thermal-item-row {
              grid-template-columns: minmax(0, 1fr) 44px 46px;
              gap: 4px;
            }

            .thermal-section-title,
            .thermal-items-head,
            .thermal-company-meta,
            .thermal-footer {
              font-size: 8.5px;
            }

            .thermal-row,
            .thermal-total-line,
            .thermal-total-banner {
              gap: 6px;
            }

            .thermal-code-wrap svg,
            .thermal-code-wrap canvas {
              max-width: 100% !important;
              height: auto !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="thermal-toolbar no-print">
        Vista termica de factura. El comprobante se mantiene en papel blanco con impresion monocroma para que sea legible en modo claro y oscuro.
      </div>

      <div className="thermal-ticket" role="document" aria-label={`Factura termica ${numeroFactura}`}>
        <div className="thermal-header">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={empresaNombre}
              className="thermal-logo"
              onError={handleLogoError}
            />
          )}
          <div className="thermal-company-name">{empresaNombre}</div>
          <div className="thermal-company-meta">
            <div>{empresaDireccion}</div>
            {empresaTelefono && <div>Tel: {empresaTelefono}</div>}
            {empresaEmail && <div>{empresaEmail}</div>}
          </div>
        </div>

        <div className="thermal-block">
          <div className="thermal-muted-box">
            <div className="thermal-row">
              <span className="thermal-row-label">Factura</span>
              <span className="thermal-row-value">{numeroFactura}</span>
            </div>
            <div className="thermal-row">
              <span className="thermal-row-label">Fecha</span>
              <span className="thermal-row-value">{fechaFactura.toLocaleDateString('es-DO')}</span>
            </div>
            <div className="thermal-row">
              <span className="thermal-row-label">Hora</span>
              <span className="thermal-row-value">{fechaFactura.toLocaleTimeString('es-DO')}</span>
            </div>
            <div className="thermal-row">
              <span className="thermal-row-label">Cajero</span>
              <span className="thermal-row-value">{cajero}</span>
            </div>
            {factura?.metodoPago && (
              <div className="thermal-row">
                <span className="thermal-row-label">Metodo</span>
                <span className="thermal-row-value">{getTexto(factura.metodoPago)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="thermal-block">
          <span className="thermal-section-title">Paciente</span>
          <div className="thermal-row">
            <span className="thermal-row-label">Nombre</span>
            <span className="thermal-row-value">{nombreCompleto}</span>
          </div>
          <div className="thermal-row">
            <span className="thermal-row-label">Cedula</span>
            <span className="thermal-row-value">{getCedulaDisplay()}</span>
          </div>
          {(edad || sexo) && (
            <div className="thermal-row">
              <span className="thermal-row-label">Edad / Sexo</span>
              <span className="thermal-row-value">
                {[edad, sexo].filter(Boolean).join(' / ')}
              </span>
            </div>
          )}
          <div className="thermal-row">
            <span className="thermal-row-label">Telefono</span>
            <span className="thermal-row-value">{getTexto(paciente?.telefono) || 'N/A'}</span>
          </div>
          <div className="thermal-row">
            <span className="thermal-row-label">Nacionalidad</span>
            <span className="thermal-row-value">{nacionalidad}</span>
          </div>
        </div>

        <div className="thermal-block">
          <span className="thermal-section-title">Seguro</span>
          <div className="thermal-row">
            <span className="thermal-row-label">Seguro</span>
            <span className="thermal-row-value">{getSeguroNombre()}</span>
          </div>
          <div className="thermal-row">
            <span className="thermal-row-label">Afiliado</span>
            <span className="thermal-row-value">{getSeguroAfiliado()}</span>
          </div>
          <div className="thermal-row">
            <span className="thermal-row-label">Autorizacion</span>
            <span className="thermal-row-value">{getTexto(factura?.autorizacion) || 'N/A'}</span>
          </div>
        </div>

        <div className="thermal-block">
          <div className="thermal-items-head">
            <span>Descripcion</span>
            <span className="thermal-amount">Cobert.</span>
            <span className="thermal-amount">Valor</span>
          </div>
          {estudiosArray.length === 0 ? (
            <div className="thermal-item-row">
              <span className="thermal-item-name">Sin estudios registrados</span>
              <span className="thermal-amount">-</span>
              <span className="thermal-amount">-</span>
            </div>
          ) : (
            estudiosArray.map((estudio, index) => (
              <div key={`${numeroFactura}-${index}`} className="thermal-item-row">
                <span className="thermal-item-name">
                  {getTexto(estudio.nombre || estudio.estudioId?.nombre || estudio.descripcion || 'Estudio')}
                </span>
                <span className="thermal-amount">${(estudio.cobertura || 0).toFixed(2)}</span>
                <span className="thermal-amount">${(estudio.precio || estudio.precioUnitario || 0).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>

        <div className="thermal-total-box">
          <div className="thermal-total-line">
            <span>Subtotal</span>
            <strong>${subtotal.toFixed(2)}</strong>
          </div>
          <div className="thermal-total-line">
            <span>Cobertura seguro</span>
            <strong>-${cobertura.toFixed(2)}</strong>
          </div>
          <div className="thermal-inverse">
            <div className="thermal-total-banner">
              <span>TOTAL A PAGAR</span>
              <strong>${totalPagar.toFixed(2)}</strong>
            </div>
          </div>
          <div className="thermal-total-line" style={{ marginTop: 6 }}>
            <span>Monto pagado</span>
            <strong>${montoPagado.toFixed(2)}</strong>
          </div>
          {cambio > 0 && (
            <div className="thermal-total-line">
              <span>Cambio</span>
              <strong>${cambio.toFixed(2)}</strong>
            </div>
          )}
          {pendiente > 0 && (
            <div className="thermal-alert">
              <div className="thermal-total-line" style={{ marginBottom: 0 }}>
                <span>PENDIENTE</span>
                <strong>${pendiente.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="thermal-block thermal-center">
          <span className="thermal-section-title">Codigo de orden</span>
          <div className="thermal-code-wrap">
            <Barcode
              value={barcodeValue}
              width={0.95}
              height={30}
              fontSize={8}
              margin={1}
              lineColor="#111111"
              background="#ffffff"
            />
          </div>
        </div>

        {(factura?.codigoQR || derivedUsername || derivedPassword) && (
          <div className="thermal-block thermal-center">
            <span className="thermal-section-title">Portal de resultados</span>
            {factura?.codigoQR && (
              <div className="thermal-code-wrap">
                <QRCodeSVG
                  value={portalUrl}
                  size={84}
                  level="M"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#111111"
                  style={{ display: 'block' }}
                />
              </div>
            )}
            <div className="thermal-credentials">
              <div className="thermal-row">
                <span className="thermal-row-label">Usuario</span>
                <span className="thermal-row-value">{derivedUsername}</span>
              </div>
              <div className="thermal-row">
                <span className="thermal-row-label">Clave</span>
                <span className="thermal-row-value">{derivedPassword}</span>
              </div>
            </div>
          </div>
        )}

        <div className="thermal-footer">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Gracias por confiar en nosotros</div>
          <div>Conserve este comprobante para retirar sus resultados</div>
          <div style={{ marginTop: 4 }}>Su salud es nuestra prioridad</div>
        </div>
      </div>

      <div className="thermal-actions no-print">
        <button onClick={handlePrint} className="thermal-action-btn primary">
          Imprimir
        </button>
        <button onClick={onClose} className="thermal-action-btn">
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default FacturaTermica;
