// Typed bridge between renderer and main. To add a capability:
//   1. add a channel + method here,
//   2. handle it in src/main.ts (ipcMain.handle),
//   3. expose it in src/preload.ts.
// The renderer then calls `window.canopy.<method>()`.

export const IPC = {
  appInfo: 'app:info',
  notify: 'app:notify',
  openFile: 'file:open',
  timerState: 'timer:state',
  timerCommand: 'timer:command',
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform;
}

/** What main needs to know about the focus timer (tray, idle detection). */
export interface TimerSnapshot {
  status: 'idle' | 'running' | 'paused';
  /** Stopwatch (counts up) vs timer (counts down). */
  countUp: boolean;
  /** What the clock showed at `at`; while running it moves 1s per second. */
  clockMs: number;
  /** Epoch ms the snapshot was taken. */
  at: number;
  task: string;
}

/** Commands main sends to the focus timer (tray menu, global shortcut, idle). */
export type TimerCommand =
  | { type: 'toggle' }
  | { type: 'stop' }
  /** Auto-pause: the user has been away for `idleSeconds` (0 = screen locked / sleep). */
  | { type: 'idle'; idleSeconds: number };

export interface CanopyApi {
  appInfo(): Promise<AppInfo>;
  /** Native OS notification (e.g. focus timer finished, review due). */
  notify(title: string, body: string): Promise<void>;
  /** Open a locally stored file (e.g. a PDF evidence) in the system's default app. */
  openFile(name: string, data: ArrayBuffer): Promise<void>;
  /** Push the focus timer state to main (tray countdown, idle detection). */
  timerState(snapshot: TimerSnapshot): void;
  /** Subscribe to timer commands from main. Returns an unsubscribe function. */
  onTimerCommand(listener: (command: TimerCommand) => void): () => void;
}

declare global {
  interface Window {
    canopy: CanopyApi;
  }
}
