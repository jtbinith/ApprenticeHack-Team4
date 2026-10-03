// Runs before the renderer with access to ipcRenderer; exposes only the typed API.
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CanopyApi } from './shared/ipc';

const api: CanopyApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  notify: (title, body) => ipcRenderer.invoke(IPC.notify, title, body),
  openFile: (name, data) => ipcRenderer.invoke(IPC.openFile, name, data),
};

contextBridge.exposeInMainWorld('canopy', api);
