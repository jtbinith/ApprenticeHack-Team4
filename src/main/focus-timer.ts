// Focus timer OS integration (#52): tray clock, global shortcut and idle
// auto-pause. The timer itself lives in the renderer (src/renderer/timer/);
// it pushes a TimerSnapshot here and we send TimerCommands back.

import {
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  Tray,
  type BrowserWindow,
} from 'electron';
import iconUrl from '../../assets/icon.png';
import { formatClock } from '../shared/time';
import { IPC, type TimerCommand, type TimerSnapshot } from '../shared/ipc';

/** Start / pause the timer from anywhere. */
export const TIMER_SHORTCUT = 'CommandOrControl+Alt+Shift+F';

/** Auto-pause after this long without keyboard / mouse input. */
const IDLE_LIMIT_SECONDS = 5 * 60;

let tray: Tray | null = null;
let snapshot: TimerSnapshot = {
  status: 'idle',
  countUp: false,
  clockMs: 0,
  at: 0,
  task: '',
};
let tick: ReturnType<typeof setInterval> | undefined;
let lastMenuStatus: TimerSnapshot['status'] | undefined;

function clockMs(): number {
  if (snapshot.status !== 'running') return snapshot.clockMs;
  const passed = Date.now() - snapshot.at;
  return snapshot.countUp
    ? snapshot.clockMs + passed
    : snapshot.clockMs - passed;
}

export function setupFocusTimer(getWindow: () => BrowserWindow | null): void {
  const send = (command: TimerCommand) =>
    getWindow()?.webContents.send(IPC.timerCommand, command);

  const showWindow = () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };

  const icon = nativeImage
    .createFromDataURL(iconUrl)
    .resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.on('click', showWindow);

  const buildMenu = () => {
    const active = snapshot.status !== 'idle';
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: active ? `Focus: ${snapshot.task || 'untitled'}` : 'Canopy',
          enabled: false,
        },
        { type: 'separator' },
        {
          label:
            snapshot.status === 'running'
              ? 'Pause focus'
              : snapshot.status === 'paused'
                ? 'Resume focus'
                : 'Start focus',
          accelerator: TIMER_SHORTCUT,
          click: () => send({ type: 'toggle' }),
        },
        {
          label: 'Stop & log…',
          enabled: active,
          click: () => {
            showWindow();
            send({ type: 'stop' });
          },
        },
        { type: 'separator' },
        { label: 'Show Canopy', click: showWindow },
      ]),
    );
    lastMenuStatus = snapshot.status;
  };

  const render = () => {
    if (!tray) return;
    const clock = formatClock(clockMs(), !snapshot.countUp);
    const label =
      snapshot.status === 'idle'
        ? ''
        : `${snapshot.status === 'paused' ? '⏸ ' : ''}${clock}`;
    // Title shows next to the icon on macOS; tooltip is the fallback on Linux.
    tray.setTitle(label ? ` ${label}` : '');
    tray.setToolTip(
      snapshot.status === 'idle'
        ? 'Canopy — focus timer ready'
        : `Canopy — ${label} ${snapshot.task}`.trim(),
    );
    if (snapshot.status !== lastMenuStatus) buildMenu();

    // P2: idle detection — pause if the user walked away mid-session.
    if (snapshot.status === 'running') {
      const idleSeconds = powerMonitor.getSystemIdleTime();
      if (idleSeconds >= IDLE_LIMIT_SECONDS)
        send({ type: 'idle', idleSeconds });
    }
  };

  ipcMain.on(IPC.timerState, (_event, next: TimerSnapshot) => {
    snapshot = next;
    clearInterval(tick);
    tick = undefined;
    if (snapshot.status === 'running') tick = setInterval(render, 1000);
    render();
  });

  // Locking the screen or sleeping counts as stepping away.
  const pauseForAway = () => {
    if (snapshot.status === 'running') send({ type: 'idle', idleSeconds: 0 });
  };
  powerMonitor.on('lock-screen', pauseForAway);
  powerMonitor.on('suspend', pauseForAway);

  if (
    !globalShortcut.register(TIMER_SHORTCUT, () => send({ type: 'toggle' }))
  ) {
    console.warn(`Focus timer: could not register ${TIMER_SHORTCUT}`);
  }

  render();
}

export function teardownFocusTimer(): void {
  clearInterval(tick);
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
}
