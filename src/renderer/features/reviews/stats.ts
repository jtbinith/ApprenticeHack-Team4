// Progress figures for a review period: entries, KSB coverage, OTJ hours,
// evidence status and targets. Used by the pre-review form (#57) and the
// review pack (#58).

import type {
  FormFieldSource,
  Ksb,
  OtjCategory,
  PortalStatus,
  Target,
} from '../../../shared/types';
import { db } from '../../db';
import {
  currentKsbs,
  type Entry,
  listEntries,
  PORTAL_STATUS_LABELS,
} from '../journal/entries';
import { inPeriod, type ReviewPeriod } from './periods';

export interface PeriodStats {
  entries: Entry[];
  ksbs: Ksb[];
  /** KSB code → number of entries tagging it in this period. */
  ksbCounts: Map<string, number>;
  /** KSB code → number of *accepted* entries tagging it. */
  ksbAccepted: Map<string, number>;
  /** KSBs with no evidence this period. */
  gaps: Ksb[];
  otjMinutes: number;
  otjByCategory: Map<OtjCategory, number>;
  /** Weekly target × weeks in the period. */
  otjTargetMinutes: number;
  evidenceByStatus: Map<PortalStatus, number>;
  /** Targets set at the previous review. */
  targets: Target[];
}

const WEEK = 7 * 86_400_000;

export async function periodStats(period: ReviewPeriod): Promise<PeriodStats> {
  const [allEntries, ksbs, sessions, settings] = await Promise.all([
    listEntries(),
    currentKsbs(),
    db.otjSessions.toArray(),
    db.settings.get('settings'),
  ]);
  // Progress only counts what has happened: an upcoming review's period ends today.
  const sofar = {
    from: period.from,
    to: new Date(Math.min(period.to.getTime(), Date.now())),
  };
  const entries = allEntries.filter((e) => inPeriod(e.activity.start, sofar));

  const ksbCounts = new Map<string, number>();
  const ksbAccepted = new Map<string, number>();
  const evidenceByStatus = new Map<PortalStatus, number>();
  for (const { reflection } of entries) {
    for (const code of reflection.ksbs) {
      ksbCounts.set(code, (ksbCounts.get(code) ?? 0) + 1);
      if (reflection.portalStatus === 'accepted') {
        ksbAccepted.set(code, (ksbAccepted.get(code) ?? 0) + 1);
      }
    }
    evidenceByStatus.set(
      reflection.portalStatus,
      (evidenceByStatus.get(reflection.portalStatus) ?? 0) + 1,
    );
  }

  const otjByCategory = new Map<OtjCategory, number>();
  let otjMinutes = 0;
  for (const s of sessions.filter((s) => inPeriod(s.endedAt, sofar))) {
    otjMinutes += s.minutes;
    otjByCategory.set(
      s.category,
      (otjByCategory.get(s.category) ?? 0) + s.minutes,
    );
  }
  const weeks = Math.max(1, (sofar.to.getTime() - sofar.from.getTime()) / WEEK);

  return {
    entries,
    ksbs,
    ksbCounts,
    ksbAccepted,
    gaps: ksbs.filter((k) => !ksbCounts.has(k.code)),
    otjMinutes,
    otjByCategory,
    otjTargetMinutes: Math.round(
      weeks * (settings?.weeklyOtjTargetHours ?? 0) * 60,
    ),
    evidenceByStatus,
    targets: period.previous?.targets ?? [],
  };
}

export const hours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;

const shortDate = (when: string) =>
  new Date(when).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

const TARGET_LABELS: Record<Target['status'], string> = {
  open: 'In progress',
  met: 'Met',
  carried: 'Carried over',
};

/** Draft answers for each auto-fillable form field, written in plain sentences. */
export function autofill(stats: PeriodStats): Record<FormFieldSource, string> {
  const progress = stats.entries.length
    ? [
        `I logged ${stats.entries.length} journal entries this period, including:`,
        ...stats.entries
          .slice(0, 6)
          .map((e) => `- ${shortDate(e.activity.start)}: ${e.activity.title}`),
      ].join('\n')
    : 'No journal entries logged this period yet.';

  const covered = [...stats.ksbCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => {
      const title = stats.ksbs.find((k) => k.code === code)?.title;
      return `- ${code}${title ? ` ${title}` : ''}: ${n} entr${n === 1 ? 'y' : 'ies'}`;
    });
  const ksbs = [
    covered.length
      ? 'KSBs evidenced this period:'
      : 'No KSBs evidenced yet this period.',
    ...covered,
    stats.gaps.length
      ? `Not yet evidenced: ${stats.gaps.map((k) => k.code).join(', ')}.`
      : 'Every KSB has at least one piece of evidence.',
  ].join('\n');

  const categories = [...stats.otjByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, m]) => `${cat} ${hours(m)}`)
    .join(', ');
  const otj = [
    `${hours(stats.otjMinutes)} logged against a target of ${hours(stats.otjTargetMinutes)} for this period.`,
    categories ? `By type: ${categories}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const targets = stats.targets.length
    ? stats.targets
        .map((t) => `- ${t.text} — ${TARGET_LABELS[t.status]}`)
        .join('\n')
    : 'No targets were set at the last review.';

  const evidence = stats.evidenceByStatus.size
    ? [...stats.evidenceByStatus.entries()]
        .map(([status, n]) => `${PORTAL_STATUS_LABELS[status]}: ${n}`)
        .join(' · ')
    : 'No evidence submitted this period.';

  return { progress, ksbs, otj, targets, evidence };
}
