# Microgrid EMS Laboratory - Desktop Application

Production-ready Electron desktop wrapper for the **Microgrid EMS Laboratory** simulation workstation.

This application packages the research-grade solar–diesel–battery microgrid simulation suite into a native Windows desktop application with installer and portable executable support, preserving 100% of the frontend components, styles, numerical simulation engine, and academic report generators.

---

## Architecture Overview

The desktop application lives completely independently in the `/desktop-app` directory and does not alter the original web application codebase:

```
/desktop-app
├── electron/
│   ├── main.js              # Application lifecycle, native window management & security
│   ├── preload.js           # Secure contextBridge API for desktop capabilities
│   ├── ipc.js               # IPC channel handlers and download listener
│   ├── server.js            # Zero-dependency embedded loopback HTTP server for Next.js static export
│   └── menu.js              # Native application menu (File, Edit, View, Navigation, Help)
├── build/
│   ├── icon.ico             # Windows multi-resolution icon (16, 32, 48, 64, 128, 256px)
│   └── icon.png             # 256x256 high-resolution icon
├── scripts/
│   ├── dev.js               # Development orchestrator (Next.js dev server + Electron)
│   ├── prepare-renderer.js  # Staging script copying static export from /out to /renderer
│   └── generate-icons.ps1   # PowerShell icon generation utility
├── renderer/                # Staged static web application build
├── package.json             # Desktop package manifest with Electron & electron-builder
├── electron-builder.yml     # Packaging configuration for Windows NSIS and portable targets
└── README.md                # Desktop documentation
```

### Static Asset & Routing Architecture
Next.js static export (`output: 'export'`) emits pre-rendered HTML files (`index.html`, `docs.html`) and static chunks (`/_next/static/...`).

Rather than using fragile `file://` URLs—which break client-side routing, relative chunk loading, and direct page refreshes—the desktop application runs a lightweight, embedded loopback server on `127.0.0.1` inside Electron's main process:
- Exact MIME type resolution for `.js`, `.css`, `.json`, `.png`, `.svg`, `.woff2`, `.docx`, `.m`, `.csv`.
- Automatic routing rewrites (`/docs` -> `docs.html`), ensuring direct URL navigation and `F5` / `Ctrl+R` reloads never 404.
- Binds strictly to `127.0.0.1` (inaccessible over the local area network).

---

## Security Model

The desktop application complies with Electron's official security recommendations:
- **`contextIsolation: true`**: The preload script executes in an isolated context.
- **`nodeIntegration: false`**: Node.js APIs are completely inaccessible from the renderer.
- **`sandbox: true`**: Chromium sandboxing is enforced.
- **Scoped Preload Bridge**: Safe APIs are exposed via `window.electronAPI`.
- **Navigation Guard**: Intercepts `will-navigate` and `setWindowOpenHandler` so external links open safely in the user's default browser via `shell.openExternal()`.

---

## Quick Start & Commands

Commands can be run from the root project or directly inside `/desktop-app`.

### From Root Project:
| Command | Description |
|---|---|
| `pnpm run desktop:dev` | Launches Next.js dev server and attaches Electron with live reload |
| `pnpm run desktop:build` | Builds web app (`pnpm run build`) and stages assets into `desktop-app/renderer/` |
| `pnpm run desktop:package` | Builds web app, stages assets, and generates Windows installer and portable `.exe` in `desktop-app/dist/` |
| `pnpm run desktop:package:dir` | Builds unpacked directory (`desktop-app/dist/win-unpacked/`) for fast local testing |

### From `/desktop-app` Directory:
| Command | Description |
|---|---|
| `pnpm install` | Installs Electron and electron-builder |
| `pnpm run dev` | Runs the development launcher |
| `pnpm run build` | Syncs latest static export into `renderer/` |
| `pnpm run package` | Builds Windows NSIS installer and portable executable |
| `pnpm run package:dir` | Builds unpacked Windows executable directory |

---

## Output Binaries

Packaged desktop artifacts are generated in `desktop-app/dist/`:
- **Installer**: `Microgrid-EMS-Laboratory-Setup-1.0.0.exe` (NSIS setup wizard with desktop & start menu shortcuts)
- **Portable**: `Microgrid-EMS-Laboratory-Portable-1.0.0.exe` (standalone executable requiring no installation)
- **Unpacked**: `win-unpacked/Microgrid EMS Laboratory.exe` (direct executable for quick testing)
