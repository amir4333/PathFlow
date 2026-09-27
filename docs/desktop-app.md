# PathFlow Desktop Application Guide

This document describes the architecture, installation, operation, storage, security, and packaging workflows for the installable PathFlow desktop application for Windows.

---

## 1. Overview: What the Desktop Application Is

PathFlow Desktop is a standalone desktop application for **Windows 10 and Windows 11 (64-bit)** that wraps the existing PathFlow offline-first application inside an **Electron** host.

Non-technical users can download and install PathFlow directly onto their PC without installing Node.js, npm, Git, or any development software. The app launches directly from the Windows Start Menu or Desktop shortcut and provides full access to:
* Goals and Roadmaps
* Task management and completion tracking
* Active Study Sessions and manual session logging
* Weekly Planning with drag-and-drop allocation
* Progress Visualizations and Metrics
* Printable Reports and PDF exports
* Student-controlled Teacher Access
* Cloud Synchronization via the Remote Sync Engine

---

## 2. Installation Workflow for a Normal Windows User

For a non-technical end user, the installation process requires zero terminal commands:

1. **Download**: Download the installer file:
   * **Installer**: `PathFlow Setup 0.1.0.exe` (standard Windows NSIS Setup)
   * **Portable**: `PathFlow 0.1.0.exe` (run directly without installation)
2. **Run Installer**: Double-click `PathFlow Setup 0.1.0.exe`.
3. **Choose Options**:
   * The installer presents a standard wizard allowing the user to select their installation folder (defaults to per-user AppData without requiring Administrator privileges).
   * Automatically creates a **Desktop Shortcut** and **Start Menu** entry.
4. **Launch**: Click **Finish** or launch PathFlow from the Desktop shortcut or Start Menu.
5. **Uninstall**: PathFlow registers in Windows **Settings > Apps > Installed Apps**. Users can uninstall it cleanly with one click.

---

## 3. Development Workflow

Developers can run the desktop shell concurrently with Vite hot-reloading:

```bash
# 1. Start Vite dev server and launch Electron connected to http://localhost:3000
npm run desktop:dev
```

This uses `concurrently` and `wait-on` to wait for the local Vite dev server before booting the Electron main process with `--dev` flag. Changes in `src/` reload instantly via Vite HMR.

To compile only the Electron main process and preload scripts:
```bash
npm run desktop:compile
```

---

## 4. Production Packaging Workflow

To package PathFlow for distribution on Windows:

```bash
# 1. Build the production React frontend with relative asset paths (base: './')
# and bundle electron/main.ts and electron/preload.ts into dist-electron/
npm run desktop:build

# 2. Package the Windows x64 distribution artifacts using electron-builder
npm run desktop:package
```

### Packaging Outputs (in `dist-electron-packages/`):
* `win-unpacked/`: Standalone unpacked Windows 64-bit application folder containing `PathFlow.exe`, Chromium libraries, and resources.
* `PathFlow Setup 0.1.0.exe`: Standard NSIS per-user installer wizard.
* `PathFlow 0.1.0.exe`: Single-file portable executable.

---

## 5. Storage Architecture & Local Persistence

PathFlow's local-first architecture is completely preserved in the desktop environment:
* **IndexedDB via Dexie.js**: All domain entities (Goals, Roadmaps, Tasks, Sessions, Weekly Plans, and Active Sessions) are persisted directly in IndexedDB (`pathflow_db`).
* **localStorage**: Sync outbox queue (`pathflow_sync_outbox`), auth session tokens (`pathflow_auth_session`), user preferences (`pathflow_user_preferences`), and device identifiers (`pathflow_device_id`) are stored in `window.localStorage`.
* **Zero Database Migration**: Electron does NOT introduce SQLite, files, or a second database. The Chromium engine inside Electron provides native LevelDB-backed IndexedDB and localStorage storage.

### Physical Storage Location on Windows
On Windows 10/11, Electron stores the user profile and IndexedDB databases under:
```
%APPDATA%\PathFlow\
└── IndexedDB\
    └── file__0.indexeddb.leveldb\
```
Data survives application closures, computer reboots, and application updates.

---

## 6. Storage Isolation: Desktop App vs. Web Browser

**The desktop application and web browsers maintain completely separate local storage origins:**
* **Browser Version**: When opened in Google Chrome or Microsoft Edge (e.g. `https://app.pathflow.example`), the browser sandbox isolates IndexedDB to that web origin.
* **Desktop Version**: When running PathFlow as an installed Windows app, Electron uses the dedicated `%APPDATA%\PathFlow` profile.
* **Storage Independence**: Modifying goals or logging sessions in the browser does NOT automatically affect the desktop database locally on disk, and vice versa.

---

## 7. Multi-Device Synchronization Across Desktop and Browser

To synchronize data between the desktop application and web or mobile browser sessions:

1. **Sign In**: In PathFlow Desktop, go to **Settings > Account & Sync** and sign into your student account.
2. **Automatic Push & Pull**:
   * Any local goals, sessions, or tasks created on the desktop app are added to the durable outbox and pushed to the PathFlow Fastify backend.
   * Changes made in the browser version are pulled down to the desktop app automatically.
3. **Conflict Resolution**: PathFlow's built-in 3-way merge and monotonic server sequence resolution ensures seamless convergence across all connected devices.

---

## 8. Offline & Disconnected Behavior

* **Fully Usable Offline**: PathFlow requires **zero internet connection** for all daily operations. Creating goals, editing roadmaps, checking off tasks, running study timers, weekly planning, and generating reports work with 100% functionality offline.
* **Outbox Persistence**: Any mutations created while offline are queued in the durable localStorage outbox. When the application reconnects, mutations are automatically synchronized with the server.
* **No Server Dependency**: The desktop application never blocks user interaction waiting for a server response.

---

## 9. Backend Server Unavailability

If the remote backend is offline or restarting:
* The `SyncStatusBadge` displays `Server unavailable` or `Offline`.
* Error messages are sanitized and non-technical.
* The user can continue working without interruptions or lost data.

---

## 10. Backend URL Configuration

By default, PathFlow Desktop runs in pure local-first mode without assuming any public server exists.

To connect to a server:
1. Open PathFlow Desktop.
2. Go to **Settings > Account & Sync**.
3. Under **Server Configuration**, enter the backend API URL (e.g. `https://api.pathflow.example`).
4. Click **Save Server URL**.
5. The desktop application immediately updates its endpoint and initiates a handshake.

Developers can also bake a default server URL into the build by supplying `VITE_BACKEND_URL` during `npm run desktop:build`:
```bash
VITE_BACKEND_URL=https://api.pathflow.example npm run desktop:package
```

---

## 11. Desktop Wrapper vs. Backend Server Distinction

It is critical to distinguish the desktop app from the backend server:
* **PathFlow Desktop**: A client application running locally on the user's PC. It houses the React UI, Dexie IndexedDB, and the client sync engine. It does NOT run PostgreSQL or the Fastify server locally.
* **PathFlow Backend (Fastify + PostgreSQL)**: An optional central synchronization service hosted in the cloud or on a local network server. It handles multi-device sync deltas, token authentication, and read-only teacher API requests.

---

## 12. Security Model

PathFlow Desktop follows strict Electron security best practices:
1. **Context Isolation**: `contextIsolation: true` is strictly enforced. The renderer cannot access Node.js internals.
2. **No Node Integration**: `nodeIntegration: false`. Web code cannot execute `require('fs')`, `child_process`, or arbitrary operating system commands.
3. **Sandbox Enabled**: `sandbox: true`. The renderer process is sandboxed identically to a normal Chromium tab.
4. **Navigation Restrictions**:
   * The `will-navigate` event prevents malicious redirects away from local app files.
   * `setWindowOpenHandler` blocks unauthorized new windows and opens legitimate external web links in the user's default system browser.
5. **No Bundled Secrets**: The client binary contains zero private database credentials, JWT secrets, or teacher master keys.

---

## 13. Application Identity & Metadata

* **Product Name**: `PathFlow`
* **Application ID**: `com.amir4333.pathflow`
* **Version**: `0.1.0` (derived from `package.json`)
* **Window Dimensions**: 1280x800 default, 1024x700 minimum.
* **Target Architecture**: Windows 10 & 11, 64-bit (`win32-x64`).
* **Installation Mode**: Per-user installation (no UAC / administrator prompt required).

---

## 14. Verification Status

* **Source Compilation**: **Verified**. TypeScript compiles with 0 errors (`tsc --noEmit`).
* **Frontend Production Build**: **Verified**. Vite builds cleanly with relative asset base (`./`).
* **Electron Compilation**: **Verified**. `esbuild` bundles `main.ts` and `preload.ts` into `dist-electron/`.
* **Windows x64 Package Generation**: **Verified**. Electron Builder deterministically produces the standalone Windows x64 package in `dist-electron-packages/win-unpacked` containing `PathFlow.exe`.
* **Physical Windows Execution**: **Pending Windows Environment**. The build and packaging pipeline was executed in a Linux gVisor container; actual execution of `PathFlow.exe` on physical Windows hardware must be verified on a Windows machine.
