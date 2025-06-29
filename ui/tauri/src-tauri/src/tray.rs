use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Result, Runtime,
};

// Tray icon state
static TRAY_ICON_CREATED: Mutex<bool> = Mutex::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub show_menu_bar_icon: bool,
    pub show_dock_icon: bool,
    pub show_quit_confirmation: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            show_menu_bar_icon: true,
            show_dock_icon: true,
            show_quit_confirmation: false,
        }
    }
}

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    // Check if tray is already created
    let mut created = TRAY_ICON_CREATED.lock().unwrap();
    if *created {
        return Ok(());
    }

    // Get the icon based on platform
    let icon_path = if cfg!(target_os = "macos") {
        // macOS uses template images
        "icons/iconTemplate.png"
    } else {
        // Windows and Linux use regular icons
        "icons/32x32.png"
    };

    // Load the icon from the resources
    let icon = Image::from_path(
        app.path()
            .resolve(icon_path, tauri::path::BaseDirectory::Resource)?,
    )?;

    // Create the tray menu
    let show_window = MenuItemBuilder::with_id("show_window", "Show Window").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show_window, &quit])
        .build()?;

    // Create the tray icon
    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .tooltip("Goose")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show_window" => {
                show_all_windows(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|app, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                // On Windows, left click shows the window
                #[cfg(target_os = "windows")]
                show_all_windows(app);

                // On macOS, left click shows the menu (this is the default behavior)
            }
        })
        .build(app)?;

    *created = true;
    Ok(())
}

pub fn destroy_tray<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_visible(false)?;
    }

    let mut created = TRAY_ICON_CREATED.lock().unwrap();
    *created = false;

    Ok(())
}

pub fn update_tray_menu<R: Runtime>(app: &AppHandle<R>, has_update: bool) -> Result<()> {
    if let Some(tray) = app.tray_by_id("main") {
        let menu_builder = MenuBuilder::new(app);

        // Add update item if update is available
        let menu = if has_update {
            let update_item =
                MenuItemBuilder::with_id("update_available", "Update Available...").build(app)?;
            let show_window = MenuItemBuilder::with_id("show_window", "Show Window").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            menu_builder
                .items(&[&update_item, &show_window, &quit])
                .build()?
        } else {
            let show_window = MenuItemBuilder::with_id("show_window", "Show Window").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            menu_builder.items(&[&show_window, &quit]).build()?
        };

        tray.set_menu(Some(menu))?;
    }

    Ok(())
}

fn show_all_windows<R: Runtime>(app: &AppHandle<R>) {
    let windows = app.webview_windows();

    if windows.is_empty() {
        // Create a new window
        let _ = crate::window::create_chat_window(
            app.clone(),
            crate::window::CreateWindowOptions::default(),
        );
        return;
    }

    // Show all windows with offset
    let initial_offset_x = 30;
    let initial_offset_y = 30;

    for (index, (_label, window)) in windows.iter().enumerate() {
        if let Ok(position) = window.outer_position() {
            let new_x = position.x + (initial_offset_x * index as i32);
            let new_y = position.y + (initial_offset_y * index as i32);

            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: new_x,
                y: new_y,
            }));
        }

        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Command handlers
#[tauri::command]
pub async fn set_menu_bar_icon(app: AppHandle, show: bool) -> Result<bool, String> {
    if show {
        create_tray(&app).map_err(|e| e.to_string())?;
    } else {
        destroy_tray(&app).map_err(|e| e.to_string())?;
    }

    // Save the setting
    // In a real implementation, you would persist this to a settings file

    Ok(true)
}

#[tauri::command]
pub async fn get_menu_bar_icon_state() -> Result<bool, String> {
    // In a real implementation, load from settings
    let created = TRAY_ICON_CREATED.lock().unwrap();
    Ok(*created)
}

#[tauri::command]
pub async fn set_dock_icon(app: AppHandle, show: bool) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        app.set_activation_policy(if show {
            tauri::ActivationPolicy::Regular
        } else {
            tauri::ActivationPolicy::Accessory
        });
    }

    Ok(true)
}

#[tauri::command]
pub async fn get_dock_icon_state() -> Result<bool, String> {
    // On non-macOS platforms, always return true
    #[cfg(not(target_os = "macos"))]
    return Ok(true);

    // On macOS, check the current activation policy
    #[cfg(target_os = "macos")]
    {
        // In a real implementation, you would load this from settings
        Ok(true)
    }
}
