// Runs before the renderer with access to ipcRenderer; exposes only the typed API.
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type CanopyApi, type TimerCommand } from './shared/ipc';

const api: CanopyApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  notify: (title, body) => ipcRenderer.invoke(IPC.notify, title, body),
  timerState: (snapshot) => ipcRenderer.send(IPC.timerState, snapshot),
  onTimerCommand: (listener) => {
    const handler = (_event: IpcRendererEvent, command: TimerCommand) =>
      listener(command);
    ipcRenderer.on(IPC.timerCommand, handler);
    return () => ipcRenderer.removeListener(IPC.timerCommand, handler);
  },
};

contextBridge.exposeInMainWorld('canopy', api);
