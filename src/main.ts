import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import { rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
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

  // Open web links (e.g. evidence links) in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow reloading the app itself (e.g. dev hot reload), never other pages or dropped files.
    try {
      const appUrl = new URL(mainWindow.webContents.getURL());
      const target = new URL(url);
      if (
        target.origin === appUrl.origin &&
        target.pathname === appUrl.pathname
      )
        return;
    } catch {
      // Unparseable URL: fall through and block it.
    }
    event.preventDefault();
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });

  if (process.env.CANOPY_DEVTOOLS) {
    mainWindow.webContents.openDevTools();
  }

  // CANOPY_SCREENSHOT=out.png npm start → saves a screenshot and quits (for PRs/docs).
  const screenshotPath = process.env.CANOPY_SCREENSHOT;
  if (screenshotPath) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(
        async () => {
          const image = await mainWindow.webContents.capturePage();
          await fs.writeFile(screenshotPath, image.toPNG());
          app.quit();
        },
        Number(process.env.CANOPY_SCREENSHOT_DELAY ?? 2000),
      );
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

// Evidence files live in IndexedDB; to open one we write a temporary copy and
// hand it to the OS. Copies are removed when the app quits.
const openedFilesDir = path.join(os.tmpdir(), `canopy-files-${process.pid}`);

ipcMain.handle(
  IPC.openFile,
  async (_event, name: string, data: ArrayBuffer) => {
    const safeName = path.basename(name).replace(/[^\w.\- ()]/g, '_') || 'file';
    await fs.mkdir(openedFilesDir, { recursive: true });
    const filePath = path.join(openedFilesDir, `${Date.now()}-${safeName}`);
    await fs.writeFile(filePath, Buffer.from(data));
    const error = await shell.openPath(filePath);
    if (error) throw new Error(error);
  },
);

app.on('will-quit', () => {
  rmSync(openedFilesDir, { recursive: true, force: true });
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
