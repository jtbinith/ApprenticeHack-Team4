// Stop → log dialog (#52). Step 1 confirms the session (time is editable)
// and saves an OtjSession; step 2 is a quick, skippable reflection that is
// saved as a draft Reflection linked to that session.

import { db, newId } from '../db';
import { toLocalDateTime } from '../seed';
import {
  OTJ_CATEGORIES,
  type OtjCategory,
  type OtjSession,
  type Reflection,
} from '../../shared/types';

/** Fired on `window` after a session is saved, so hour totals can refresh. */
export const OTJ_LOGGED_EVENT = 'canopy:otj-logged';

export interface SessionDraft {
  task: string;
  category: OtjCategory;
  minutes: number;
}

export interface LogDialogHandlers {
  /** Session saved — the timer should reset. */
  onLogged(): void;
  /** Session thrown away — the timer should reset. */
  onDiscard(): void;
  /** Dialog closed without logging — the timer stays paused. */
  onBack(): void;
}

let dialog: HTMLDialogElement | null = null;

function getDialog(): HTMLDialogElement {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'timer-dialog';
  document.body.append(dialog);
  return dialog;
}

export function openLogDialog(
  draft: SessionDraft,
  handlers: LogDialogHandlers,
): void {
  const el = getDialog();
  el.innerHTML = `
    <form class="timer-form" data-step="log">
      <div class="eyebrow">Off-the-job learning</div>
      <h2>Log focus session</h2>
      <label>What did you work on?
        <input name="task" required maxlength="120" />
      </label>
      <div class="timer-form-row">
        <label>Category
          <select name="category">
            ${OTJ_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}
          </select>
        </label>
        <label>Minutes
          <input name="minutes" type="number" min="1" max="1440" step="1" required />
        </label>
      </div>
      <div class="timer-form-actions">
        <button type="button" class="btn-ghost" data-action="discard">Discard</button>
        <span class="spacer"></span>
        <button type="button" class="btn-outline" data-action="back">Back</button>
        <button type="submit" class="btn-primary">Log hours</button>
      </div>
    </form>`;

  const form = el.querySelector('form') as HTMLFormElement;
  const field = <T extends HTMLElement>(name: string) =>
    form.elements.namedItem(name) as T;
  field<HTMLInputElement>('task').value = draft.task;
  field<HTMLSelectElement>('category').value = draft.category;
  field<HTMLInputElement>('minutes').value = String(draft.minutes);

  let logged = false;
  el.onclose = () => {
    if (!logged) handlers.onBack();
  };
  form
    .querySelector('[data-action="back"]')!
    .addEventListener('click', () => el.close());
  form
    .querySelector('[data-action="discard"]')!
    .addEventListener('click', () => {
      logged = true;
      el.close();
      handlers.onDiscard();
    });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const session: OtjSession = {
      id: newId(),
      task: field<HTMLInputElement>('task').value.trim(),
      category: field<HTMLSelectElement>('category').value as OtjCategory,
      minutes: Math.round(Number(field<HTMLInputElement>('minutes').value)),
      endedAt: new Date().toISOString(),
      ksbs: [],
      portalStatus: 'draft',
    };
    await db.otjSessions.add(session);
    logged = true;
    handlers.onLogged();
    window.dispatchEvent(new CustomEvent(OTJ_LOGGED_EVENT));
    showReflectionStep(el, session);
  });

  el.showModal();
  field<HTMLInputElement>(draft.task ? 'minutes' : 'task').focus();
}

function showReflectionStep(el: HTMLDialogElement, session: OtjSession): void {
  el.onclose = null;
  el.innerHTML = `
    <form class="timer-form" data-step="reflect">
      <div class="eyebrow">Logged ${session.minutes} min · ${session.category}</div>
      <h2>Quick reflection</h2>
      <p class="timer-form-note">Capture it while it's fresh — you can expand it into a full STAR entry in the Journal.</p>
      <label>What did you do?
        <textarea name="action" rows="3" placeholder="I worked through…"></textarea>
      </label>
      <label>What did you learn?
        <textarea name="result" rows="3" placeholder="I learned… / next time I'd…"></textarea>
      </label>
      <div class="timer-form-actions">
        <span class="spacer"></span>
        <button type="button" class="btn-outline" data-action="skip">Skip</button>
        <button type="submit" class="btn-primary">Save reflection</button>
      </div>
    </form>`;

  const form = el.querySelector('form') as HTMLFormElement;
  const text = (name: string) =>
    (form.elements.namedItem(name) as HTMLTextAreaElement).value.trim();

  form
    .querySelector('[data-action="skip"]')!
    .addEventListener('click', () => el.close());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const action = text('action');
    const result = text('result');
    if (action || result) {
      const reflection: Reflection = {
        id: newId(),
        date: toLocalDateTime(new Date()),
        situation: `Focus session (${session.category}, ${session.minutes} min)`,
        task: session.task,
        action,
        result,
        ksbs: [],
        evidence: [],
        confirmed: false,
        portalStatus: 'draft',
      };
      await db.transaction('rw', db.reflections, db.otjSessions, async () => {
        await db.reflections.add(reflection);
        await db.otjSessions.update(session.id, {
          reflectionId: reflection.id,
        });
      });
    }
    el.close();
  });

  (form.elements.namedItem('action') as HTMLTextAreaElement).focus();
}
