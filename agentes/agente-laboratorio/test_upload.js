const https = require('https');

const data = JSON.stringify({
    station_name: "Test-PC",
    equipment_type: "hematologia",
    equipment_name: "ABX Micros 60 (Simulado)",
    cedula: "23",
    tipo_estudio: "hematologia",
    valores: {
        "WBC (Leucocitos)": { valor: "4.8", unidad: "x 10³/µL", referencia: "4.0 - 10.0", estado: "normal" },
        "RBC (Eritrocitos)": { valor: "3.84", unidad: "x 10⁶/µL", referencia: "4.5 - 5.5", estado: "bajo" },
        "HGB (Hemoglobina)": { valor: "11.4", unidad: "g/dL", referencia: "12.0 - 16.0", estado: "bajo" },
        "HCT (Hematocrito)": { valor: "36.2", unidad: "%", referencia: "36.0 - 46.0", estado: "normal" },
        "MCV (Volumen Corp. Medio)": { valor: "94.0", unidad: "fL", referencia: "80.0 - 100.0", estado: "normal" },
        "MCH (Hb Corp. Media)": { valor: "29.8", unidad: "pg", referencia: "27.0 - 32.0", estado: "normal" },
        "MCHC (Conc. Hb Corp. Media)": { valor: "31.6", unidad: "g/dL", referencia: "32.0 - 36.0", estado: "bajo" },
        "RDW (Ancho Dist. Eritrocitaria)": { valor: "11.9", unidad: "%", referencia: "11.5 - 14.5", estado: "normal" },
        "PLT (Plaquetas)": { valor: "254", unidad: "x 10³/µL", referencia: "150 - 400", estado: "normal" },
        "MPV (Volumen Plaquetario Medio)": { valor: "9.9", unidad: "fL", referencia: "7.0 - 11.0", estado: "normal" }
    },
    timestamp: new Date().toISOString()
});

const req = https.request('https://example.com/api/equipos/recibir-json', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => responseBody += chunk);
    res.on('end', () => {
        console.log('--- RESPUESTA DEL VPS HTTPS ---');
        console.log('Status Code:', res.statusCode);
        console.log('Body:', responseBody);
    });
});

req.on('error', (e) => {
    console.error('Error enviando peticion:', e);
});

req.write(data);
req.end();
