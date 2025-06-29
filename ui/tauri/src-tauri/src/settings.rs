use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

/// Application settings structure matching the electron version
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Show/hide menu bar icon
    pub show_menu_bar_icon: bool,
    /// Show/hide dock icon
    pub show_dock_icon: bool,
    /// Show quit confirmation dialog
    pub show_quit_confirmation: bool,
    /// Choice of scheduling engine
    pub scheduling_engine: SchedulingEngine,
    /// Environment toggles
    pub goose_server_memory: bool,
    pub goose_server_computer_controller: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum SchedulingEngine {
    BuiltinCron,
    Temporal,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            show_menu_bar_icon: true,
            show_dock_icon: true,
            show_quit_confirmation: false,
            scheduling_engine: SchedulingEngine::BuiltinCron,
            goose_server_memory: false,
            goose_server_computer_controller: false,
        }
    }
}

/// Recent directories structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentDirs {
    pub directories: Vec<String>,
}

impl Default for RecentDirs {
    fn default() -> Self {
        Self {
            directories: Vec::new(),
        }
    }
}

// Static store handle for settings
lazy_static::lazy_static! {
    static ref SETTINGS_CACHE: Mutex<Option<AppSettings>> = Mutex::new(None);
    static ref RECENT_DIRS_CACHE: Mutex<Option<RecentDirs>> = Mutex::new(None);
}

const SETTINGS_STORE_KEY: &str = "settings.json";
const RECENT_DIRS_STORE_KEY: &str = "recent-dirs.json";

/// Initialize the settings store and load existing settings
pub fn init_settings<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Initialize the store plugin
    let store = app.store(SETTINGS_STORE_KEY).map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("Failed to create store: {}", e)))?;
    
    // Load existing settings or create defaults
    let settings = match store.get("settings") {
        Some(value) => serde_json::from_value::<AppSettings>(value.clone()).unwrap_or_default(),
        None => {
            let default_settings = AppSettings::default();
            let _ = store.set("settings", serde_json::to_value(&default_settings)?);
            store.save().map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("Failed to save store: {}", e)))?;
            default_settings
        }
    };
    
    // Cache the settings
    *SETTINGS_CACHE.lock().unwrap() = Some(settings.clone());
    
    // Apply initial settings
    apply_settings(app, &settings)?;
    
    // Initialize recent dirs
    let recent_store = app.store(RECENT_DIRS_STORE_KEY).map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("Failed to create recent dirs store: {}", e)))?;
    let recent_dirs = match recent_store.get("directories") {
        Some(value) => serde_json::from_value::<RecentDirs>(value.clone()).unwrap_or_default(),
        None => {
            let default_dirs = RecentDirs::default();
            let _ = recent_store.set("directories", serde_json::to_value(&default_dirs)?);
            recent_store.save().map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("Failed to save recent dirs store: {}", e)))?;
            default_dirs
        }
    };
    
    *RECENT_DIRS_CACHE.lock().unwrap() = Some(recent_dirs);
    
    Ok(())
}

/// Apply settings to the application
fn apply_settings<R: Runtime>(app: &AppHandle<R>, settings: &AppSettings) -> tauri::Result<()> {
    // Apply menu bar icon setting
    if settings.show_menu_bar_icon {
        crate::tray::create_tray(app)?;
    } else {
        crate::tray::destroy_tray(app)?;
    }
    
    // Apply dock icon setting
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(if settings.show_dock_icon {
            tauri::ActivationPolicy::Regular
        } else {
            tauri::ActivationPolicy::Accessory
        });
    }
    
    Ok(())
}

/// Get current settings
#[tauri::command]
pub async fn get_settings<R: Runtime>(app: AppHandle<R>) -> Result<AppSettings, String> {
    // Try cache first
    if let Some(settings) = SETTINGS_CACHE.lock().unwrap().clone() {
        return Ok(settings);
    }
    
    // Otherwise load from store
    let store = app.store(SETTINGS_STORE_KEY).map_err(|e| e.to_string())?;
    let settings = match store.get("settings") {
        Some(value) => serde_json::from_value::<AppSettings>(value.clone())
            .map_err(|e| e.to_string())?,
        None => AppSettings::default(),
    };
    
    // Update cache
    *SETTINGS_CACHE.lock().unwrap() = Some(settings.clone());
    
    Ok(settings)
}

/// Update settings
#[tauri::command]
pub async fn update_settings<R: Runtime>(
    app: AppHandle<R>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    // Update store
    let store = app.store(SETTINGS_STORE_KEY).map_err(|e| e.to_string())?;
    let _ = store.set("settings", serde_json::to_value(&settings).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    
    // Update cache
    *SETTINGS_CACHE.lock().unwrap() = Some(settings.clone());
    
    // Apply settings
    apply_settings(&app, &settings).map_err(|e| e.to_string())?;
    
    Ok(settings)
}

/// Get a specific setting value
#[tauri::command]
pub async fn get_setting<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<serde_json::Value, String> {
    let settings = get_settings(app).await?;
    
    match key.as_str() {
        "showMenuBarIcon" => Ok(serde_json::json!(settings.show_menu_bar_icon)),
        "showDockIcon" => Ok(serde_json::json!(settings.show_dock_icon)),
        "showQuitConfirmation" => Ok(serde_json::json!(settings.show_quit_confirmation)),
        "schedulingEngine" => Ok(serde_json::json!(settings.scheduling_engine)),
        "GOOSE_SERVER__MEMORY" => Ok(serde_json::json!(settings.goose_server_memory)),
        "GOOSE_SERVER__COMPUTER_CONTROLLER" => Ok(serde_json::json!(settings.goose_server_computer_controller)),
        _ => Err(format!("Unknown setting key: {}", key)),
    }
}

/// Set a specific setting value
#[tauri::command]
pub async fn set_setting<R: Runtime>(
    app: AppHandle<R>,
    key: String,
    value: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mut settings = get_settings(app.clone()).await?;
    
    match key.as_str() {
        "showMenuBarIcon" => {
            settings.show_menu_bar_icon = value.as_bool()
                .ok_or_else(|| "Invalid boolean value".to_string())?;
        }
        "showDockIcon" => {
            settings.show_dock_icon = value.as_bool()
                .ok_or_else(|| "Invalid boolean value".to_string())?;
        }
        "showQuitConfirmation" => {
            settings.show_quit_confirmation = value.as_bool()
                .ok_or_else(|| "Invalid boolean value".to_string())?;
        }
        "schedulingEngine" => {
            settings.scheduling_engine = serde_json::from_value(value.clone())
                .map_err(|e| e.to_string())?;
        }
        "GOOSE_SERVER__MEMORY" => {
            settings.goose_server_memory = value.as_bool()
                .ok_or_else(|| "Invalid boolean value".to_string())?;
        }
        "GOOSE_SERVER__COMPUTER_CONTROLLER" => {
            settings.goose_server_computer_controller = value.as_bool()
                .ok_or_else(|| "Invalid boolean value".to_string())?;
        }
        _ => return Err(format!("Unknown setting key: {}", key)),
    }
    
    update_settings(app, settings).await?;
    Ok(value)
}

/// Get recent directories
#[tauri::command]
pub async fn get_recent_dirs<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    // Try cache first
    if let Some(recent) = RECENT_DIRS_CACHE.lock().unwrap().clone() {
        return Ok(recent.directories);
    }
    
    // Otherwise load from store
    let store = app.store(RECENT_DIRS_STORE_KEY).map_err(|e| e.to_string())?;
    let recent_dirs = match store.get("directories") {
        Some(value) => serde_json::from_value::<RecentDirs>(value.clone())
            .map_err(|e| e.to_string())?,
        None => RecentDirs::default(),
    };
    
    // Update cache
    *RECENT_DIRS_CACHE.lock().unwrap() = Some(recent_dirs.clone());
    
    Ok(recent_dirs.directories)
}

/// Add a recent directory
#[tauri::command]
pub async fn add_recent_dir<R: Runtime>(
    app: AppHandle<R>,
    directory: String,
) -> Result<Vec<String>, String> {
    // Validate directory exists and is not a symlink
    let path = std::path::Path::new(&directory);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    if path.is_symlink() {
        return Err("Symlinks are not allowed for security reasons".to_string());
    }
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut recent_dirs = RECENT_DIRS_CACHE.lock().unwrap().clone().unwrap_or_default();
    
    // Remove if already exists
    recent_dirs.directories.retain(|d| d != &directory);
    
    // Add to front
    recent_dirs.directories.insert(0, directory);
    
    // Limit to 10 most recent
    if recent_dirs.directories.len() > 10 {
        recent_dirs.directories.truncate(10);
    }
    
    // Save to store
    let store = app.store(RECENT_DIRS_STORE_KEY).map_err(|e| e.to_string())?;
    let _ = store.set("directories", serde_json::to_value(&recent_dirs).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    
    // Update cache
    let dirs = recent_dirs.directories.clone();
    *RECENT_DIRS_CACHE.lock().unwrap() = Some(recent_dirs);
    
    Ok(dirs)
}

/// Clear recent directories
#[tauri::command]
pub async fn clear_recent_dirs<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let recent_dirs = RecentDirs::default();
    
    // Save to store
    let store = app.store(RECENT_DIRS_STORE_KEY).map_err(|e| e.to_string())?;
    let _ = store.set("directories", serde_json::to_value(&recent_dirs).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    
    // Update cache
    *RECENT_DIRS_CACHE.lock().unwrap() = Some(recent_dirs);
    
    Ok(())
}