const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('remote-debugging-address', '0.0.0.0');
app.commandLine.appendSwitch('remote-debugging-port', '9222');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.on('ready', () => {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    // The Fullscreen API hangs on an unmapped window, so show it. Under Xvfb
    // there is no display to see it on, so this stays effectively headless.
    show: true,
    webPreferences: { offscreen: false },
  });
  win.loadURL('about:blank');
  win.webContents.on('did-finish-load', () => {});
});

// Keep the process alive with no visible windows.
app.on('window-all-closed', () => {});
