import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { IPC, type AppInfo } from './shared/ipc';
import { setupFocusTimer, teardownFocusTimer } from './main/focus-timer';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Canopy',
    backgroundColor: '#f2f3e7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // Keep the focus timer ticking accurately while the window is hidden.
      backgroundThrottling: false,
    },
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (process.env.CANOPY_DEVTOOLS) {
    mainWindow.webContents.openDevTools();
  }

  // CANOPY_SCREENSHOT=out.png npm start → saves a screenshot and quits (for PRs/docs).
  const screenshotPath = process.env.CANOPY_SCREENSHOT;
  if (screenshotPath) {
    const win = mainWindow;
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        await fs.writeFile(screenshotPath, image.toPNG());
        app.quit();
      }, 2000);
    });
  }
};

ipcMain.handle(
  IPC.appInfo,
  (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
  }),
);

ipcMain.handle(IPC.notify, (_event, title: string, body: string) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

app.whenReady().then(() => {
  createWindow();
  setupFocusTimer(() => mainWindow);

  // On macOS it's common to re-create a window when the dock icon is clicked.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', teardownFocusTimer);

// Quit when all windows are closed, except on macOS (apps stay active until Cmd + Q).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
