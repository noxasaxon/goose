mod goosed;
mod tray;
mod window;

use goosed::GoosedManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Handle single instance callback - bring window to front
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                // Check if there's a deep link in the args
                if let Some(url) = args.iter().find(|arg| arg.starts_with("goose://")) {
                    window::add_pending_deep_link(url.clone());
                }

                // Focus existing windows or create new one
                let _ = window::focus_or_create_window(&app_handle).await;
            });
        }))
        .manage(GoosedManager::new())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create tray icon if enabled in settings
            // TODO: Load from actual settings file
            let app_handle_tray = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = tray::create_tray(&app_handle_tray);
            });

            // Start goosed in the background after window is created
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let runtime = tokio::runtime::Runtime::new().unwrap();
                runtime.block_on(async {
                    // Small delay to ensure window is ready
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                    match goosed::start_goosed_internal(&app_handle, None).await {
                        Ok(state) => {
                            println!("Goosed started successfully on port {}", state.port);

                            // Get window and show it
                            if let Some(window) = app_handle.get_webview_window("main") {
                                // Apply platform-specific styling to match dynamic windows
                                #[cfg(target_os = "macos")]
                                {
                                    use tauri::TitleBarStyle;
                                    let _ = window.set_title_bar_style(TitleBarStyle::Transparent);
                                }

                                // Inject window config
                                let _ = window.eval(&format!(
                                    r#"
                                    window.__tauriWindowConfig = {{
                                        GOOSE_PORT: {},
                                        GOOSE_WORKING_DIR: "{}"
                                    }};
                                    "#,
                                    state.port, state.working_dir
                                ));
                                window.show().unwrap();
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to start goosed: {}", e);
                            // Show window anyway
                            if let Some(window) = app_handle.get_webview_window("main") {
                                // Apply platform-specific styling to match dynamic windows
                                #[cfg(target_os = "macos")]
                                {
                                    use tauri::TitleBarStyle;
                                    let _ = window.set_title_bar_style(TitleBarStyle::Transparent);
                                }
                                window.show().unwrap();
                            }
                        }
                    }
                });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            goosed::find_available_port,
            goosed::start_goosed,
            goosed::get_goosed_state,
            goosed::stop_goosed,
            goosed::get_app_config,
            window::create_chat_window,
            window::hide_window,
            window::show_window,
            window::react_ready,
            window::get_all_windows,
            tray::set_menu_bar_icon,
            tray::get_menu_bar_icon_state,
            tray::set_dock_icon,
            tray::get_dock_icon_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
