const fetch = require('node-fetch');
const Resultado = require('../models/Resultado');
const Factura = require('../models/Factura');

// Configuración de Orthanc (proveniente de .env, override con DB config)
let ORTHANC_URL = process.env.ORTHANC_URL || 'http://127.0.0.1:8042';
let ORTHANC_USER = process.env.ORTHANC_USER || 'admin';
let ORTHANC_PASS = process.env.ORTHANC_PASS || 'admin';
let ORTHANC_AE_TITLE = process.env.ORTHANC_AE_TITLE || 'CS7_KONICA';

// Load config from DB if available
const loadOrthancConfig = async () => {
    try {
        const Configuracion = require('../models/Configuracion');
        const cfgDoc = await Configuracion.findOne({ clave: 'ris_config' });
        if (cfgDoc && cfgDoc.valor) {
            const parsed = JSON.parse(cfgDoc.valor);
            if (parsed.orthanc && parsed.orthanc.habilitado) {
                const o = parsed.orthanc;
                if (o.ip && o.puerto) {
                    ORTHANC_URL = `http://${o.ip}:${o.puerto}`;
                }
                if (o.usuario) ORTHANC_USER = o.usuario;
                if (o.password) ORTHANC_PASS = o.password;
                if (o.aeTitle) ORTHANC_AE_TITLE = o.aeTitle;
                console.log(`[Orthanc] Config loaded from DB: ${ORTHANC_URL}, AE: ${ORTHANC_AE_TITLE}`);
            }
        }
    } catch (e) {
        // Silently use env defaults
    }
};

// Ensure config is loaded before first use
const configReady = loadOrthancConfig();

// Generar header de autorización
const getAuthHeader = () => {
    const creds = Buffer.from(`${ORTHANC_USER}:${ORTHANC_PASS}`).toString('base64');
    return { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' };
};

/**
 * Enviar datos a Orthanc Worklist
 */
exports.enviarPacienteARayosX = async (paciente, factura, cita, itemsFactura) => {
    try {
        await configReady; // Ensure DB config is loaded
        if (!paciente || !factura) return;

        // Comprobar si hay estudios de Rayos X o Imagenología
        const categoriasImagen = ['Imagenología', 'Rayos X', 'CR', 'Sonografía', 'Tomografía', 'Mamografía', 'Ecografía', 'RX'];
        const estudiosRX = itemsFactura.filter(item => {
            if (!item.estudio) return false;
            const cat = (item.estudio.categoria || '').toLowerCase();
            const nombre = (item.estudio.nombre || '').toLowerCase();
            const matchCategoria = categoriasImagen.some(c => cat === c.toLowerCase());
            return matchCategoria ||
                cat.includes('imagen') || cat.includes('rayo') || cat.includes('radio') ||
                nombre.includes('rayo') || nombre.includes('radiograf') || /\brx\b/.test(nombre) ||
                nombre.includes('sonograf') || nombre.includes('tomograf') || nombre.includes('mamograf');
        });

        if (estudiosRX.length === 0) {
            return; // No hay rayos X, no hacer nada
        }

        // AccessionNumber: Utilizar código ID o número de factura corto
        const accessionNumber = factura.codigoId || factura.numero || factura._id.toString().slice(-8).toUpperCase();

        // Modality: Tomar la modalidad del primer estudio (si tuviera) o por defecto DX
        const modality = 'DX';

        // Formato APELLIDO^NOMBRE esperado por equipos HL7/DICOM
        const patientName = `${(paciente.apellido || '').trim()}^${(paciente.nombre || '').trim()}`.replace(/\s+/g, '^');

        const datosPaciente = {
            "PatientName": patientName,
            "PatientID": paciente.cedula || paciente._id.toString(),
            "AccessionNumber": accessionNumber,
            "Modality": modality,
            "ScheduledStationAETitle": ORTHANC_AE_TITLE
        };

        // Enviar a la API de Orthanc
        const response = await fetch(`${ORTHANC_URL}/worklists`, {
            method: 'POST',
            body: JSON.stringify(datosPaciente),
            headers: getAuthHeader()
        });

        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'No se pudo leer el error de Orthanc';
            }
            console.error(`[Orthanc] Error enviando Modality Worklist (Status: ${response.status}) [Factura:${factura?._id}] [Paciente:${paciente?._id}]:`, errorText);
            return { success: false, error: errorText, status: response.status };
        }

        console.log(`[Orthanc] ✅ Worklist enviada exitosamente para Paciente: ${patientName}, Accession: ${accessionNumber} [Factura:${factura?._id}]`);
        return { success: true };

    } catch (error) {
        console.error(`[Orthanc] Error ejecutando envío de Worklist [Factura:${factura?._id}] [Paciente:${paciente?._id}]:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Proceso programado para sincronizar imágenes listas desde Orthanc
 * Guarda el referencial en los Resultados con estado 'pendiente'
 */
exports.sincronizarImagenesListas = async () => {
    try {
        // Pedir los cambios recientes a Orthanc
        const response = await fetch(`${ORTHANC_URL}/changes?limit=50`, {
            method: 'GET',
            headers: getAuthHeader()
        });

        if (!response.ok) return;

        const data = await response.json();

        // Filtrar cambios de tipo "StableStudy" (Estudio completo y transferido sin errores)
        const stableStudies = data.Changes.filter(c => c.ChangeType === 'StableStudy');

        for (const change of stableStudies) {
            const studyId = change.ID;

            // Obtener metadata del estudio para extraer AccessionNumber
            const infoRes = await fetch(`${ORTHANC_URL}/studies/${studyId}`, {
                method: 'GET',
                headers: getAuthHeader()
            });

            if (!infoRes.ok) continue;

            const studyInfo = await infoRes.json();
            const accessionNumber = studyInfo.MainDicomTags?.AccessionNumber;

            if (!accessionNumber) continue;

            const accessionNumerico = Number.parseInt(accessionNumber, 10);
            const accessionEsNumerico = Number.isFinite(accessionNumerico);

            // Buscar si tenemos algún resultado pendiente con ese número (que viene de la factura)
            // Primero, buscamos facturas que correspondan a ese AccessionNumber (código LIS o Número)
            const facturaMatch = await Factura.findOne({
                $or: [
                    ...(accessionEsNumerico ? [{ codigoId: accessionNumerico }] : []),
                    { numero: accessionNumber }
                ]
            }).select('_id');

            if (!facturaMatch) continue;

            // Buscar resultados atados a esa factura que estén pendientes y no tengan ya este studyID
            const resultadosActualizados = await Resultado.updateMany(
                {
                    factura: facturaMatch._id,
                    orthancStudyId: { $ne: studyId },
                    estado: 'pendiente' // Solo actualiza los que sigan pendientes
                },
                {
                    $set: {
                        orthancStudyId: studyId,
                        estado: 'completado',
                        fechaCompletado: new Date(),
                        'tecnico.metodo': 'Digital DICOM (Orthanc)'
                    }
                }
            );

            if (resultadosActualizados.modifiedCount > 0) {
                console.log(`[Orthanc] 📥 Estudio ${accessionNumber} sincronizado y vinculado al CMS web. (Orthanc ID: ${studyId})`);
            }
        }
    } catch (error) {
        console.error(`[Orthanc Polling] Error:`, error.message);
    }
};

/**
 * Obtener las instancias de un estudio
 */
exports.getStudyInstances = async (studyId) => {
    try {
        const response = await fetch(`${ORTHANC_URL}/studies/${studyId}/instances`, {
            method: 'GET',
            headers: getAuthHeader()
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        console.error(`[Orthanc] Error obteniendo instancias del estudio ${studyId}:`, e.message);
        return [];
    }
};
