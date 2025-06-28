mod goosed;

use goosed::GoosedManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init())
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

            // Show window after state is restored
            if let Some(window) = app.get_webview_window("main") {
                window.show().unwrap();
            }

            // Set up cleanup handler for app exit
            let app_handle = app.handle().clone();
            app.on_exit(move |_| {
                // Stop goosed when the app exits
                let manager = app_handle.state::<GoosedManager>();
                if let Ok(mut process_guard) = manager.process.lock() {
                    if let Some(mut child) = process_guard.take() {
                        let _ = child.kill();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            goosed::find_available_port,
            goosed::start_goosed,
            goosed::get_goosed_state,
            goosed::stop_goosed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
