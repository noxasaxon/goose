
# Goose Electron → Tauri Migration Knowledge Base

> **Purpose**   
> Collect every practical fact, pitfall, and reference you will need when converting the **Goose** desktop client from **Electron 33 / Electron‑Forge** to **Tauri 2.x**.

---

## 1 — Current Electron implementation in Goose

| Area | What Goose Uses | Key Details |
|------|-----------------|-------------|
| **Location** | `ui/desktop` | Electron code lives in its own workspace. `package.json` declares Electron 33, Electron‑Forge, Playwright, Vite and React 18. citeturn13view0 |
| **Main process** | `src/main.ts` | • Creates and restores windows with `BrowserWindow` <br>• Spawns the Rust **goosed** side‑car (`startGoosed`) and passes a random free port via CLI env <br>• Registers `goose://` deep‑link handler <br>• Handles drag‑and‑drop, “open‑file/open‑url” events, power‑save blocker, tray/dock icons, updater, context‑menu spell‑checker, single‑instance lock, etc. citeturn15view0 |
| **Preload (IPC bridge)** | `src/preload.ts` | Exposes ~40 functions (`directoryChooser`, `ensureDirectory`, `saveDataUrlToTemp`, updater helpers, etc.) to the renderer with `contextBridge`. citeturn16view0 |
| **Renderer** | React + Tailwind + Vite | Pure web‑tech — minimal adaptation needed for Tauri. |
| **Build / CI** | Electron‑Forge makers (`deb`, `rpm`, `squirrel`, `zip`) + GitHub Action _“Lint Electron Desktop App / bundle-desktop-unsigned”_ citeturn12search0 |

### Node/Electron‑specific APIs you **must** replace

* `fs`, `fs/promises`, `child_process`, `crypto`
* `electron.shell.openExternal`
* Tray / Dock & Menu building
* Auto‑update channel (custom)

---

## 2 — Why Tauri?  (quick refresher)

| Aspect | Electron 33 | **Tauri 2** |
|--------|-------------|-------------|
| Runtime | Full Chromium + Node | System WebView (WebKit, WebView2) + Rust core |
| Memory | 400‑600 MB typical | 60‑120 MB typical [LogRocket benchmark] citeturn20search1 |
| Bundle size | 200‑300 MB on macOS | 20‑40 MB (“Jan” saw ~10× shrink) citeturn21search0 |
| Security surface | Node context, remote eval, native *.node | No Node by default, granular command scopes, CSP |
| API | IPC via `ipcRenderer` | invoke/emit via `@tauri-apps/api`, `tauri::command` |

Notable built‑ins in 2.x:

* **Updater**, **Dialog**, **FS**, **Deep Linking**, **Single Instance**, **System Tray**, **Window State**, **Shell**, **Process**, **HTTP**, **Store** plugins.  
  See *Tauri → Plugins* matrix. citeturn23view0

---

## 3 — Lessons from “Jan” (another Electron → Tauri migration)

* **Jan v0.6** switched in 2025‑06 and immediately cut its **universal macOS build from 208 MB to 42 MB** while halving idle RAM. citeturn21search0  
* Maintained React codebase; replaced Electron preload with ~25 Tauri commands written in Rust.
* Embedded llama.cpp as a **sidecar** so GPU builds remained optional (pattern useful for Goose’s `goosed` process).

---

## 4 — Concept‑by‑concept mapping

| Electron concept | Tauri equivalent / strategy |
|------------------|-----------------------------|
| `BrowserWindow` options | `tauri::WindowBuilder` (transparent / hidden title bar via `decorations(false)` / `title_bar_style`) |
| Preload IPC (`contextBridge`) | Replace with [`invoke`](https://docs.rs/tauri/latest/tauri/attr.command.html) commands & `@tauri-apps/api/event` listeners |
| `shell.openExternal` | `@tauri-apps/api/shell` `open()` |
| Tray / Dock icons | `tauri::SystemTray` & `plugin-spotlight` for macOS dock badges |
| Deep links (`goose://`) | `tauri-plugin-deep-link` or manual URL scheme in `tauri.conf.json > bundle > macOS > urlScheme` |
| Auto‑update | Built‑in **updater** plugin (code‑sign keys go in `signing.*`) |
| Power‑save blocker | Use `tauri-plugin-process::prevent_sleep` (mac/win) |
| Spell‑checker | Not built‑in → embed WASM spell checker or call OS services via custom command |
| Child process (`startGoosed`) | Declare **goosed** as a _sidecar_ (`tauri.conf.json > tauri > bundles > resources`) and launch via `Command::new` in Rust. |
| Window state persistence | `tauri-plugin-window-state` |
| File dialogs & DnD | `@tauri-apps/api/dialog` + HTML5 drag‑and‑drop; for “open file via dock” use macOS `open-file` event (`tauri::AppHandle::run_on_open`) |
| Single instance | `tauri-plugin-single-instance` |

---

## 5 — Key migration gotchas

1. **Node‑only modules** ⟶ rewrite in Rust or find a plugin.  
2. **Absolute FS paths in renderer** are blocked by default CSP — use `invoke` to read/write.  
3. **Dev workflow**: `tauri dev` proxies Vite on port 1420; disable Electron‑Forge scripts.  
4. **macOS notarization** now handled by `tauri-os-sign` or GitHub `tauri‑action`.  
5. **Windows DLLs** you copied manually (see `bundle:windows`) move to `resources/icon/` or `windows > wix`.  
6. **Playwright E2E** needs `--device ScaleFactor` tweak because WebView2 reports different viewport metrics.

---

## 6 — Further reading & snippets

* Official **Upgrade & Migrate** guide: <https://v2.tauri.app/start/migrate/> citeturn23view0  
* UMLBoard series _“Moving from Electron to Tauri”_ (IPC deep dive) citeturn20search0  
* LogRocket _“Tauri vs Electron — migration”_ citeturn20search1  
* GitHub discussion _`tauri-apps/tauri#1869`_ for conceptual table citeturn20search3  
* Example repo: <https://github.com/mul14/electron-to-tauri> (step‑by‑step diff) citeturn20search10  

---

_Last updated: 2025-06-27_
