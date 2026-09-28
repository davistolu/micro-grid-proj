const { app, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Register all IPC handlers and session event listeners.
 * @param {Electron.BrowserWindow} mainWindow
 */
function registerIpcHandlers(mainWindow) {
  // App info
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:get-system-info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
    };
  });

  // Shell external links (strictly validates protocol)
  ipcMain.handle('shell:open-external', async (event, targetUrl) => {
    if (typeof targetUrl !== 'string') return false;
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        await shell.openExternal(targetUrl);
        return true;
      }
    } catch (err) {
      console.error('[ipc] Invalid external URL:', targetUrl);
    }
    return false;
  });

  // Reveal item in folder
  ipcMain.handle('shell:show-item', async (event, fullPath) => {
    if (typeof fullPath === 'string' && fs.existsSync(fullPath)) {
      shell.showItemInFolder(fullPath);
      return true;
    }
    return false;
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
  });

  ipcMain.handle('window:is-maximized', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow.isMaximized();
    }
    return false;
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  // Session downloads configuration
  if (mainWindow && mainWindow.webContents && mainWindow.webContents.session) {
    mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
      const fileName = item.getFilename();
      console.log(`[download] Initiating download: ${fileName}`);

      item.once('done', (event, state) => {
        if (state === 'completed') {
          const savePath = item.getSavePath();
          console.log(`[download] Download completed: ${fileName} -> ${savePath}`);
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download:completed', {
              filename: fileName,
              path: savePath,
            });
          }
        } else {
          console.warn(`[download] Download failed with state: ${state} (${fileName})`);
        }
      });
    });
  }
}

module.exports = {
  registerIpcHandlers,
};
