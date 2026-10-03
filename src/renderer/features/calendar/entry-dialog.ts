// Add / edit a calendar entry (#49). Opens the full Journal entry form (#50) so
// notes, STAR reflection and evidence files (PDFs, images, docs) are attached
// to the calendar item itself — everything about an event lives in one place.

import type { Activity } from '../../../shared/types';
import { openEntryDialog as openJournalEntry } from '../journal';
import { dayKey } from './dates';

export type EntryDialogInput =
  | { mode: 'create'; date: Date; hour?: number }
  | { mode: 'edit'; activity: Activity };

const hhmm = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Opens the dialog; `onChange` runs after a save or delete. */
export function openEntryDialog(
  input: EntryDialogInput,
  onChange: () => void,
): void {
  if (input.mode === 'edit') {
    void openJournalEntry({
      activityId: input.activity.id,
      deleteRemovesEvent: true,
      onChange,
    });
  } else {
    void openJournalEntry({
      date: `${dayKey(input.date)}T${hhmm(input.hour ?? 9)}`,
      kind: 'meeting',
      onChange,
    });
  }
}
