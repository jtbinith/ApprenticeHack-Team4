// KSBs tab (#56) data: coverage per KSB and review period, gaps in the current
// period with a suggested next step, and entries / events that need attention.

import type {
  Activity,
  ActivityKind,
  Ksb,
  Target,
} from '../../../shared/types';
import { db } from '../../db';
import { completeness, visibleHints } from '../hints/rules';
import {
  currentKsbs,
  type Entry,
  listEntries,
  suggestKsbs,
} from '../journal/entries';
import {
  inPeriod,
  reviewPeriods,
  upcoming,
  type ReviewPeriod,
} from '../reviews/periods';

const DAY = 86_400_000;
/** Entries scoring below this (6 of 8 checks) are flagged as incomplete. */
const COMPLETE_ENOUGH = 0.75;
/** Calendar items that usually deserve a reflection. */
const REFLECTABLE: ActivityKind[] = ['learning', 'journal', 'review'];

export interface KsbData {
  ksbs: Ksb[];
  standardName: string;
  entries: Entry[];
  activities: Activity[];
  periods: ReviewPeriod[];
}

export async function loadKsbData(): Promise<KsbData> {
  const [entries, ksbs, periods, activities, settings] = await Promise.all([
    listEntries(),
    currentKsbs(),
    reviewPeriods(),
    db.activities.toArray(),
    db.settings.get('settings'),
  ]);
  const standard = settings?.standardId
    ? await db.standards.get(settings.standardId)
    : await db.standards.toCollection().first();
  return {
    ksbs,
    standardName: standard?.name ?? '',
    entries,
    activities,
    periods,
  };
}

/** A heatmap column: one review period. */
export interface Column {
  from: Date;
  to: Date;
  label: string;
  current: boolean;
}

/** Review periods that have started, plus an open period after the last review. */
export function columns(data: KsbData, now: Date): Column[] {
  const next = upcoming(data.periods, now);
  const cols: Column[] = data.periods
    .filter((p) => p.from <= now)
    .map((p) => ({
      from: p.from,
      to: p.to,
      label: `To ${shortDate(p.to)}`,
      current: p === next,
    }));
  if (!next) {
    const last = data.periods.at(-1);
    cols.push({
      from: last ? last.to : new Date(0),
      to: new Date(8.64e15),
      label: last ? `Since ${shortDate(last.to)}` : 'All time',
      current: true,
    });
  }
  return cols;
}

/** The current period, up to now. */
export function currentRange(cols: Column[], now: Date) {
  const current = cols.find((c) => c.current) ?? cols.at(-1);
  return {
    from: current?.from ?? new Date(0),
    to: now,
    reviewDate: current && current.to.getTime() < 8.64e15 ? current.to : null,
  };
}

export interface Coverage {
  ksb: Ksb;
  /** Entries tagging this KSB, newest first. */
  entries: Entry[];
  accepted: number;
  perColumn: { count: number; accepted: number }[];
  /** Average completeness (0–1) of the entries tagging it. */
  strength: number;
}

export function coverage(data: KsbData, cols: Column[]): Coverage[] {
  return data.ksbs.map((ksb) => {
    const entries = data.entries.filter((e) =>
      e.reflection.ksbs.includes(ksb.code),
    );
    const isAccepted = (e: Entry) => e.reflection.portalStatus === 'accepted';
    const perColumn = cols.map((col) => {
      const inCol = entries.filter((e) => inPeriod(e.activity.start, col));
      return {
        count: inCol.length,
        accepted: inCol.filter(isAccepted).length,
      };
    });
    const strength = entries.length
      ? entries.reduce(
          (sum, e) => sum + completeness(e.reflection, data.ksbs).score,
          0,
        ) / entries.length
      : 0;
    return {
      ksb,
      entries,
      accepted: entries.filter(isAccepted).length,
      perColumn,
      strength,
    };
  });
}

export type Suggestion =
  /** A past event in this period that matches the KSB but has no reflection. */
  | { kind: 'reflect'; activity: Activity }
  /** An event coming up that could evidence it. */
  | { kind: 'upcoming'; activity: Activity }
  /** An existing entry whose text matches the KSB but isn't tagged with it. */
  | { kind: 'tag'; entry: Entry }
  | { kind: 'new' };

export interface Gap {
  ksb: Ksb;
  /** A target from the last review that mentions this KSB. */
  target?: Target;
  suggestion: Suggestion;
}

/** KSBs with no evidence in the current period, each with a suggested next step. */
export function gaps(data: KsbData, cols: Column[], now: Date): Gap[] {
  const range = currentRange(cols, now);
  const reflected = reflectedActivityIds(data);
  const lastReview = data.periods.filter((p) => p.to <= now).at(-1)?.review;
  const matches = (ksb: Ksb, text: string) =>
    suggestKsbs(text, data.ksbs, []).some((k) => k.code === ksb.code);

  return (
    data.ksbs
      .filter(
        (ksb) =>
          !data.entries.some(
            (e) =>
              e.reflection.ksbs.includes(ksb.code) &&
              inPeriod(e.activity.start, range),
          ),
      )
      .map((ksb): Gap => {
        const target = lastReview?.targets.find(
          (t) =>
            t.status !== 'met' &&
            new RegExp(`\\b${ksb.code}\\b`, 'i').test(t.text),
        );

        const past = data.activities
          .filter(
            (a) =>
              !reflected.has(a.id) &&
              new Date(a.end) <= now &&
              inPeriod(a.start, range) &&
              matches(ksb, a.title),
          )
          .sort((a, b) => b.start.localeCompare(a.start))[0];
        if (past)
          return {
            ksb,
            target,
            suggestion: { kind: 'reflect', activity: past },
          };

        const soon = data.activities
          .filter(
            (a) =>
              new Date(a.start) > now &&
              new Date(a.start).getTime() < now.getTime() + 30 * DAY &&
              matches(ksb, a.title),
          )
          .sort((a, b) => a.start.localeCompare(b.start))[0];
        if (soon)
          return {
            ksb,
            target,
            suggestion: { kind: 'upcoming', activity: soon },
          };

        const untagged = data.entries.find(
          (e) =>
            !e.reflection.ksbs.includes(ksb.code) && matches(ksb, entryText(e)),
        );
        if (untagged)
          return { ksb, target, suggestion: { kind: 'tag', entry: untagged } };

        return { ksb, target, suggestion: { kind: 'new' } };
      })
      // Gaps named in review targets first.
      .sort((a, b) => Number(!!b.target) - Number(!!a.target))
  );
}

export interface Attention {
  /** Assessor asked for changes. */
  changesRequested: Entry[];
  incomplete: { entry: Entry; passed: number; total: number; hint?: string }[];
  /** Past learning / journal / review events in this period with no reflection. */
  unreflected: Activity[];
}

export function attention(data: KsbData, cols: Column[], now: Date): Attention {
  const range = currentRange(cols, now);
  const nowLocal = now.getTime();
  const changesRequested = data.entries.filter(
    (e) => e.reflection.portalStatus === 'changes-requested',
  );

  const incomplete = data.entries
    .filter(
      (e) =>
        e.reflection.portalStatus !== 'changes-requested' &&
        e.reflection.portalStatus !== 'accepted' &&
        new Date(e.activity.start).getTime() <= nowLocal,
    )
    .map((entry) => {
      const { score, passed, total } = completeness(
        entry.reflection,
        data.ksbs,
      );
      const hint = visibleHints(entry.reflection, data.ksbs, 1)[0]?.message;
      return { entry, score, passed, total, hint };
    })
    .filter((x) => x.score < COMPLETE_ENOUGH)
    .sort((a, b) => a.score - b.score);

  const reflected = reflectedActivityIds(data);
  const unreflected = data.activities
    .filter(
      (a) =>
        REFLECTABLE.includes(a.kind) &&
        !reflected.has(a.id) &&
        new Date(a.end).getTime() <= nowLocal &&
        inPeriod(a.start, range),
    )
    .sort((a, b) => b.start.localeCompare(a.start));

  return { changesRequested, incomplete, unreflected };
}

function reflectedActivityIds(data: KsbData): Set<string> {
  return new Set(
    data.entries.flatMap((e) =>
      e.reflection.activityId ? [e.reflection.activityId] : [],
    ),
  );
}

function entryText({ activity, reflection }: Entry): string {
  return [
    activity.title,
    reflection.situation,
    reflection.task,
    reflection.action,
    reflection.result,
  ].join(' ');
}

export function shortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}
