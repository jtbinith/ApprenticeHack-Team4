import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { IPC, type AppInfo } from './shared/ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Canopy',
    backgroundColor: '#f2f3e7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
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
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await mainWindow.webContents.capturePage();
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

  // On macOS it's common to re-create a window when the dock icon is clicked.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS (apps stay active until Cmd + Q).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
