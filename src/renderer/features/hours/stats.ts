// OTJ hours maths shared by the Hours tab and the weekly progress widget.
// Weeks start on Monday. Sessions count in the week/period they ended in.

import {
  OTJ_CATEGORIES,
  type Activity,
  type Ksb,
  type OtjCategory,
  type OtjSession,
  type Review,
  type Settings,
} from '../../../shared/types';
import { db } from '../../db';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export interface HoursData {
  sessions: OtjSession[];
  settings?: Settings;
  reviews: Review[];
  /** Learning activities, for OTJ suggestions. */
  learning: Activity[];
  ksbs: Ksb[];
}

/** Everything the Hours tab and widget need. Use inside liveQuery(). */
export async function loadHoursData(): Promise<HoursData> {
  const [sessions, settings, reviews, learning] = await Promise.all([
    db.otjSessions.toArray(),
    db.settings.get('settings'),
    db.reviews.toArray(),
    db.activities.where('kind').equals('learning').toArray(),
  ]);
  const standard = settings?.standardId
    ? await db.standards.get(settings.standardId)
    : undefined;
  return { sessions, settings, reviews, learning, ksbs: standard?.ksbs ?? [] };
}

export function weeklyTargetMinutes(data: HoursData): number {
  return (data.settings?.weeklyOtjTargetHours ?? 0) * 60;
}

/** Monday 00:00 (local) of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function weeksBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / WEEK);
}

/** Sessions that ended in [from, to). A null bound is open-ended. */
export function sessionsIn(
  sessions: OtjSession[],
  from: Date | null,
  to: Date | null,
): OtjSession[] {
  return sessions.filter((s) => {
    const t = new Date(s.endedAt).getTime();
    return (!from || t >= from.getTime()) && (!to || t < to.getTime());
  });
}

export function totalMinutes(sessions: OtjSession[]): number {
  return sessions.reduce((sum, s) => sum + s.minutes, 0);
}

/** 90 → "1.5", 360 → "6". */
export function formatHours(minutes: number): string {
  return String(Math.round(minutes / 6) / 10);
}

export function formatDate(date: Date, withYear = false): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** Review period containing `now`: last review (or apprenticeship start) → next review. */
export function currentPeriod(
  data: HoursData,
  now: Date,
): { start: Date; end: Date | null } {
  const dates = data.reviews
    .map((r) => new Date(r.date))
    .sort((a, b) => a.getTime() - b.getTime());
  const last = dates.filter((d) => d <= now).at(-1);
  const next = dates.find((d) => d > now) ?? null;
  const fallback = data.settings?.apprenticeshipStart
    ? new Date(data.settings.apprenticeshipStart)
    : startOfWeek(now);
  return { start: last ?? fallback, end: next };
}

/** Average minutes per week over the last `weeks` full weeks. */
export function weeklyPace(
  sessions: OtjSession[],
  now: Date,
  weeks = 4,
): number {
  const thisWeek = startOfWeek(now);
  const from = addDays(thisWeek, -7 * weeks);
  return totalMinutes(sessionsIn(sessions, from, thisWeek)) / weeks;
}

/** Minutes per week for the last `count` weeks, oldest first (last = this week). */
export function weeklyTotals(
  sessions: OtjSession[],
  now: Date,
  count: number,
): { start: Date; minutes: number }[] {
  const thisWeek = startOfWeek(now);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(thisWeek, -7 * (count - 1 - i));
    const minutes = totalMinutes(
      sessionsIn(sessions, start, addDays(start, 7)),
    );
    return { start, minutes };
  });
}

/**
 * Consecutive weeks the target was hit, counting back from last week.
 * This week only counts once it's hit, so the streak doesn't drop on Monday.
 */
export function weeklyStreak(
  sessions: OtjSession[],
  now: Date,
  targetMinutes: number,
): number {
  if (targetMinutes <= 0) return 0;
  const met = (start: Date) =>
    totalMinutes(sessionsIn(sessions, start, addDays(start, 7))) >=
    targetMinutes;

  const thisWeek = startOfWeek(now);
  let streak = met(thisWeek) ? 1 : 0;
  for (let week = addDays(thisWeek, -7); met(week); week = addDays(week, -7)) {
    streak++;
  }
  return streak;
}

export function byCategory(
  sessions: OtjSession[],
): { category: OtjCategory; minutes: number }[] {
  return OTJ_CATEGORIES.map((category) => ({
    category,
    minutes: totalMinutes(sessions.filter((s) => s.category === category)),
  }));
}

/** A session tagged with several KSBs counts towards each of them. */
export function byKsb(
  sessions: OtjSession[],
  ksbs: Ksb[],
): { ksb: Ksb; minutes: number }[] {
  return ksbs.map((ksb) => ({
    ksb,
    minutes: totalMinutes(sessions.filter((s) => s.ksbs.includes(ksb.code))),
  }));
}

/** Past learning events from the last 30 days that haven't been logged as OTJ. */
export function otjSuggestions(data: HoursData, now: Date): Activity[] {
  const logged = new Set(data.sessions.map((s) => s.activityId));
  const since = addDays(now, -30);
  return data.learning
    .filter((a) => {
      const end = new Date(a.end);
      return end <= now && end >= since && !logged.has(a.id);
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}

export function activityMinutes(activity: Activity): number {
  const ms =
    new Date(activity.end).getTime() - new Date(activity.start).getTime();
  return Math.max(1, Math.round(ms / 60_000));
}

/** Best guess at an OTJ category from an event title. */
export function guessCategory(title: string): OtjCategory {
  const t = title.toLowerCase();
  if (/\b(uni|lecture|seminar|module)\b/.test(t)) return 'Uni';
  if (/\b(course|workshop|training)\b/.test(t)) return 'Course';
  if (/\bshadow/.test(t)) return 'Shadowing';
  if (/\b(mentor|pairing|pair)\b/.test(t)) return 'Mentoring';
  if (/\b(assignment|essay|coursework)\b/.test(t)) return 'Assignment';
  return 'Self-study';
}
