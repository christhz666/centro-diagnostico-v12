use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

struct AgentState {
    child: Option<Child>,
    running: bool,
}

type SharedState = Arc<Mutex<AgentState>>;

/// Obtiene la ruta al directorio donde está el ejecutable de la app (para el agente-lab.exe)
fn get_app_dir() -> PathBuf {
    std::env::current_exe()
        .unwrap_or_default()
        .parent()
        .unwrap_or(&PathBuf::new())
        .to_path_buf()
}

/// Obtiene la ruta de configuración en %APPDATA% (siempre escribible sin admin)
fn get_config_dir() -> PathBuf {
    let base = std::env::var("APPDATA")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_else(|_| ".".to_string()));
    let dir = PathBuf::from(base).join("AgenteLabCentroEsperanza");
    let _ = std::fs::create_dir_all(&dir); // Crear si no existe
    dir
}

/// Config por defecto — preconfigurado con el VPS
fn config_default() -> serde_json::Value {
    serde_json::json!({
        "servidor": {
            "url": "https://miesperanzalab.duckdns.org",
            "apiKey": "",
            "equipoId": ""
        },
        "equipos": [],
        "intervaloReconexion": 10000,
        "logArchivo": "agente.log"
    })
}

#[tauri::command]
fn iniciar_agente(app: AppHandle, state: tauri::State<'_, SharedState>) -> Result<String, String> {
    let mut s = state.lock().unwrap();
    if s.running {
        return Ok("El agente ya está corriendo".to_string());
    }

    let app_dir = get_app_dir();
    let agente_path = app_dir.join("agente-lab.exe");

    let mut cmd = Command::new(&agente_path);
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&app_dir);

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "No se pudo iniciar el ejecutable nativo del agente ({}): {}",
            agente_path.display(),
            e
        )
    })?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    s.running = true;
    s.child = Some(child);
    drop(s);

    let app_clone = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_clone.emit("agente-log", line);
        }
    });

    let app_clone2 = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let _ = app_clone2.emit("agente-log", format!("[ERROR] {}", line));
        }
    });

    let _ = app.emit("agente-estado", true);
    Ok("Agente iniciado correctamente".to_string())
}

#[tauri::command]
fn detener_agente(app: AppHandle, state: tauri::State<'_, SharedState>) -> Result<String, String> {
    let mut s = state.lock().unwrap();
    if let Some(mut child) = s.child.take() {
        let _ = child.kill();
    }
    s.running = false;
    let _ = app.emit("agente-estado", false);
    Ok("Agente detenido".to_string())
}

#[tauri::command]
fn reiniciar_agente(
    app: AppHandle,
    state: tauri::State<'_, SharedState>,
) -> Result<String, String> {
    {
        let mut s = state.lock().unwrap();
        if let Some(mut child) = s.child.take() {
            let _ = child.kill();
        }
        s.running = false;
    }

    let _ = app.emit("agente-estado", false);

    // pequeño delay para liberar puertos COM/TCP
    std::thread::sleep(Duration::from_millis(600));

    iniciar_agente(app, state)
}

#[tauri::command]
fn estado_agente(state: tauri::State<'_, SharedState>) -> bool {
    state.lock().unwrap().running
}

/// Lee config.json — si NO existe, lo crea automáticamente con valores por defecto
#[tauri::command]
fn leer_config() -> Result<String, String> {
    let app_dir = get_app_dir();
    let config_path = app_dir.join("config.json");

    if !config_path.exists() {
        let default = config_default();
        let contenido = serde_json::to_string_pretty(&default)
            .map_err(|e| format!("Error serializando config por defecto: {}", e))?;
        std::fs::write(&config_path, &contenido)
            .map_err(|e| format!("Error creando config.json en {}: {}", app_dir.display(), e))?;
        return Ok(contenido);
    }

    std::fs::read_to_string(&config_path).map_err(|e| format!("Error leyendo config.json: {}", e))
}

#[tauri::command]
fn guardar_config(contenido: String) -> Result<String, String> {
    let app_dir = get_app_dir();
    let config_path = app_dir.join("config.json");
    std::fs::write(&config_path, contenido).map_err(|e| {
        format!(
            "Error al guardar config.json en {}: {}",
            app_dir.display(),
            e
        )
    })?;
    Ok("Configuración guardada correctamente".to_string())
}

/// Registra la app en el Registro de Windows para que inicie con Windows
#[tauri::command]
fn registrar_autostart() -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("No se pudo obtener la ruta del ejecutable: {}", e))?;
    let exe_str = exe_path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "AgenteLabCentroEsperanza",
                "/t",
                "REG_SZ",
                "/d",
                &exe_str,
                "/f",
            ])
            .output()
            .map_err(|e| format!("Error ejecutando reg.exe: {}", e))?;

        if output.status.success() {
            Ok(format!("Autostart registrado: {}", exe_str))
        } else {
            Err(format!(
                "Error del registro: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(format!(
            "Autostart solo disponible en Windows. Ruta: {}",
            exe_str
        ))
    }
}

/// Elimina el autostart del Registro de Windows
#[tauri::command]
fn eliminar_autostart() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "AgenteLabCentroEsperanza",
                "/f",
            ])
            .output()
            .map_err(|e| format!("Error: {}", e))?;
        // Si ya no existía (exit code 1 con mensaje de clave no encontrada), lo tratamos como éxito
        Ok("Autostart eliminado".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("Solo disponible en Windows".to_string())
    }
}

/// Verifica si el autostart está habilitado
#[tauri::command]
fn autostart_habilitado() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "AgenteLabCentroEsperanza",
            ])
            .output();
        output.map(|o| o.status.success()).unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}
#[tauri::command]
fn listar_puertos_com() -> Vec<String> {
    match serialport::available_ports() {
        Ok(ports) => ports.iter().map(|p| p.port_name.clone()).collect(),
        Err(_) => vec![],
    }
}

/// Abre un puerto COM y lee datos por `segundos` segundos, retornando el texto recibido
#[tauri::command]
fn leer_puerto_com(puerto: String, baud_rate: u32, segundos: u64) -> Result<String, String> {
    let port = serialport::new(&puerto, baud_rate)
        .timeout(Duration::from_secs(segundos))
        .open()
        .map_err(|e| format!("No se pudo abrir {}: {}", puerto, e))?;

    let mut reader = BufReader::new(port);
    let mut buffer = String::new();
    let start = std::time::Instant::now();

    while start.elapsed().as_secs() < segundos {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => buffer.push_str(&line),
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => break,
            Err(e) => return Err(format!("Error leyendo {}: {}", puerto, e)),
        }
        if buffer.len() > 4096 {
            break;
        } // Limitar tamaño
    }

    if buffer.is_empty() {
        Ok("(Sin datos recibidos en el tiempo indicado)".to_string())
    } else {
        Ok(buffer)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── Verificar y solicitar elevación de admin al inicio ──────────────
    #[cfg(target_os = "windows")]
    {
        let es_admin = Command::new("cmd")
            .args(["/C", "net session >nul 2>&1"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);

        if !es_admin {
            // Re-lanzar con privilegios de administrador (muestra UAC)
            let exe = std::env::current_exe().unwrap_or_default();
            let exe_str = exe.to_string_lossy();
            let _ = Command::new("powershell")
                .args([
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    &format!("Start-Process '{}' -Verb RunAs", exe_str),
                ])
                .spawn();
            std::process::exit(0); // Salir de la instancia sin admin
        }
    }

    let shared_state: SharedState = Arc::new(Mutex::new(AgentState {
        child: None,
        running: false,
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(shared_state)
        .invoke_handler(tauri::generate_handler![
            iniciar_agente,
            detener_agente,
            reiniciar_agente,
            estado_agente,
            leer_config,
            guardar_config,
            listar_puertos_com,
            leer_puerto_com,
            registrar_autostart,
            eliminar_autostart,
            autostart_habilitado
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar la app del agente");
}
