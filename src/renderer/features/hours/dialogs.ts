// "Log hours" (manual OTJ entry) and "Weekly target" dialogs.

import {
  OTJ_CATEGORIES,
  type Ksb,
  type OtjCategory,
  type OtjSession,
} from '../../../shared/types';
import { db, newId } from '../../db';
import { toLocalDateTime } from '../../seed';
import { openDialog } from '../../ui/dialog';
import { escapeHtml } from '../../ui/dom';

export interface LogHoursPrefill {
  task?: string;
  category?: OtjCategory;
  minutes?: number;
  /** When it happened; defaults to now. */
  date?: Date;
  /** Calendar event this is logged from. */
  activityId?: string;
}

const MAX_HOURS = 12;

export async function openLogHoursDialog(
  prefill: LogHoursPrefill = {},
): Promise<void> {
  const ksbs = await loadKsbs();
  const selected = new Set<string>();
  const when = prefill.date ?? new Date();
  const today = toLocalDateTime(new Date()).slice(0, 10);

  const form = document.createElement('form');
  form.className = 'hours-form';
  form.innerHTML = `
    <label class="field">
      <span>Task</span>
      <input class="input" name="task" placeholder="e.g. Uni lecture: Algorithms" value="${escapeHtml(prefill.task ?? '')}" />
    </label>
    <div class="hours-form-row">
      <label class="field">
        <span>OTJ category</span>
        <select class="input" name="category">
          ${OTJ_CATEGORIES.map((c) => `<option${c === (prefill.category ?? 'Self-study') ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Date</span>
        <input class="input" name="date" type="date" max="${today}" value="${toLocalDateTime(when).slice(0, 10)}" />
      </label>
      <label class="field">
        <span>Hours</span>
        <input class="input" name="hours" type="number" min="0.25" max="${MAX_HOURS}" step="0.25" value="${prefill.minutes ? Math.round(prefill.minutes / 15) / 4 : 1}" />
      </label>
    </div>
    ${
      ksbs.length
        ? `<div class="field">
            <span>KSBs (optional)</span>
            <div class="hours-ksbs">
              ${ksbs.map((k) => `<button type="button" class="chip" data-ksb="${escapeHtml(k.code)}" aria-pressed="false" title="${escapeHtml(k.title)}">${escapeHtml(k.code)}</button>`).join('')}
            </div>
          </div>`
        : ''
    }
    <p class="hours-error" role="alert" hidden></p>`;

  form.addEventListener('click', (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-ksb]',
    );
    if (!chip?.dataset.ksb) return;
    const code = chip.dataset.ksb;
    if (selected.has(code)) selected.delete(code);
    else selected.add(code);
    chip.classList.toggle('is-active', selected.has(code));
    chip.setAttribute('aria-pressed', String(selected.has(code)));
  });

  const showError = errorShower(form);
  let saving = false;

  const submit = async () => {
    if (saving) return;
    const data = new FormData(form);
    const task = String(data.get('task') ?? '').trim();
    const category = String(data.get('category')) as OtjCategory;
    const date = String(data.get('date') ?? '');
    const hours = Number(data.get('hours'));

    if (!task) return showError('Add what you worked on.');
    if (!date || date > today) return showError('Pick a date up to today.');
    if (!(hours > 0 && hours <= MAX_HOURS))
      return showError(`Hours must be between 0.25 and ${MAX_HOURS}.`);

    // Keep the original time if the date wasn't changed; otherwise use now
    // (today) or the end of the working day (past dates).
    const endedAt =
      date === toLocalDateTime(when).slice(0, 10)
        ? when
        : date === today
          ? new Date()
          : new Date(`${date}T17:00`);

    const session: OtjSession = {
      id: newId(),
      task,
      category,
      endedAt: endedAt.toISOString(),
      minutes: Math.round(hours * 60),
      ksbs: [...selected],
      portalStatus: 'draft',
      ...(prefill.activityId ? { activityId: prefill.activityId } : {}),
    };

    saving = true;
    try {
      await db.otjSessions.add(session);
      dialog.close();
    } catch (err) {
      console.error(err);
      showError(`Could not save: ${String(err)}`);
    } finally {
      saving = false;
    }
  };

  // Enter in a field submits instead of reloading the page.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });

  const dialog = openDialog({
    title: 'Log off-the-job hours',
    body: form,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Log hours',
        variant: 'primary',
        onClick: () => {
          void submit();
          return false;
        },
      },
    ],
  });
}

export async function openTargetDialog(): Promise<void> {
  const settings = await db.settings.get('settings');
  const current = settings?.weeklyOtjTargetHours ?? 6;

  const form = document.createElement('form');
  form.className = 'hours-form';
  form.innerHTML = `
    <label class="field">
      <span>Weekly OTJ target (hours)</span>
      <input class="input" name="target" type="number" min="0.5" max="40" step="0.5" value="${current}" />
    </label>
    <p class="hours-help">Use the figure from your training plan or commitment statement. If you're not sure, check with your provider.</p>
    <p class="hours-error" role="alert" hidden></p>`;

  const showError = errorShower(form);

  const submit = async () => {
    const target = Number(new FormData(form).get('target'));
    if (!(target >= 0.5 && target <= 40))
      return showError('Target must be between 0.5 and 40 hours.');
    try {
      await db.settings.update('settings', { weeklyOtjTargetHours: target });
      dialog.close();
    } catch (err) {
      console.error(err);
      showError(`Could not save: ${String(err)}`);
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });

  const dialog = openDialog({
    title: 'Weekly target',
    body: form,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Save',
        variant: 'primary',
        onClick: () => {
          void submit();
          return false;
        },
      },
    ],
  });
}

function errorShower(form: HTMLElement) {
  const el = form.querySelector('.hours-error') as HTMLElement;
  return (message: string) => {
    el.textContent = message;
    el.hidden = false;
  };
}

async function loadKsbs(): Promise<Ksb[]> {
  const settings = await db.settings.get('settings');
  if (!settings?.standardId) return [];
  const standard = await db.standards.get(settings.standardId);
  return standard?.ksbs ?? [];
}
