const { contextBridge, ipcRenderer } = require('electron');

/**
 * Securely expose safe Electron APIs to the renderer process.
 * Node integration is disabled and context isolation is enabled.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getSystemInfo: () => ipcRenderer.invoke('app:get-system-info'),

  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('shell:show-item', fullPath),

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  onDownloadFeedback: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download:completed', subscription);
    return () => ipcRenderer.removeListener('download:completed', subscription);
  },
});
