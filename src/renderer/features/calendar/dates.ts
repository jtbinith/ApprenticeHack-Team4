// Date helpers for the calendar (#49). Weeks start on Monday.
// Activity times are local `YYYY-MM-DDTHH:mm` strings (see shared/types.ts),
// which `new Date()` parses as local time.

import { pad } from '../../seed';

export const DAY_MS = 86_400_000;

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Midnight (local) of the given date. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const offset = (day.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  return addDays(day, -offset);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `Date` → `YYYY-MM-DD` (local), used as a per-day key. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `Date` → `HH:mm` (local). */
export function timeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Monday-first days covering every week of `month` (leading/trailing days included). */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 7);
  const days: Date[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function formatMonth(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** e.g. "12 – 18 May 2025", "28 Apr – 4 May 2025", "29 Dec 2025 – 4 Jan 2026". */
export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const y = (d: Date) => ` ${d.getFullYear()}`;
  const dm = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (monday.getFullYear() !== sunday.getFullYear()) {
    return `${dm(monday)}${y(monday)} – ${dm(sunday)}${y(sunday)}`;
  }
  if (monday.getMonth() !== sunday.getMonth()) {
    return `${dm(monday)} – ${dm(sunday)}${y(sunday)}`;
  }
  return `${monday.getDate()} – ${dm(sunday)}${y(sunday)}`;
}

export function formatLongDay(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
