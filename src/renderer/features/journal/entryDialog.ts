// Public API for other features: open the journal entry form in a dialog.
//
//   import { openEntryDialog } from '../journal';
//   openEntryDialog({ activityId });      // calendar: clicked an event (#49)
//   openEntryDialog({ date: '2026-10-07' }); // calendar: clicked an empty day
//   openEntryDialog({ otjSessionId });    // focus timer: session just stopped (#52)
//   openEntryDialog();                    // "+ Add entry" button

import type { ActivityKind } from '../../../shared/types';
import { db } from '../../db';
import { toLocalDateTime } from '../../seed';
import { openDialog } from '../../ui/dialog';
import { createEntryEditor } from './editor';
import {
  currentKsbs,
  deleteEntry,
  draftEntry,
  type Entry,
  entryForActivity,
  saveEntry,
} from './entries';

export interface OpenEntryOptions {
  /** Edit (or start reflecting on) an existing calendar activity. */
  activityId?: string;
  /** Create a new entry on this date (`YYYY-MM-DD`) or date-time (`YYYY-MM-DDTHH:mm`). */
  date?: string;
  /** Reflect on a just-finished OTJ session; links the session to the new entry. */
  otjSessionId?: string;
  /** Type for a new entry (default: journal). */
  kind?: ActivityKind;
  /** Called after the entry is saved. */
  onSaved?: (entry: Entry) => void;
  /** Called after the entry is saved or deleted (e.g. to re-render a view). */
  onChange?: () => void;
  /** Deleting also removes the calendar item (used by the calendar). */
  deleteRemovesEvent?: boolean;
}

export async function openEntryDialog(
  options: OpenEntryOptions = {},
): Promise<void> {
  let entry: Entry | undefined;
  let isNew = true;
  let hasReflection = false;

  if (options.activityId) {
    entry = await entryForActivity(options.activityId);
    // An existing calendar item is never "new", even before it has a reflection.
    isNew = !entry;
    hasReflection = !!(await db.reflections.get(entry?.reflection.id ?? ''));
  } else if (options.otjSessionId) {
    const session = await db.otjSessions.get(options.otjSessionId);
    if (session) {
      const end = new Date(session.endedAt);
      const start = new Date(end.getTime() - session.minutes * 60_000);
      entry = draftEntry({ date: toLocalDateTime(start), title: session.task });
      entry.activity.kind = 'learning';
      entry.activity.end = toLocalDateTime(end);
      entry.reflection.situation = `${session.category} session: ${session.task} (${session.minutes} min)`;
      entry.reflection.ksbs = [...session.ksbs];
    }
  }
  if (!entry) {
    entry = draftEntry({ date: options.date });
    if (options.kind) entry.activity.kind = options.kind;
  }

  const ksbs = await currentKsbs();
  let dialog: { close: () => void } | undefined;
  const editor = createEntryEditor(entry, ksbs, {
    isNew,
    async onSave(saved) {
      await saveEntry(saved);
      if (options.otjSessionId) {
        await db.otjSessions.update(options.otjSessionId, {
          reflectionId: saved.reflection.id,
        });
      }
      options.onSaved?.(saved);
      options.onChange?.();
      dialog?.close();
    },
    async onDelete(toDelete) {
      await deleteEntry(toDelete, {
        removeActivity: options.deleteRemovesEvent,
      });
      options.onChange?.();
      dialog?.close();
    },
  });

  dialog = openDialog({
    title: isNew
      ? 'New entry'
      : hasReflection
        ? 'Journal entry'
        : 'Calendar entry',
    body: editor.element,
    wide: true,
    onClose: () => editor.destroy(),
  });
}
