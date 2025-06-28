I’ve distilled the repository internals, the latest Tauri 2.x guidance, and lessons learned from Jan’s own Electron → Tauri switch into **migration\_info.md** and saved it for you.

[Download migration\_info.md](sandbox:/mnt/data/migration_info.md)

---

## Step-by-step tactical action plan

### 0. Prep

1. **Create a `tauri-migration` branch** off `main`.
2. Install **Rust 1.78+**, `cargo-tauri`, and `pnpm` in your dev environment.

### 1. Scaffold Tauri

```bash
pnpm dlx create-tauri-app ui/tauri \
  --template vanilla-js \
  --before-dev-command "pnpm dev:web" \
  --before-build-command "pnpm build:web" \
  --window-title "Goose"
```

*Point the scaffolder at your existing React/Vite source so the web build pipeline is reused.*

### 2. Wire the existing renderer

* Move `ui/desktop/src/renderer/**/*` ➜ `ui/tauri/src`.
* Delete Electron globals.
  Replace imports of `window.electron.*` with `invoke()` or `@tauri-apps/api` shims (see **Section 4** of the knowledge file).

### 3. Embed the `goosed` sidecar

* Add to `tauri.conf.json`:

  ```json
  "tauri": {
    "cli": { "sidecarRunner": true },
    "bundle": {
      "resources": ["../../target/release/goosed{.exe}"]
    }
  }
  ```
* In `src-tauri/main.rs` start it lazily:

  ```rust
  #[tauri::command] 
  fn start_goosed(port: u16, dir: String) { 
      Command::new("goosed").args(["--port", &port.to_string()])
          .current_dir(dir).spawn().unwrap();
  }
  ```

### 4. Re-implement preload APIs as Rust commands

| Old channel             | New Tauri command/plugin                               |
| ----------------------- | ------------------------------------------------------ |
| `directory-chooser`     | `dialog::FileDialogBuilder`                            |
| `read-file/ write-file` | `fs` plugin                                            |
| `powerSaveBlocker`      | `plugin-process::prevent_sleep`                        |
| `notify`                | `notification` plugin                                  |
| Deep links (`goose://`) | `plugin-deep-link` + `tauri::AppHandle::listen_global` |
| Updater calls           | built-in **updater**                                   |

Define each in `src-tauri/lib.rs` with the `#[command]` macro and register them in `Builder::default().invoke_handler(...)`.

### 5. Window management

* Replace `BrowserWindow` logic with:

  ```rust
  let main = tauri::WindowBuilder::new(
      app,
      "main",
      tauri::WindowUrl::App("index.html".into()),
  )
  .inner_size(750.0, 800.0)
  .decorations(cfg!(target_os = "macos") == false)
  .build()?;
  ```
* Persist size/pos using `tauri-plugin-window-state`.

### 6. System tray & dock

* Use `SystemTray` API to replicate the menu bar icon.
* For dock badges use `tauri-plugin-notification` on macOS.

### 7. Auto-update

* Enable the `updater` plugin; configure signing keys and feed URL in `tauri.conf.json`.

### 8. Security & CSP

* Activate Tauri permissions:

  ```json
  "permissions": { "fs": { "all": true }, "shell": true }
  ```
* Lock down CSP in `index.html` to `default-src 'self'`.

### 9. Testing & CI

1. Replace Electron Playwright job with `tauri-driver` compatible WebDriver tests.
2. Use the GitHub **tauri-action** to build notarized DMG, MSI, AppImage artifacts on every tag.

### 10. Cleanup

* Remove `ui/desktop`, Electron-Forge configs, and unused Node deps.
* Update docs and installer links.

---

**Next steps:**
Start with command mapping (#4) and get the window spawning with a dummy React page; once IPC succeeds, iterate through the API table until parity with the Electron build is reached. When all features pass Playwright, flip the default download links and sunset Electron in a minor release.

Let me know where you’d like deeper code examples or plugin scaffolding details!
