const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { startStaticServer } = require('./server');
const { registerIpcHandlers } = require('./ipc');
const { setupApplicationMenu } = require('./menu');

let mainWindow = null;
let staticServerInstance = null;

// Determine environment
const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.ELECTRON_FORCE_DEV === '1');
const devServerUrl = process.env.ELECTRON_DEV_URL || null;

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[main] Another instance is already running. Exiting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Resolves the directory containing the static web files.
 */
function getRendererPath() {
  const possiblePaths = [
    path.join(__dirname, '..', 'renderer'),
    path.join(process.resourcesPath, 'renderer'),
    path.join(process.resourcesPath, 'app.asar', 'renderer'),
    path.join(app.getAppPath(), 'renderer'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      return p;
    }
  }

  // Default fallback
  return path.join(__dirname, '..', 'renderer');
}

/**
 * Resolves the application icon file for the current platform.
 */
function getAppIcon() {
  const buildDir = path.join(__dirname, '..', 'build');
  if (process.platform === 'win32') {
    const ico = path.join(buildDir, 'icon.ico');
    if (fs.existsSync(ico)) return ico;
  }
  const png = path.join(buildDir, 'icon.png');
  if (fs.existsSync(png)) return png;
  return undefined;
}

async function createWindow() {
  const iconPath = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a1118',
    show: false,
    autoHideMenuBar: false,
    icon: iconPath,
    title: 'Microgrid EMS Laboratory',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Reveal window smoothly when DOM is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev && process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools();
    }
  });

  // Register IPC handlers
  registerIpcHandlers(mainWindow);

  let targetUrl = '';

  if (devServerUrl) {
    targetUrl = devServerUrl;
    console.log(`[main] Loading dev server: ${targetUrl}`);
  } else {
    const rendererPath = getRendererPath();
    console.log(`[main] Initializing static server for: ${rendererPath}`);

    try {
      staticServerInstance = await startStaticServer(rendererPath);
      targetUrl = staticServerInstance.origin;
    } catch (err) {
      console.error('[main] Failed to start embedded server:', err);
      dialog.showErrorBox(
        'Server Initialization Error',
        `Could not initialize the internal application server: ${err.message}`
      );
      app.quit();
      return;
    }
  }

  // Setup application menu
  setupApplicationMenu(mainWindow, targetUrl);

  // Security: Restrict navigation to internal origin
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedTarget = new URL(navigationUrl);
      const parsedOrigin = new URL(targetUrl);

      if (parsedTarget.origin !== parsedOrigin.origin) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch (e) {
      event.preventDefault();
    }
  });

  // Security: Intercept window.open calls to open external URLs in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Error recovery & stability handling
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[main] Renderer process gone: ${details.reason} (exitCode: ${details.exitCode})`);
    if (details.reason !== 'clean-exit') {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Renderer Error',
        message: 'The application window encountered an unexpected error.',
        detail: `Reason: ${details.reason}. Reloading page...`,
        buttons: ['Reload', 'Close'],
      }).then(({ response }) => {
        if (response === 0) {
          mainWindow.reload();
        } else {
          mainWindow.close();
        }
      });
    }
  });

  mainWindow.on('unresponsive', () => {
    console.warn('[main] Window is temporarily unresponsive.');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load application
  await mainWindow.loadURL(targetUrl);
}

// Global lifecycle handling
app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (staticServerInstance && staticServerInstance.close) {
    try {
      await staticServerInstance.close();
      console.log('[main] Embedded server stopped.');
    } catch (err) {
      console.error('[main] Error closing embedded server:', err);
    }
  }
});

// Process-level unhandled errors
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled Rejection:', reason);
});
