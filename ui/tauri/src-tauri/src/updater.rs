use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};

// Update state tracking
lazy_static::lazy_static! {
    static ref UPDATE_STATE: Mutex<Option<UpdateInfo>> = Mutex::new(None);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub available: bool,
    pub downloaded: bool,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

/// Check for updates
#[tauri::command]
pub async fn check_for_update<R: Runtime>(
    app: AppHandle<R>,
) -> Result<UpdateInfo, String> {
    let handle = app.clone();
    
    // Get the updater
    match handle.updater() {
        Ok(updater) => {
            // Check for updates
            match updater.check().await {
                Ok(Some(update)) => {
                    let info = UpdateInfo {
                        version: update.version.clone(),
                        available: true,
                        downloaded: false,
                        notes: update.body.clone(),
                        pub_date: update.date.map(|d| d.to_string()),
                    };
                    
                    // Cache the update info
                    *UPDATE_STATE.lock().unwrap() = Some(info.clone());
                    
                    // Emit update available event
                    let _ = app.emit("updater://update-available", &info);
                    
                    Ok(info)
                }
                Ok(None) => {
                    let info = UpdateInfo {
                        version: app.package_info().version.to_string(),
                        available: false,
                        downloaded: false,
                        notes: None,
                        pub_date: None,
                    };
                    
                    *UPDATE_STATE.lock().unwrap() = Some(info.clone());
                    
                    Ok(info)
                }
                Err(e) => {
                    eprintln!("Failed to check for updates: {}", e);
                    Err(format!("Failed to check for updates: {}", e))
                }
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

/// Download update
#[tauri::command]
pub async fn download_update<R: Runtime>(
    app: AppHandle<R>,
) -> Result<bool, String> {
    let handle = app.clone();
    
    match handle.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    // Emit download started event
                    let _ = app.emit("updater://download-started", ());
                    
                    // Start download with progress tracking
                    let app_clone = app.clone();
                    match download_with_progress(update, app_clone).await {
                        Ok(_) => {
                            // Update state
                            if let Some(ref mut info) = *UPDATE_STATE.lock().unwrap() {
                                info.downloaded = true;
                            }
                            
                            // Emit download complete event
                            let _ = app.emit("updater://download-complete", ());
                            
                            Ok(true)
                        }
                        Err(e) => {
                            let _ = app.emit("updater://download-error", e.to_string());
                            Err(format!("Failed to download update: {}", e))
                        }
                    }
                }
                Ok(None) => Err("No update available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

/// Download update with progress reporting
async fn download_with_progress<R: Runtime>(
    update: Update,
    app: AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut downloaded = 0;
    
    update
        .download(
            |chunk_len, content_len| {
                downloaded += chunk_len;
                
                let progress = if let Some(total) = content_len {
                    (downloaded as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                
                // Emit progress event
                let _ = app.emit("updater://download-progress", progress);
            },
            || {},
        )
        .await?;
    
    Ok(())
}

/// Install update and restart
#[tauri::command]
pub async fn install_update<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    // Emit install started event
                    let _ = app.emit("updater://install-started", ());
                    
                    // Install and restart
                    match update.install_and_relaunch(|| {}) {
                        Ok(_) => Ok(()),
                        Err(e) => {
                            let _ = app.emit("updater://install-error", e.to_string());
                            Err(format!("Failed to install update: {}", e))
                        }
                    }
                }
                Ok(None) => Err("No update available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

/// Get current update state
#[tauri::command]
pub async fn get_update_state() -> Result<Option<UpdateInfo>, String> {
    Ok(UPDATE_STATE.lock().unwrap().clone())
}

/// Get current app version
#[tauri::command]
pub async fn get_app_version<R: Runtime>(
    app: AppHandle<R>,
) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}