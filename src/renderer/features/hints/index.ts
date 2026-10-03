// Hints (#51): live prompts under each field of the entry form, and a hint
// count on each row of the Journal list.

import './hints.css';
import type { Ksb } from '../../../shared/types';
import { escapeHtml } from '../../ui/dom';
import { registerEditorExtension } from '../journal/editor';
import type { Entry } from '../journal/entries';
import { currentKsbs } from '../journal/entries';
import { visibleHints } from './rules';

export { completeness, getHints, visibleHints } from './rules';
export type { Completeness, Hint } from './rules';

export function registerHints() {
  registerEditorExtension((editor, ksbs) => {
    const render = () => {
      const reflection = editor.getEntry().reflection;
      const hints = visibleHints(reflection, ksbs);
      editor.element
        .querySelectorAll<HTMLElement>('[data-hint-for]')
        .forEach((slot) => {
          slot.innerHTML = hints
            .filter((h) => h.field === slot.dataset.hintFor)
            .map(
              (h) => `
              <div class="hint" role="note">
                <span class="hint-icon" aria-hidden="true">💡</span>
                <span class="hint-text">${escapeHtml(h.message)}</span>
                <button type="button" class="hint-dismiss" data-dismiss-hint="${escapeHtml(h.id)}">Not relevant</button>
              </div>`,
            )
            .join('');
        });
    };

    const onClick = (e: Event) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-dismiss-hint]',
      )?.dataset.dismissHint;
      if (!id) return;
      const reflection = editor.getEntry().reflection;
      reflection.dismissedHints = [...(reflection.dismissedHints ?? []), id];
      editor.notifyChange(); // marks unsaved and re-renders via entry-change
    };

    editor.element.addEventListener('entry-change', render);
    editor.element.addEventListener('click', onClick);
    render();
    return () => {
      editor.element.removeEventListener('entry-change', render);
      editor.element.removeEventListener('click', onClick);
    };
  });

  // Hint counts in the Journal list ("💡 2 hints").
  let ksbs: Ksb[] | undefined;
  document.addEventListener('journal-list-rendered', async (e) => {
    const list = e.target as HTMLElement;
    const entries = (e as CustomEvent<Entry[]>).detail;
    ksbs ??= await currentKsbs();
    for (const { reflection } of entries) {
      const slot = list.querySelector<HTMLElement>(
        `[data-hints-for="${reflection.id}"]`,
      );
      if (!slot) continue;
      const count = visibleHints(reflection, ksbs, Infinity).length;
      slot.textContent = count
        ? ` · 💡 ${count} hint${count === 1 ? '' : 's'}`
        : '';
    }
  });
}
