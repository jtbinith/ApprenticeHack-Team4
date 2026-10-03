// Add / edit a calendar entry (#49). The STAR reflection for an entry is the
// Journal's job (#50); this dialog only edits what sits on the calendar.

import { db, newId } from '../../db';
import { openDialog } from '../../ui/dialog';
import type { Activity, ActivityKind } from '../../../shared/types';
import { dayKey } from './dates';
import { KINDS } from './kinds';

export type EntryDialogInput =
  | { mode: 'create'; date: Date; hour?: number }
  | { mode: 'edit'; activity: Activity };

const hhmm = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Opens the dialog; `onChange` runs after a save or delete. */
export function openEntryDialog(
  input: EntryDialogInput,
  onChange: () => void,
): void {
  const editing = input.mode === 'edit' ? input.activity : null;

  const form = document.createElement('form');
  form.className = 'cal-form';
  form.innerHTML = `
    <label class="field"><span>Title</span>
      <input class="input" name="title" required maxlength="120" placeholder="e.g. Mentor check-in" />
    </label>
    <label class="field"><span>Kind</span>
      <select class="input" name="kind">
        ${KINDS.map((k) => `<option value="${k.kind}">${k.label}</option>`).join('')}
      </select>
    </label>
    <div class="cal-form-row">
      <label class="field"><span>Date</span><input class="input" name="date" type="date" required /></label>
      <label class="field"><span>Start</span><input class="input" name="start" type="time" required /></label>
      <label class="field"><span>End</span><input class="input" name="end" type="time" required /></label>
    </div>
    <p class="cal-form-error" role="alert" hidden></p>`;

  const field = <T extends HTMLInputElement | HTMLSelectElement>(
    name: string,
  ) => form.elements.namedItem(name) as T;
  const error = form.querySelector('.cal-form-error') as HTMLElement;

  if (editing) {
    field<HTMLInputElement>('title').value = editing.title;
    field<HTMLSelectElement>('kind').value = editing.kind;
    field<HTMLInputElement>('date').value = editing.start.slice(0, 10);
    field<HTMLInputElement>('start').value = editing.start.slice(11, 16);
    field<HTMLInputElement>('end').value = editing.end.slice(11, 16);
  } else if (input.mode === 'create') {
    const hour = input.hour ?? 9;
    field<HTMLSelectElement>('kind').value = 'meeting';
    field<HTMLInputElement>('date').value = dayKey(input.date);
    field<HTMLInputElement>('start').value = hhmm(hour);
    field<HTMLInputElement>('end').value = hour < 23 ? hhmm(hour + 1) : '23:59';
  }

  /** Validates and saves; returns false to keep the dialog open. */
  const save = (): boolean => {
    if (!form.reportValidity()) return false;
    const date = field<HTMLInputElement>('date').value;
    const start = `${date}T${field<HTMLInputElement>('start').value}`;
    const end = `${date}T${field<HTMLInputElement>('end').value}`;
    if (end <= start) {
      error.textContent = 'End time must be after the start time.';
      error.hidden = false;
      return false;
    }
    const activity: Activity = {
      id: editing?.id ?? newId(),
      source: editing?.source ?? 'manual',
      url: editing?.url,
      title: field<HTMLInputElement>('title').value.trim(),
      kind: field<HTMLSelectElement>('kind').value as ActivityKind,
      start,
      end,
    };
    void db.activities.put(activity).then(onChange);
    return true;
  };

  const dialog = openDialog({
    title: editing ? 'Edit calendar entry' : 'Add to your calendar',
    body: form,
    actions: [
      ...(editing
        ? [
            {
              label: 'Delete',
              variant: 'brown' as const,
              onClick: () =>
                void db.activities.delete(editing.id).then(onChange),
            },
          ]
        : []),
      { label: 'Cancel' },
      {
        label: editing ? 'Save' : 'Add entry',
        variant: 'primary',
        onClick: save,
      },
    ],
  });

  // Enter in a field submits the form.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (save()) dialog.close();
  });
}
