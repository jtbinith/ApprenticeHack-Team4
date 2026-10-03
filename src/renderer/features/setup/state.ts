// Load the wizard's working copy from the database, and save it back.

import type {
  Activity,
  Review,
  ReviewKind,
  Settings,
  Standard,
} from '../../../shared/types';
import { db, newId } from '../../db';
import { toLocalDateTime } from '../../seed';
import { BUNDLED_STANDARDS } from './standards';

export const REVIEW_LABELS: Record<ReviewKind, string> = {
  progress: 'Progress review',
  tripartite: 'Tripartite review',
  'epa-gateway': 'EPA gateway',
};

export interface ReviewDraft {
  id: string;
  kind: ReviewKind;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm` */
  time: string;
}

export interface WizardState {
  name: string;
  start: string;
  end: string;
  /** Working copy of the chosen standard (edited in the KSB step). */
  standard: Standard;
  /** Standard in use before the wizard opened. */
  originalStandardId?: string;
  reviews: ReviewDraft[];
  otjHours: number;
}

export interface WizardData {
  state: WizardState;
  /** Bundled standards plus any saved on this device (saved copies win). */
  options: Standard[];
  /** Ids of standards already saved on this device. */
  savedIds: Set<string>;
  /** Every KSB code used in journal entries and OTJ sessions. */
  taggedCodes: Set<string>;
}

export async function loadWizard(): Promise<WizardData> {
  const [settings, saved, reviews, reflections, sessions] = await Promise.all([
    db.settings.get('settings'),
    db.standards.toArray(),
    db.reviews.orderBy('date').toArray(),
    db.reflections.toArray(),
    db.otjSessions.toArray(),
  ]);

  const byId = new Map<string, Standard>();
  for (const s of [...BUNDLED_STANDARDS, ...saved]) byId.set(s.id, s);
  const options = [...byId.values()];
  const current =
    (settings?.standardId && byId.get(settings.standardId)) || options[0];

  return {
    state: {
      name: settings?.apprenticeName ?? '',
      start: settings?.apprenticeshipStart ?? '',
      end: settings?.apprenticeshipEnd ?? '',
      standard: structuredClone(current),
      originalStandardId: settings?.standardId,
      reviews: reviews.map((r) => {
        const [date, time = '10:00'] = r.date.split('T');
        return { id: r.id, kind: r.kind, date, time };
      }),
      otjHours: settings?.weeklyOtjTargetHours ?? 6,
    },
    options,
    savedIds: new Set(saved.map((s) => s.id)),
    taggedCodes: new Set([
      ...reflections.flatMap((r) => r.ksbs),
      ...sessions.flatMap((s) => s.ksbs),
    ]),
  };
}

export async function saveWizard(state: WizardState): Promise<void> {
  const standard: Standard = {
    ...state.standard,
    name: state.standard.name.trim() || 'My standard',
    ksbs: state.standard.ksbs.map((k) => ({
      ...k,
      code: k.code.trim(),
      title: k.title.trim(),
    })),
  };

  await db.transaction(
    'rw',
    [db.settings, db.standards, db.reviews, db.activities, db.reflections],
    async () => {
      const previous = await db.settings.get('settings');
      const settings: Settings = {
        ...previous,
        id: 'settings',
        apprenticeName: state.name.trim(),
        standardId: standard.id,
        apprenticeshipStart: state.start || undefined,
        apprenticeshipEnd: state.end || undefined,
        weeklyOtjTargetHours: state.otjHours,
        setupCompletedAt: new Date().toISOString(),
      };
      await db.settings.put(settings);
      await db.standards.put(standard);
      await saveReviews(state.reviews);
    },
  );
}

/** Create, update and remove reviews, keeping a calendar activity for each. */
async function saveReviews(drafts: ReviewDraft[]): Promise<void> {
  const existing = await db.reviews.toArray();
  const keep = new Set(drafts.map((d) => d.id));

  for (const old of existing) {
    if (keep.has(old.id)) continue;
    await db.reviews.delete(old.id);
    const activity = await activityFor(old);
    if (activity && !(await hasReflection(activity.id))) {
      await db.activities.delete(activity.id);
    }
  }

  for (const draft of drafts) {
    const old = existing.find((r) => r.id === draft.id);
    const start = `${draft.date}T${draft.time || '10:00'}`;
    const linked = old && (await activityFor(old));
    // Leave an unchanged review's calendar item (and its title) as it is.
    const unchanged = linked && old.kind === draft.kind && old.date === start;
    const activity = unchanged
      ? linked
      : await upsertActivity(linked, draft.kind, start);
    const review: Review = {
      formStatus: 'not-started',
      targets: [],
      ...old,
      id: draft.id,
      kind: draft.kind,
      date: start,
      activityId: activity.id,
    };
    await db.reviews.put(review);
  }
}

/** The review's linked activity, or (for older data) a review activity at the same time. */
async function activityFor(review: Review): Promise<Activity | undefined> {
  if (review.activityId) return db.activities.get(review.activityId);
  return db.activities
    .where('start')
    .equals(review.date)
    .filter((a) => a.kind === 'review')
    .first();
}

async function upsertActivity(
  activity: Activity | undefined,
  kind: ReviewKind,
  start: string,
): Promise<Activity> {
  const durationMs = activity
    ? new Date(activity.end).getTime() - new Date(activity.start).getTime()
    : 3_600_000;
  const end = toLocalDateTime(new Date(new Date(start).getTime() + durationMs));
  const next: Activity = activity
    ? { ...activity, title: REVIEW_LABELS[kind], start, end }
    : {
        id: newId(),
        title: REVIEW_LABELS[kind],
        kind: 'review',
        start,
        end,
        source: 'setup',
      };
  await db.activities.put(next);
  return next;
}

async function hasReflection(activityId: string): Promise<boolean> {
  return (
    (await db.reflections.where('activityId').equals(activityId).count()) > 0
  );
}

export function newReview(): ReviewDraft {
  return { id: newId(), kind: 'progress', date: '', time: '10:00' };
}
