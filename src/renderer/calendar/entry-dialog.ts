// Add / edit a calendar entry (#49). The STAR reflection for an entry is the
// Journal's job (#50); this dialog only edits what sits on the calendar.

import { db, newId } from '../db';
import type { Activity, ActivityKind } from '../../shared/types';
import { dayKey } from './dates';
import { KINDS } from './kinds';

let dialog: HTMLDialogElement | null = null;

function getDialog(): HTMLDialogElement {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'cal-dialog';
  document.body.append(dialog);
  return dialog;
}

export type EntryDialogInput =
  | { mode: 'create'; date: Date; hour?: number }
  | { mode: 'edit'; activity: Activity };

/** Opens the dialog; `onChange` runs after a save or delete. */
export function openEntryDialog(
  input: EntryDialogInput,
  onChange: () => void,
): void {
  const el = getDialog();
  const editing = input.mode === 'edit' ? input.activity : null;

  el.innerHTML = `
    <form class="cal-form">
      <div class="eyebrow">${editing ? 'Edit entry' : 'New entry'}</div>
      <h2>${editing ? 'Edit calendar entry' : 'Add to your calendar'}</h2>
      <label>Title
        <input name="title" required maxlength="120" placeholder="e.g. Mentor check-in" />
      </label>
      <label>Kind
        <select name="kind">
          ${KINDS.map((k) => `<option value="${k.kind}">${k.label}</option>`).join('')}
        </select>
      </label>
      <div class="cal-form-row">
        <label>Date <input name="date" type="date" required /></label>
        <label>Start <input name="start" type="time" required /></label>
        <label>End <input name="end" type="time" required /></label>
      </div>
      <p class="cal-form-error" role="alert" hidden></p>
      <div class="cal-form-actions">
        ${editing ? '<button type="button" class="cal-btn cal-btn-danger" data-action="delete">Delete</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="cal-btn" data-action="cancel">Cancel</button>
        <button type="submit" class="cal-btn cal-btn-primary">${editing ? 'Save' : 'Add entry'}</button>
      </div>
    </form>`;

  const form = el.querySelector('form') as HTMLFormElement;
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
    const end = Math.min(hour + 1, 23);
    field<HTMLSelectElement>('kind').value = 'meeting';
    field<HTMLInputElement>('date').value = dayKey(input.date);
    field<HTMLInputElement>('start').value =
      `${String(hour).padStart(2, '0')}:00`;
    field<HTMLInputElement>('end').value =
      end > hour ? `${String(end).padStart(2, '0')}:00` : '23:59';
  }

  form
    .querySelector('[data-action="cancel"]')!
    .addEventListener('click', () => el.close());
  form
    .querySelector('[data-action="delete"]')
    ?.addEventListener('click', async () => {
      if (!editing) return;
      await db.activities.delete(editing.id);
      el.close();
      onChange();
    });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const date = field<HTMLInputElement>('date').value;
    const start = `${date}T${field<HTMLInputElement>('start').value}`;
    const end = `${date}T${field<HTMLInputElement>('end').value}`;
    if (end <= start) {
      error.textContent = 'End time must be after the start time.';
      error.hidden = false;
      return;
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
    await db.activities.put(activity);
    el.close();
    onChange();
  });

  el.showModal();
  field<HTMLInputElement>('title').focus();
}
