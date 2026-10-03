// Focus timer card in the right column (#52), per the design: presets
// 15 / 25 / 45 min (or any custom length), reset, start / pause / stop,
// task + OTJ category. Also works as a stopwatch that counts up.

import './timer.css';
import { OTJ_CATEGORIES, type OtjCategory } from '../../shared/types';
import { formatClock } from '../../shared/time';
import {
  FocusTimer,
  MAX_CUSTOM_MINUTES,
  PRESET_MINUTES,
  type TimerMode,
  type TimerState,
} from './focus-timer';
import { openLogDialog } from './log-dialog';

const SHORTCUT_LABEL = navigator.platform.startsWith('Mac')
  ? '⌘⌥⇧F'
  : 'Ctrl+Alt+Shift+F';

const ICON_CLOCK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const ICON_RESET = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;

export function mountFocusTimer(root: HTMLElement): FocusTimer {
  const timer = new FocusTimer();

  root.innerHTML = `
    <div class="timer-head">
      <span class="timer-title">${ICON_CLOCK} Focus timer</span>
      <button class="icon-btn" data-ref="reset" title="Reset timer" aria-label="Reset timer">${ICON_RESET}</button>
    </div>
    <div class="timer-modes" role="group" aria-label="Mode">
      <button class="mode" data-mode="timer">Timer</button>
      <button class="mode" data-mode="stopwatch">Stopwatch</button>
    </div>
    <div class="timer-clock" data-ref="clock" role="timer" aria-live="off"></div>
    <div class="timer-presets" data-ref="presets" role="group" aria-label="Session length">
      ${PRESET_MINUTES.map((m) => `<button class="preset" data-minutes="${m}">${m} min</button>`).join('')}
      <input class="preset preset-custom" data-ref="custom" type="number" min="1" max="${MAX_CUSTOM_MINUTES}" step="1" placeholder="Custom" title="Custom length in minutes (press Enter)" aria-label="Custom length in minutes" />
    </div>
    <div class="timer-fields">
      <input class="timer-input" data-ref="task" placeholder="What are you working on?" maxlength="120" aria-label="Task" />
      <select class="timer-input" data-ref="category" aria-label="OTJ category">
        ${OTJ_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}
      </select>
    </div>
    <div class="timer-actions">
      <button class="btn-primary btn-start" data-ref="toggle" title="Start / pause (${SHORTCUT_LABEL})"></button>
      <button class="btn-outline btn-stop" data-ref="stop" title="Stop and log as OTJ">${ICON_STOP} Stop</button>
    </div>`;

  const ref = <T extends HTMLElement>(name: string) =>
    root.querySelector(`[data-ref="${name}"]`) as T;
  const clock = ref<HTMLElement>('clock');
  const taskInput = ref<HTMLInputElement>('task');
  const categorySelect = ref<HTMLSelectElement>('category');
  const toggleBtn = ref<HTMLButtonElement>('toggle');
  const stopBtn = ref<HTMLButtonElement>('stop');
  const resetBtn = ref<HTMLButtonElement>('reset');
  const presets = root.querySelectorAll<HTMLButtonElement>('button.preset');
  const presetRow = ref<HTMLElement>('presets');
  const customInput = ref<HTMLInputElement>('custom');
  const modes = root.querySelectorAll<HTMLButtonElement>('.mode');

  let dialogOpen = false;

  const stop = () => {
    if (dialogOpen || timer.current.status === 'idle') return;
    timer.pause();
    dialogOpen = true;
    const { task, category } = timer.current;
    openLogDialog(
      {
        task,
        category,
        minutes: Math.max(1, Math.round(timer.elapsedMs() / 60_000)),
      },
      {
        onLogged: () => {
          dialogOpen = false;
          timer.reset();
        },
        onDiscard: () => {
          dialogOpen = false;
          timer.reset();
        },
        onBack: () => {
          dialogOpen = false;
        },
      },
    );
  };

  const finish = () => {
    timer.pause();
    const { presetMinutes, task } = timer.current;
    window.canopy.notify(
      'Focus session complete',
      `${presetMinutes} min${task ? ` on “${task}”` : ''} — log it as OTJ time.`,
    );
    stop();
  };

  const renderClock = () => {
    clock.textContent = formatClock(
      timer.displayMs(),
      timer.current.mode === 'timer',
    );
  };

  let ticker: ReturnType<typeof setInterval> | undefined;

  const render = (state: Readonly<TimerState>) => {
    const active = state.status !== 'idle';
    root.dataset.status = state.status;
    root.dataset.mode = state.mode;
    renderClock();
    modes.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mode === state.mode);
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === state.mode));
      btn.disabled = active;
    });
    presetRow.hidden = state.mode === 'stopwatch';
    const isPreset = (PRESET_MINUTES as readonly number[]).includes(
      state.presetMinutes,
    );
    presets.forEach((btn) => {
      btn.classList.toggle(
        'is-active',
        Number(btn.dataset.minutes) === state.presetMinutes,
      );
      btn.disabled = active;
    });
    customInput.classList.toggle('is-active', !isPreset);
    customInput.disabled = active;
    if (document.activeElement !== customInput) {
      customInput.value = isPreset ? '' : String(state.presetMinutes);
    }
    if (document.activeElement !== taskInput) taskInput.value = state.task;
    categorySelect.value = state.category;
    toggleBtn.innerHTML =
      state.status === 'running'
        ? `${ICON_PAUSE} Pause`
        : state.status === 'paused'
          ? `${ICON_PLAY} Resume`
          : `${ICON_PLAY} Start focus`;
    stopBtn.hidden = !active;
    resetBtn.disabled = !active;

    clearInterval(ticker);
    ticker = undefined;
    if (state.status === 'running') {
      ticker = setInterval(() => {
        if (timer.isFinished()) finish();
        else renderClock();
      }, 250);
    }
  };

  presets.forEach((btn) =>
    btn.addEventListener('click', () =>
      timer.setPreset(Number(btn.dataset.minutes)),
    ),
  );
  modes.forEach((btn) =>
    btn.addEventListener('click', () =>
      timer.setMode(btn.dataset.mode as TimerMode),
    ),
  );
  customInput.addEventListener('change', () => {
    if (customInput.value) timer.setPreset(Number(customInput.value));
    else render(timer.current);
  });
  customInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') customInput.blur();
  });
  taskInput.addEventListener('input', () => timer.setTask(taskInput.value));
  categorySelect.addEventListener('change', () =>
    timer.setCategory(categorySelect.value as OtjCategory),
  );
  toggleBtn.addEventListener('click', () => timer.toggle());
  stopBtn.addEventListener('click', stop);
  resetBtn.addEventListener('click', () => timer.reset());

  window.canopy.onTimerCommand((command) => {
    if (command.type === 'toggle' && !dialogOpen) timer.toggle();
    if (command.type === 'stop') stop();
    if (command.type === 'idle' && timer.current.status === 'running') {
      timer.pauseForIdle(command.idleSeconds);
      window.canopy.notify(
        'Focus timer paused',
        command.idleSeconds > 0
          ? `You were away for ${Math.round(command.idleSeconds / 60)} min — that time wasn't counted.`
          : 'Paused while your screen was locked.',
      );
    }
  });

  timer.subscribe(render);
  // Sync main (tray) with any session restored from a previous run.
  window.canopy.timerState(timer.snapshot());
  // A countdown that ran out while the app was closed goes straight to logging.
  if (timer.current.status === 'running' && timer.isFinished()) finish();

  return timer;
}
