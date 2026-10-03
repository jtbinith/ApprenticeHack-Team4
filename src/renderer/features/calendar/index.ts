// Calendar tab (#49): month grid (default) and week time-grid.
// Shows calendar activities plus logged OTJ sessions from the focus timer.

import './calendar.css';
import { db } from '../../db';
import { toLocalDateTime } from '../../seed';
import { registerView } from '../../shell/router';
import { openDialog } from '../../ui/dialog';
import { escapeHtml } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { Activity, ActivityKind } from '../../../shared/types';
import {
  DAY_MS,
  WEEKDAYS,
  addDays,
  addMonths,
  dayKey,
  formatLongDay,
  formatMonth,
  formatWeekRange,
  isSameDay,
  monthGrid,
  startOfDay,
  startOfWeek,
  timeOf,
} from './dates';
import { openEntryDialog } from './entry-dialog';
import { KINDS } from './kinds';

/** Fired by the focus timer (#52) after an OTJ session is logged. */
const OTJ_LOGGED_EVENT = 'canopy:otj-logged';

type ViewMode = 'month' | 'week';

interface CalEvent {
  id: string;
  title: string;
  kind: ActivityKind;
  start: Date;
  end: Date;
  /** Set for editable calendar entries; OTJ sessions are read-only here. */
  activity?: Activity;
}

/** Pills shown per month cell before collapsing into "+N more". */
const MAX_PILLS = 3;
/** Week grid: default visible hours (widened to fit earlier/later events). */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19;
const HOUR_PX = 52;

// Kept at module level so the view and date survive tab switches.
const state: { mode: ViewMode; anchor: Date } = {
  mode: 'month',
  anchor: startOfDay(new Date()),
};

let root: HTMLElement | null = null;
let currentEvents: CalEvent[] = [];
let renderToken = 0;

export function registerCalendar() {
  registerView('calendar', {
    eyebrow: 'Your learning calendar',
    title: 'Calendar',
    customHeader: true,
    mount(container) {
      container.innerHTML = '<div class="cal"></div>';
      root = container.querySelector('.cal') as HTMLElement;
      root.addEventListener('click', onClick);
      const refresh = () => void render();
      window.addEventListener(OTJ_LOGGED_EVENT, refresh);
      void render();
      return () => {
        window.removeEventListener(OTJ_LOGGED_EVENT, refresh);
        root = null;
      };
    },
  });
}

function visibleRange(): { from: Date; to: Date; days: Date[] } {
  if (state.mode === 'month') {
    const days = monthGrid(state.anchor);
    return { from: days[0], to: addDays(days[days.length - 1], 1), days };
  }
  const from = startOfWeek(state.anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return { from, to: addDays(from, 7), days };
}

async function loadEvents(from: Date, to: Date): Promise<CalEvent[]> {
  const [activities, sessions] = await Promise.all([
    db.activities
      .where('start')
      .between(toLocalDateTime(from), toLocalDateTime(to), true, false)
      .toArray(),
    db.otjSessions
      .where('endedAt')
      .between(from.toISOString(), to.toISOString(), true, false)
      .toArray(),
  ]);
  const events: CalEvent[] = activities.map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    start: new Date(a.start),
    end: new Date(a.end),
    activity: a,
  }));
  for (const s of sessions) {
    const end = new Date(s.endedAt);
    events.push({
      id: s.id,
      title: s.task || `${s.category} session`,
      kind: 'otj',
      start: new Date(end.getTime() - s.minutes * 60_000),
      end,
    });
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function groupByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = dayKey(e.start);
    const list = byDay.get(key) ?? [];
    list.push(e);
    byDay.set(key, list);
  }
  return byDay;
}

async function render(): Promise<void> {
  if (!root?.isConnected) return;
  const token = ++renderToken;
  const { from, to, days } = visibleRange();
  const events = await loadEvents(from, to);
  if (token !== renderToken || !root.isConnected) return;

  const title =
    state.mode === 'month'
      ? formatMonth(state.anchor)
      : formatWeekRange(startOfWeek(state.anchor));

  root.innerHTML = `
    <header class="cal-head">
      <div>
        <div class="eyebrow">Your learning calendar</div>
        <h1 class="view-title">${title}</h1>
      </div>
      <div class="cal-controls">
        <div class="cal-toggle" role="group" aria-label="Calendar view">
          <button type="button" data-mode="month" aria-pressed="${state.mode === 'month'}">Month</button>
          <button type="button" data-mode="week" aria-pressed="${state.mode === 'week'}">Week</button>
        </div>
        <button type="button" class="btn btn-secondary" data-nav="today">Today</button>
        <div class="btn-group">
          <button type="button" class="btn btn-secondary btn-icon" data-nav="prev" aria-label="Previous ${state.mode}">${icon('chevron-left')}</button>
          <button type="button" class="btn btn-secondary btn-icon" data-nav="next" aria-label="Next ${state.mode}">${icon('chevron-right')}</button>
        </div>
        <button type="button" class="btn btn-primary" data-action="add">${icon('plus')}Add entry</button>
      </div>
    </header>
    <div class="cal-body">
      ${state.mode === 'month' ? monthHtml(days, events) : weekHtml(days, events)}
    </div>
    <footer class="cal-legend">
      ${KINDS.map(
        (k) =>
          `<span class="cal-legend-item"><span class="dot dot--${k.kind}"></span>${k.label}</span>`,
      ).join('')}
    </footer>`;

  currentEvents = events;
  if (state.mode === 'week') scrollWeekToMorning(root);
}

// ---- Month -----------------------------------------------------------------

function monthHtml(days: Date[], events: CalEvent[]): string {
  const today = new Date();
  const byDay = groupByDay(events);
  const head = WEEKDAYS.map((d) => `<div class="cal-weekday">${d}</div>`).join(
    '',
  );
  const cells = days
    .map((day) => {
      const list = byDay.get(dayKey(day)) ?? [];
      const isToday = isSameDay(day, today);
      const outside = day.getMonth() !== state.anchor.getMonth();
      const shown =
        list.length > MAX_PILLS ? list.slice(0, MAX_PILLS - 1) : list;
      const hidden = list.length - shown.length;
      return `
        <div class="cal-cell${outside ? ' is-outside' : ''}${isToday ? ' is-today' : ''}"
             data-day="${dayKey(day)}" role="gridcell"
             aria-label="${formatLongDay(day)}${list.length ? `, ${list.length} entries` : ''}">
          <div class="cal-cell-head">
            <span class="cal-daynum">${day.getDate()}</span>
            ${isToday ? '<span class="cal-today-label">Today</span>' : ''}
          </div>
          <div class="cal-pills">
            ${shown.map(pillHtml).join('')}
            ${hidden ? `<button type="button" class="cal-more" data-more="${dayKey(day)}">+${hidden} more</button>` : ''}
          </div>
        </div>`;
    })
    .join('');
  return `
    <div class="cal-month" style="--weeks: ${days.length / 7}">
      <div class="cal-weekdays">${head}</div>
      <div class="cal-grid" role="grid">${cells}</div>
    </div>`;
}

function pillHtml(e: CalEvent): string {
  const time = timeOf(e.start);
  const label = `${escapeHtml(e.title)}, ${time}–${timeOf(e.end)}`;
  return e.activity
    ? `<button type="button" class="pill pill--${e.kind}" data-event="${e.id}" title="${label}">${escapeHtml(e.title)}</button>`
    : `<span class="pill pill--${e.kind}" title="${label} · logged with the focus timer">${escapeHtml(e.title)}</span>`;
}

// ---- Week ------------------------------------------------------------------

function weekHtml(days: Date[], events: CalEvent[]): string {
  const now = new Date();
  const byDay = groupByDay(events);
  let startHour = DAY_START_HOUR;
  let endHour = DAY_END_HOUR;
  for (const e of events) {
    startHour = Math.min(startHour, e.start.getHours());
    const endsAt = isSameDay(e.start, e.end) ? e.end.getHours() + 1 : 24;
    endHour = Math.max(endHour, Math.min(24, endsAt));
  }
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );

  const head = days
    .map(
      (d, i) => `
        <div class="cal-week-dayhead${isSameDay(d, now) ? ' is-today' : ''}">
          <span class="cal-weekday">${WEEKDAYS[i]}</span>
          <span class="cal-week-date">${d.getDate()}</span>
        </div>`,
    )
    .join('');

  const columns = days
    .map((d) => {
      const slots = hours
        .map(
          (h) =>
            `<div class="cal-slot" data-day="${dayKey(d)}" data-hour="${h}" aria-label="Add entry ${formatLongDay(d)} ${h}:00"></div>`,
        )
        .join('');
      const blocks = layoutDay(byDay.get(dayKey(d)) ?? [])
        .map(({ event, col, cols }) => {
          const dayStart = startOfDay(event.start).getTime();
          const startMin =
            (event.start.getTime() - dayStart) / 60_000 - startHour * 60;
          const endMin =
            Math.min(event.end.getTime() - dayStart, DAY_MS) / 60_000 -
            startHour * 60;
          const top = (startMin / 60) * HOUR_PX;
          const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 22);
          const tag = event.activity ? 'button' : 'div';
          return `
            <${tag} ${event.activity ? `type="button" data-event="${event.id}"` : ''}
              class="cal-block cal-kind-${event.kind}${height < 40 ? ' is-short' : ''}"
              style="top:${top}px;height:${height}px;left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px)"
              title="${escapeHtml(event.title)}${event.activity ? '' : ' · logged with the focus timer'}">
              <span class="cal-block-title">${escapeHtml(event.title)}</span>
              <span class="cal-block-time">${timeOf(event.start)}–${timeOf(event.end)}</span>
            </${tag}>`;
        })
        .join('');
      const nowLine =
        isSameDay(d, now) &&
        now.getHours() >= startHour &&
        now.getHours() < endHour
          ? `<div class="cal-now" style="top:${((now.getHours() - startHour) * 60 + now.getMinutes()) * (HOUR_PX / 60)}px"></div>`
          : '';
      return `<div class="cal-week-col${isSameDay(d, now) ? ' is-today' : ''}">${slots}${blocks}${nowLine}</div>`;
    })
    .join('');

  const gutter = hours
    .map((h) => `<div class="cal-hour">${String(h).padStart(2, '0')}:00</div>`)
    .join('');

  return `
    <div class="cal-week" style="--hour: ${HOUR_PX}px">
      <div class="cal-week-head"><div></div>${head}</div>
      <div class="cal-week-scroll" data-start-hour="${startHour}">
        <div class="cal-week-grid">
          <div class="cal-gutter">${gutter}</div>
          ${columns}
        </div>
      </div>
    </div>`;
}

/** Place overlapping events side by side: each cluster shares its column count. */
function layoutDay(
  events: CalEvent[],
): { event: CalEvent; col: number; cols: number }[] {
  const placed: { event: CalEvent; col: number; cols: number }[] = [];
  let cluster: typeof placed = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const p of cluster) p.cols = colEnds.length;
    placed.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const event of events) {
    const start = event.start.getTime();
    if (start >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= start);
    if (col === -1) col = colEnds.push(0) - 1;
    colEnds[col] = event.end.getTime();
    clusterEnd = Math.max(clusterEnd, event.end.getTime());
    cluster.push({ event, col, cols: 1 });
  }
  flush();
  return placed;
}

function scrollWeekToMorning(el: HTMLElement): void {
  const scroller = el.querySelector('.cal-week-scroll') as HTMLElement | null;
  if (!scroller) return;
  const startHour = Number(scroller.dataset.startHour);
  scroller.scrollTop = Math.max(0, (DAY_START_HOUR - startHour) * HOUR_PX);
}

// ---- Interaction -----------------------------------------------------------

function onClick(event: MouseEvent): void {
  const events = currentEvents;
  const target = event.target as HTMLElement;

  const mode = target.closest<HTMLElement>('[data-mode]')?.dataset.mode;
  if (mode) {
    state.mode = mode as ViewMode;
    void render();
    return;
  }

  const nav = target.closest<HTMLElement>('[data-nav]')?.dataset.nav;
  if (nav) {
    navigate(nav as 'today' | 'prev' | 'next');
    return;
  }

  if (target.closest('[data-action="add"]')) {
    openEntryDialog(
      { mode: 'create', date: defaultCreateDate() },
      () => void render(),
    );
    return;
  }

  const eventId = target.closest<HTMLElement>('[data-event]')?.dataset.event;
  if (eventId) {
    const activity = events.find((e) => e.id === eventId)?.activity;
    if (activity)
      openEntryDialog({ mode: 'edit', activity }, () => void render());
    return;
  }

  const more = target.closest<HTMLElement>('[data-more]')?.dataset.more;
  if (more) {
    openDayDialog(parseDayKey(more), groupByDay(events).get(more) ?? []);
    return;
  }

  // Read-only OTJ blocks shouldn't fall through to "create".
  if (target.closest('.pill, .cal-block')) return;

  const slot = target.closest<HTMLElement>('[data-day]');
  if (slot?.dataset.day) {
    const hour = slot.dataset.hour ? Number(slot.dataset.hour) : undefined;
    openEntryDialog(
      { mode: 'create', date: parseDayKey(slot.dataset.day), hour },
      () => void render(),
    );
  }
}

function navigate(direction: 'today' | 'prev' | 'next'): void {
  if (direction === 'today') {
    state.anchor = startOfDay(new Date());
  } else {
    const step = direction === 'next' ? 1 : -1;
    state.anchor =
      state.mode === 'month'
        ? addMonths(state.anchor, step)
        : addDays(state.anchor, 7 * step);
  }
  void render();
}

/** "Add entry" defaults to today if it's on screen, else the first visible day. */
function defaultCreateDate(): Date {
  const today = startOfDay(new Date());
  const { from, to } = visibleRange();
  if (today >= from && today < to) return today;
  return state.mode === 'month'
    ? new Date(state.anchor.getFullYear(), state.anchor.getMonth(), 1)
    : from;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ---- "+N more" day dialog ---------------------------------------------------

function openDayDialog(day: Date, events: CalEvent[]): void {
  const body = document.createElement('ul');
  body.className = 'cal-day-list';
  body.innerHTML = events
    .map(
      (e) => `
        <li>
          <span class="dot dot--${e.kind}"></span>
          <span class="cal-day-time">${timeOf(e.start)}–${timeOf(e.end)}</span>
          ${
            e.activity
              ? `<button type="button" class="cal-link" data-event="${e.id}">${escapeHtml(e.title)}</button>`
              : `<span>${escapeHtml(e.title)} <small>(OTJ)</small></span>`
          }
        </li>`,
    )
    .join('');

  const dialog = openDialog({
    title: formatLongDay(day),
    body,
    actions: [
      {
        label: 'Add entry',
        onClick: () =>
          openEntryDialog({ mode: 'create', date: day }, () => void render()),
      },
      { label: 'Close', variant: 'primary' },
    ],
  });
  body.addEventListener('click', (event) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-event]',
    )?.dataset.event;
    const activity = events.find((e) => e.id === id)?.activity;
    if (!activity) return;
    dialog.close();
    openEntryDialog({ mode: 'edit', activity }, () => void render());
  });
}
