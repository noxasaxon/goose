use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// Track window IDs and their associated goosed ports
lazy_static::lazy_static! {
    static ref WINDOW_STATE: Mutex<WindowState> = Mutex::new(WindowState::new());
}

#[derive(Debug, Default)]
struct WindowState {
    window_counter: u32,
    window_map: HashMap<String, WindowInfo>,
    pending_deep_links: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    id: u32,
    label: String,
    goosed_port: Option<u32>,
    working_dir: Option<String>,
    is_recipe_editor: bool,
}

impl WindowState {
    fn new() -> Self {
        Self {
            window_counter: 0,
            window_map: HashMap::new(),
            pending_deep_links: Vec::new(),
        }
    }

    fn next_window_id(&mut self) -> u32 {
        self.window_counter += 1;
        self.window_counter
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct CreateWindowOptions {
    query: Option<String>,
    dir: Option<String>,
    version: Option<String>,
    resume_session_id: Option<String>,
    recipe_config: Option<serde_json::Value>,
    view_type: Option<String>,
}

#[tauri::command]
pub async fn create_chat_window(
    app: AppHandle,
    options: CreateWindowOptions,
) -> Result<String, String> {
    let window_id;
    let window_label;
    let is_recipe_editor = options.view_type.as_deref() == Some("recipeEditor");

    // Get window ID and check recipe editor status with the lock
    let (goosed_port, working_dir) = {
        let mut state = WINDOW_STATE.lock().unwrap();
        window_id = state.next_window_id();
        window_label = format!("chat-{}", window_id);

        if is_recipe_editor {
            // Find the first non-recipe-editor window's goosed info
            let parent_info = state
                .window_map
                .values()
                .find(|info| !info.is_recipe_editor && info.goosed_port.is_some())
                .ok_or_else(|| "No existing Goose process found for recipe editor".to_string())?;

            (parent_info.goosed_port, parent_info.working_dir.clone())
        } else {
            // We'll start goosed after releasing the lock
            (None, None)
        }
    }; // Lock is released here

    // Start goosed if needed (outside of lock)
    let (final_goosed_port, final_working_dir) = if !is_recipe_editor {
        // Check if goosed is already running
        let existing_state = crate::goosed::get_goosed_state(app.clone())
            .map_err(|e| format!("Failed to check goosed state: {}", e))?;

        if let Some(state) = existing_state {
            // Goosed is already running, reuse it
            (Some(state.port as u32), Some(state.working_dir))
        } else {
            // Start new goosed process
            let goosed_state = crate::goosed::start_goosed_internal(&app, options.dir.clone())
                .await
                .map_err(|e| format!("Failed to start goosed: {}", e))?;
            (
                Some(goosed_state.port as u32),
                Some(goosed_state.working_dir),
            )
        }
    } else {
        (goosed_port, working_dir)
    };

    // Build query parameters
    let mut query_params = vec![];
    if let Some(query) = &options.query {
        query_params.push(format!("initialQuery={}", urlencoding::encode(query)));
    }
    if let Some(session_id) = &options.resume_session_id {
        query_params.push(format!(
            "resumeSessionId={}",
            urlencoding::encode(session_id)
        ));
    }
    if let Some(view_type) = &options.view_type {
        query_params.push(format!("view={}", urlencoding::encode(view_type)));
    }

    let query_string = if query_params.is_empty() {
        String::new()
    } else {
        format!("?{}", query_params.join("&"))
    };

    // Calculate window position with offset for multiple windows
    let window_count = {
        let state = WINDOW_STATE.lock().unwrap();
        state.window_map.len()
    };
    let offset_multiplier = (window_count as i32) % 10;
    let x_offset = 30 * offset_multiplier;
    let y_offset = 30 * offset_multiplier;

    // Create the window
    let window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(format!("index.html{}", query_string).into()),
    )
    .title("Goose")
    .inner_size(750.0, 800.0)
    .min_inner_size(650.0, 400.0)
    .position(100.0 + x_offset as f64, 100.0 + y_offset as f64)
    .visible(true)
    .resizable(true)
    .accept_first_mouse(true) // Allow interaction without focusing first
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    // Store window configuration in window's app data
    window
        .eval(&format!(
            r#"
            window.__tauriWindowConfig = {{
                GOOSE_PORT: {},
                GOOSE_WORKING_DIR: "{}",
                recipeConfig: {}
            }};
            "#,
            final_goosed_port.unwrap_or(0),
            final_working_dir.as_deref().unwrap_or("."),
            serde_json::to_string(&options.recipe_config).unwrap_or_else(|_| "null".to_string())
        ))
        .map_err(|e| format!("Failed to inject window config: {}", e))?;

    // Platform-specific window configuration
    #[cfg(target_os = "macos")]
    {
        use tauri::TitleBarStyle;
        // Using Transparent style for better drag support
        // This provides a fully transparent title bar with better dragging behavior
        window
            .set_title_bar_style(TitleBarStyle::Transparent)
            .map_err(|e| format!("Failed to set titlebar style: {}", e))?;
    }

    // Store window info (need to reacquire lock)
    {
        let mut state = WINDOW_STATE.lock().unwrap();
        state.window_map.insert(
            window_label.clone(),
            WindowInfo {
                id: window_id,
                label: window_label.clone(),
                goosed_port: final_goosed_port,
                working_dir: final_working_dir,
                is_recipe_editor,
            },
        );
    }

    // Handle window close event
    let window_label_clone = window_label.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let mut state = WINDOW_STATE.lock().unwrap();

            // Get window info before removing
            if let Some(info) = state.window_map.get(&window_label_clone) {
                // If this is not a recipe editor and has a goosed process, we should stop it
                if !info.is_recipe_editor && info.goosed_port.is_some() {
                    // Check if any other windows are using this goosed port
                    let other_windows_using_port = state
                        .window_map
                        .values()
                        .filter(|w| {
                            w.label != window_label_clone && w.goosed_port == info.goosed_port
                        })
                        .count();

                    if other_windows_using_port == 0 {
                        // No other windows using this port, stop goosed
                        // Note: We'd need to call stop_goosed here, but that requires async
                        // For now, the goosed cleanup happens in the main window close handler
                    }
                }
            }

            state.window_map.remove(&window_label_clone);
        }
    });

    Ok(window_label)
}

#[tauri::command]
pub fn hide_window(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_window(app: AppHandle, label: Option<String>) -> Result<(), String> {
    if let Some(label) = label {
        // Show specific window
        if let Some(window) = app.get_webview_window(&label) {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        } else {
            return Err(format!("Window with label {} not found", label));
        }
    } else {
        // Show all windows with offset positioning
        let windows = app.webview_windows();
        let mut index = 0;
        for (_, window) in windows {
            let offset = 30 * index;
            if let Ok(position) = window.outer_position() {
                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: position.x + offset,
                    y: position.y + offset,
                }));
            }
            let _ = window.show();
            let _ = window.set_focus();
            index += 1;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn react_ready(app: AppHandle) -> Result<(), String> {
    // Handle any pending deep links
    let mut state = WINDOW_STATE.lock().unwrap();
    let pending_links = state.pending_deep_links.drain(..).collect::<Vec<_>>();
    drop(state);

    for link in pending_links {
        // Process deep link
        app.emit("deep-link", &link)
            .map_err(|e| format!("Failed to emit deep link: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_all_windows(_app: AppHandle) -> Vec<WindowInfo> {
    let state = WINDOW_STATE.lock().unwrap();
    state.window_map.values().cloned().collect()
}

// Helper function to add pending deep link
pub fn add_pending_deep_link(url: String) {
    let mut state = WINDOW_STATE.lock().unwrap();
    state.pending_deep_links.push(url);
}

// Helper function to focus window or create new one
pub async fn focus_or_create_window(app: &AppHandle) -> Result<(), String> {
    let windows = app.webview_windows();

    if windows.is_empty() {
        // Create new window
        create_chat_window(
            app.clone(),
            CreateWindowOptions {
                query: None,
                dir: None,
                version: None,
                resume_session_id: None,
                recipe_config: None,
                view_type: None,
            },
        )
        .await?;
    } else {
        // Focus existing windows
        show_window(app.clone(), None)?;
    }

    Ok(())
}
