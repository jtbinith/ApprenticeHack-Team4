// Typed bridge between renderer and main. To add a capability:
//   1. add a channel + method here,
//   2. handle it in src/main.ts (ipcMain.handle),
//   3. expose it in src/preload.ts.
// The renderer then calls `window.canopy.<method>()`.

export const IPC = {
  appInfo: 'app:info',
  notify: 'app:notify',
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform;
}

export interface CanopyApi {
  appInfo(): Promise<AppInfo>;
  /** Native OS notification (e.g. focus timer finished, review due). */
  notify(title: string, body: string): Promise<void>;
}

declare global {
  interface Window {
    canopy: CanopyApi;
  }
}
