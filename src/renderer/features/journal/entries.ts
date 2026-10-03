// Journal entry = a calendar Activity + its STAR Reflection, edited together.

import type {
  Activity,
  ActivityKind,
  Ksb,
  PortalStatus,
  Reflection,
} from '../../../shared/types';
import { db, newId } from '../../db';
import { toLocalDateTime } from '../../seed';

export interface Entry {
  activity: Activity;
  reflection: Reflection;
}

export const PORTAL_STATUS_LABELS: Record<PortalStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  'changes-requested': 'Changes requested',
};

export const KIND_LABELS: Record<ActivityKind, string> = {
  journal: 'Journal',
  meeting: 'Meeting',
  deadline: 'Deadline',
  learning: 'Learning',
  review: 'Review',
  otj: 'OTJ session',
};

function emptyReflection(activity: Activity): Reflection {
  return {
    id: newId(),
    activityId: activity.id,
    date: activity.start,
    situation: '',
    task: '',
    action: '',
    result: '',
    ksbs: [],
    evidence: [],
    confirmed: false,
    portalStatus: 'draft',
  };
}

/** A new, unsaved entry. Defaults to now (or 09:00 on the given date). */
export function draftEntry(
  options: { date?: string; title?: string } = {},
): Entry {
  const start = options.date
    ? new Date(
        options.date.length === 10 ? `${options.date}T09:00` : options.date,
      )
    : new Date();
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  const activity: Activity = {
    id: newId(),
    title: options.title ?? '',
    kind: 'journal',
    start: toLocalDateTime(start),
    end: toLocalDateTime(end),
    source: 'manual',
  };
  return { activity, reflection: emptyReflection(activity) };
}

/** The entry for a calendar activity; creates an unsaved reflection if it has none yet. */
export async function entryForActivity(
  activityId: string,
): Promise<Entry | undefined> {
  const activity = await db.activities.get(activityId);
  if (!activity) return undefined;
  const reflection =
    (await db.reflections.where('activityId').equals(activityId).first()) ??
    emptyReflection(activity);
  return { activity, reflection };
}

/** Marks a stand-in activity for a reflection that isn't on the calendar
 *  (e.g. a focus-timer reflection — the calendar shows the OTJ session itself). */
const REFLECTION_ONLY = 'reflection-only';

function standInActivity(reflection: Reflection): Activity {
  return {
    id: `reflection:${reflection.id}`,
    title: reflection.task || 'Focus session',
    kind: 'otj',
    start: reflection.date,
    end: reflection.date,
    source: REFLECTION_ONLY,
  };
}

/** Every reflection with its calendar activity, newest first. */
export async function listEntries(): Promise<Entry[]> {
  const reflections = await db.reflections.toArray();
  const ids = reflections
    .map((r) => r.activityId)
    .filter((id): id is string => !!id);
  const activities = new Map(
    (await db.activities.bulkGet(ids))
      .filter((a): a is Activity => !!a)
      .map((a) => [a.id, a]),
  );
  return reflections
    .map((reflection) => ({
      activity:
        (reflection.activityId && activities.get(reflection.activityId)) ||
        standInActivity(reflection),
      reflection,
    }))
    .sort((a, b) => b.activity.start.localeCompare(a.activity.start));
}

export async function saveEntry(entry: Entry): Promise<void> {
  if (entry.activity.source === REFLECTION_ONLY) {
    // Not on the calendar: only the reflection is stored.
    await db.reflections.put({
      ...entry.reflection,
      date: entry.activity.start,
    });
    return;
  }
  const reflection = {
    ...entry.reflection,
    activityId: entry.activity.id,
    date: entry.activity.start,
  };
  await db.transaction('rw', db.activities, db.reflections, async () => {
    await db.activities.put(entry.activity);
    await db.reflections.put(reflection);
  });
}

/**
 * Delete an entry's reflection and files. The calendar item is removed too when
 * `removeActivity` is set (deleting from the calendar), or when it only existed
 * for this journal entry.
 */
export async function deleteEntry(
  entry: Entry,
  { removeActivity = false } = {},
): Promise<void> {
  await db.transaction(
    'rw',
    db.activities,
    db.reflections,
    db.files,
    async () => {
      await db.reflections.delete(entry.reflection.id);
      await db.files.bulkDelete(
        entry.reflection.evidence.flatMap((e) =>
          e.kind === 'file' ? [e.fileId] : [],
        ),
      );
      const journalOnly =
        entry.activity.kind === 'journal' && entry.activity.source === 'manual';
      if (
        entry.activity.source !== REFLECTION_ONLY &&
        (removeActivity || journalOnly)
      ) {
        await db.activities.delete(entry.activity.id);
      }
    },
  );
}

export async function currentKsbs(): Promise<Ksb[]> {
  const settings = await db.settings.get('settings');
  const standard = settings?.standardId
    ? await db.standards.get(settings.standardId)
    : await db.standards.toCollection().first();
  return standard?.ksbs ?? [];
}

/** KSBs whose code or keywords appear in the text, excluding ones already tagged. */
export function suggestKsbs(
  text: string,
  ksbs: Ksb[],
  tagged: string[],
): Ksb[] {
  const haystack = ` ${text.toLowerCase()} `;
  return ksbs.filter((k) => {
    if (tagged.includes(k.code)) return false;
    if (new RegExp(`\\b${k.code.toLowerCase()}\\b`).test(haystack)) return true;
    return k.keywords.some((word) =>
      new RegExp(
        // Allow simple word endings: "test" matches "tests", "testing", "tested".
        `\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es|ing|ed)?\\b`,
      ).test(haystack),
    );
  });
}

export function formatDate(localDateTime: string): string {
  return new Date(localDateTime).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}
