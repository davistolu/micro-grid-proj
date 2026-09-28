const { app, Menu, dialog, shell } = require('electron');

/**
 * Builds and sets the application menu.
 * @param {Electron.BrowserWindow} mainWindow
 * @param {string} serverOrigin
 */
function setupApplicationMenu(mainWindow, serverOrigin) {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: '&File',
      submenu: [
        {
          label: 'E&xit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '&Navigation',
      submenu: [
        {
          label: 'Simulator Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`${serverOrigin}/`);
            }
          },
        },
        {
          label: 'Documentation & Guide',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`${serverOrigin}/docs`);
            }
          },
        },
      ],
    },
    {
      label: '&Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Open Documentation',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`${serverOrigin}/docs`);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'About Microgrid EMS Laboratory',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Microgrid EMS Laboratory',
              message: 'Microgrid EMS Laboratory',
              detail: `Version: ${app.getVersion()}\n` +
                'Research-grade Solar-Diesel-Battery Microgrid Simulation Workstation.\n\n' +
                `Electron: ${process.versions.electron}\n` +
                `Chromium: ${process.versions.chrome}\n` +
                `Node: ${process.versions.node}`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  setupApplicationMenu,
};
