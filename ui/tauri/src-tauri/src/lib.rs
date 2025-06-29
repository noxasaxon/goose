mod goosed;

use goosed::GoosedManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {
            // Handle single instance callback - bring window to front
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
                                window.show().unwrap();
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to start goosed: {}", e);
                            // Show window anyway
                            if let Some(window) = app_handle.get_webview_window("main") {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
