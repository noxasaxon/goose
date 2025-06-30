use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoosedState {
    pub port: u16,
    pub working_dir: String,
}

// Store the sidecar state and process handle globally
pub struct GoosedManager {
    state: Mutex<Option<GoosedState>>,
    process: Mutex<Option<CommandChild>>,
    secret_key: Mutex<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(rename = "GOOSE_API_HOST")]
    pub goose_api_host: String,
    #[serde(rename = "GOOSE_PORT")]
    pub goose_port: Option<u16>,
    #[serde(rename = "secretKey")]
    pub secret_key: String,
}

impl GoosedManager {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(None),
            process: Mutex::new(None),
            secret_key: Mutex::new(Uuid::new_v4().to_string()),
        }
    }
}

/// Find an available port by binding to port 0
#[tauri::command]
pub async fn find_available_port() -> Result<u16, String> {
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to bind to port 0: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    drop(listener); // Release the port

    Ok(port)
}

/// Check if the goosed server is ready by polling the status endpoint
async fn check_server_status(port: u16, max_attempts: u32) -> Result<bool, String> {
    let status_url = format!("http://127.0.0.1:{}/status", port);
    let client = reqwest::Client::new();

    for attempt in 1..=max_attempts {
        match client.get(&status_url).send().await {
            Ok(response) if response.status().is_success() => {
                return Ok(true);
            }
            _ => {
                // Server not ready yet, wait a bit
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }

        if attempt == max_attempts {
            return Ok(false);
        }
    }

    Ok(false)
}

/// Internal function to start goosed
pub async fn start_goosed_internal<R: Runtime>(
    app: &AppHandle<R>,
    working_dir: Option<String>,
) -> Result<GoosedState, String> {
    let manager = app.state::<GoosedManager>();

    // Check if already running
    if let Ok(state) = manager.state.lock() {
        if state.is_some() {
            return Err("Goosed is already running".to_string());
        }
    }

    // Find available port
    let port = find_available_port().await?;

    // Determine working directory
    let working_dir = working_dir.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    });

    // Validate working directory
    let work_path = std::path::Path::new(&working_dir);
    if !work_path.exists() || !work_path.is_dir() {
        return Err(format!("Invalid working directory: {}", working_dir));
    }

    // Get the secret key from the manager
    let secret_key = manager
        .secret_key
        .lock()
        .map_err(|_| "Failed to access secret key".to_string())?
        .clone();

    // Prepare environment variables
    let mut env = std::collections::HashMap::new();
    env.insert("GOOSE_PORT".to_string(), port.to_string());
    env.insert("GOOSE_SERVER__SECRET_KEY".to_string(), secret_key.clone());

    // Add home directory env vars
    if let Some(home) = dirs::home_dir() {
        let home_str = home.to_string_lossy().to_string();
        env.insert("HOME".to_string(), home_str.clone());
        env.insert("USERPROFILE".to_string(), home_str);
    }

    // Start the sidecar
    let shell = app.shell();
    let sidecar_command = shell
        .sidecar("goosed")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args(["agent"])
        .current_dir(&working_dir)
        .envs(env);

    let (mut _rx, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn goosed: {}", e))?;

    // Wait for server to be ready
    let is_ready = check_server_status(port, 80).await?;
    if !is_ready {
        // Kill the process if it didn't start properly
        let _ = child.kill();
        return Err("Goosed server failed to start".to_string());
    }

    // Store the state
    let state = GoosedState {
        port,
        working_dir: working_dir.clone(),
    };

    // Store both state and process handle
    if let Ok(mut manager_state) = manager.state.lock() {
        *manager_state = Some(state.clone());
    }

    if let Ok(mut manager_process) = manager.process.lock() {
        *manager_process = Some(child);
    }

    Ok(state)
}

/// Start the goosed sidecar process (Tauri command)
#[tauri::command]
pub async fn start_goosed<R: Runtime>(
    app: AppHandle<R>,
    working_dir: Option<String>,
) -> Result<GoosedState, String> {
    start_goosed_internal(&app, working_dir).await
}

/// Get the current goosed state
#[tauri::command]
pub fn get_goosed_state<R: Runtime>(app: AppHandle<R>) -> Result<Option<GoosedState>, String> {
    let manager = app.state::<GoosedManager>();

    let result = match manager.state.lock() {
        Ok(state) => Ok(state.clone()),
        Err(e) => Err(format!("Failed to get goosed state: {}", e)),
    };
    result
}

/// Stop the goosed process
#[tauri::command]
pub async fn stop_goosed<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let manager = app.state::<GoosedManager>();

    // Clear the state
    if let Ok(mut state) = manager.state.lock() {
        *state = None;
    }

    // Kill the process
    let kill_result = {
        let mut process_guard = manager
            .process
            .lock()
            .map_err(|_| "Failed to access goosed process".to_string())?;

        if let Some(child) = process_guard.take() {
            child
                .kill()
                .map_err(|e| format!("Failed to kill goosed process: {}", e))
        } else {
            Ok(()) // No process running
        }
    }; // Drop the mutex guard here

    // If kill was successful, wait a bit for the process to terminate
    if kill_result.is_ok() {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    kill_result
}

/// Get application configuration including API host, port, and secret key
#[tauri::command]
pub fn get_app_config<R: Runtime>(app: AppHandle<R>) -> Result<AppConfig, String> {
    let manager = app.state::<GoosedManager>();

    // Get the secret key
    let secret_key = manager
        .secret_key
        .lock()
        .map_err(|_| "Failed to access secret key".to_string())?
        .clone();

    // Get the port from goosed state if available
    let goose_port = if let Ok(state) = manager.state.lock() {
        state.as_ref().map(|s| s.port)
    } else {
        None
    };

    Ok(AppConfig {
        goose_api_host: "http://127.0.0.1".to_string(),
        goose_port,
        secret_key,
    })
}
