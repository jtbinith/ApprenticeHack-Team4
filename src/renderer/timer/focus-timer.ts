// Focus timer state (#52). Either a countdown (timer) from a preset or custom
// length, or a stopwatch that counts up until stopped; both can be paused,
// resumed and stopped. Times are derived from timestamps (not tick counts), so
// the timer stays correct across throttling, sleep and reloads.

import { OTJ_CATEGORIES, type OtjCategory } from '../../shared/types';
import type { TimerSnapshot } from '../../shared/ipc';

export const PRESET_MINUTES = [15, 25, 45] as const;
/** Longest custom countdown, in minutes. */
export const MAX_CUSTOM_MINUTES = 600;

export type TimerMode = 'timer' | 'stopwatch';

export type TimerStatus = TimerSnapshot['status'];

export interface TimerState {
  status: TimerStatus;
  mode: TimerMode;
  /** Countdown length (timer mode): a preset or any custom value. */
  presetMinutes: number;
  /** Focus time banked before the current running stretch. */
  elapsedMs: number;
  /** Epoch ms the current running stretch began; only set while running. */
  resumedAt?: number;
  task: string;
  category: OtjCategory;
}

const STORAGE_KEY = 'canopy.focusTimer';

const DEFAULT_STATE: TimerState = {
  status: 'idle',
  mode: 'timer',
  presetMinutes: 25,
  elapsedMs: 0,
  task: '',
  category: 'Self-study',
};

/** Survive reloads (incl. dev hot reload) without losing a running session. */
function load(): TimerState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && OTJ_CATEGORIES.includes(saved.category)) {
      return { ...DEFAULT_STATE, ...saved };
    }
  } catch {
    // Corrupt or unavailable storage — start fresh.
  }
  return { ...DEFAULT_STATE };
}

export class FocusTimer {
  private state: TimerState = load();
  private listeners = new Set<(state: Readonly<TimerState>) => void>();

  get current(): Readonly<TimerState> {
    return this.state;
  }

  get durationMs(): number {
    return this.state.presetMinutes * 60_000;
  }

  elapsedMs(now = Date.now()): number {
    const { elapsedMs, resumedAt, status } = this.state;
    const running = status === 'running' && resumedAt ? now - resumedAt : 0;
    const total = elapsedMs + running;
    return this.state.mode === 'timer'
      ? Math.min(this.durationMs, total)
      : total;
  }

  remainingMs(now = Date.now()): number {
    return this.durationMs - this.elapsedMs(now);
  }

  /** What the clock shows: time left (timer) or time so far (stopwatch). */
  displayMs(now = Date.now()): number {
    return this.state.mode === 'timer'
      ? this.remainingMs(now)
      : this.elapsedMs(now);
  }

  /** A countdown that has reached zero. Stopwatches never finish. */
  isFinished(now = Date.now()): boolean {
    return this.state.mode === 'timer' && this.remainingMs(now) <= 0;
  }

  subscribe(listener: (state: Readonly<TimerState>) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setPreset(minutes: number): void {
    const clamped = Math.min(
      MAX_CUSTOM_MINUTES,
      Math.max(1, Math.round(minutes)),
    );
    if (this.state.status === 'idle' && Number.isFinite(clamped)) {
      this.set({ presetMinutes: clamped });
    }
  }

  setMode(mode: TimerMode): void {
    if (this.state.status === 'idle') this.set({ mode });
  }

  setTask(task: string): void {
    this.set({ task });
  }

  setCategory(category: OtjCategory): void {
    this.set({ category });
  }

  start(): void {
    if (this.state.status === 'running' || this.isFinished()) return;
    this.set({ status: 'running', resumedAt: Date.now() });
  }

  pause(): void {
    if (this.state.status !== 'running') return;
    this.set({
      status: 'paused',
      elapsedMs: this.elapsedMs(),
      resumedAt: undefined,
    });
  }

  toggle(): void {
    if (this.state.status === 'running') this.pause();
    else this.start();
  }

  /** Pause and drop the last `seconds` of focus time (user was away). */
  pauseForIdle(seconds: number): void {
    if (this.state.status !== 'running') return;
    this.set({
      status: 'paused',
      elapsedMs: Math.max(0, this.elapsedMs() - seconds * 1000),
      resumedAt: undefined,
    });
  }

  /** Back to a fresh clock, keeping the mode, task, category and preset. */
  reset(): void {
    this.set({ status: 'idle', elapsedMs: 0, resumedAt: undefined });
  }

  private set(patch: Partial<TimerState>): void {
    this.state = { ...this.state, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage full/unavailable — the timer still works in memory.
    }
    window.canopy.timerState(this.snapshot());
    this.listeners.forEach((listener) => listener(this.state));
  }

  snapshot(): TimerSnapshot {
    const now = Date.now();
    return {
      status: this.state.status,
      countUp: this.state.mode === 'stopwatch',
      clockMs: this.displayMs(now),
      at: now,
      task: this.state.task,
    };
  }
}
