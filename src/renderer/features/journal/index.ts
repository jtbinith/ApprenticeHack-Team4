// Journal tab (#50): list of entries on the left, selected entry editor on the right.
//
// Other features use `openEntryDialog()` to open the same form in a dialog.

import './journal.css';
import { liveQuery } from 'dexie';
import type { Ksb, PortalStatus } from '../../../shared/types';
import { registerView } from '../../shell/router';
import { escapeHtml } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { createEntryEditor, type EntryEditor } from './editor';
import {
  currentKsbs,
  deleteEntry,
  draftEntry,
  type Entry,
  formatDate,
  listEntries,
  PORTAL_STATUS_LABELS,
  saveEntry,
} from './entries';

export { openEntryDialog, type OpenEntryOptions } from './entryDialog';
export type { Entry } from './entries';

export function registerJournal() {
  registerView('journal', {
    eyebrow: 'Reflections',
    title: 'Journal',
    mount: mountJournal,
  });
}

function mountJournal(container: HTMLElement): () => void {
  container.innerHTML = `
    <div class="journal">
      <div class="journal-list-pane">
        <div class="journal-toolbar">
          <input class="input" type="search" name="search" placeholder="Search entries…" aria-label="Search entries">
          <select class="input" name="ksb" aria-label="Filter by KSB"><option value="">All KSBs</option></select>
          <select class="input" name="status" aria-label="Filter by status">
            <option value="">Any status</option>
            ${(Object.keys(PORTAL_STATUS_LABELS) as PortalStatus[])
              .map(
                (s) =>
                  `<option value="${s}">${PORTAL_STATUS_LABELS[s]}</option>`,
              )
              .join('')}
          </select>
          <button class="btn btn-primary" data-action="new">${icon('plus')}New</button>
        </div>
        <ul class="journal-list" aria-label="Journal entries"></ul>
      </div>
      <div class="journal-detail"></div>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) =>
    container.querySelector(sel) as T;
  const list = q<HTMLUListElement>('.journal-list');
  const detail = q<HTMLElement>('.journal-detail');
  const search = q<HTMLInputElement>('[name="search"]');
  const ksbFilter = q<HTMLSelectElement>('[name="ksb"]');
  const statusFilter = q<HTMLSelectElement>('[name="status"]');

  let entries: Entry[] = [];
  let ksbs: Ksb[] = [];
  let selectedId: string | null = null; // reflection id
  let editor: EntryEditor | null = null;

  function filtered(): Entry[] {
    const text = search.value.trim().toLowerCase();
    return entries.filter(({ activity, reflection }) => {
      if (ksbFilter.value && !reflection.ksbs.includes(ksbFilter.value))
        return false;
      if (statusFilter.value && reflection.portalStatus !== statusFilter.value)
        return false;
      if (!text) return true;
      return [
        activity.title,
        reflection.situation,
        reflection.task,
        reflection.action,
        reflection.result,
      ]
        .join(' ')
        .toLowerCase()
        .includes(text);
    });
  }

  function renderList() {
    const items = filtered();
    list.innerHTML = items.length
      ? items
          .map(
            ({ activity, reflection }) => `
        <li>
          <button class="journal-item ${reflection.id === selectedId ? 'is-selected' : ''}" data-id="${reflection.id}">
            <span class="dot dot--${activity.kind}"></span>
            <span class="journal-item-main">
              <span class="journal-item-title">${escapeHtml(activity.title || 'Untitled')}</span>
              <span class="journal-item-meta">${formatDate(activity.start)} · ${PORTAL_STATUS_LABELS[reflection.portalStatus]}
                <span class="journal-item-hints" data-hints-for="${reflection.id}"></span></span>
            </span>
            <span class="journal-item-ksbs">${reflection.ksbs.map((k) => `<span class="ksb-tag is-small">${k}</span>`).join('')}</span>
          </button>
        </li>`,
          )
          .join('')
      : `<li class="journal-empty">${entries.length ? 'No entries match your filters.' : 'No journal entries yet. Click “New” to write your first one.'}</li>`;
    container.dispatchEvent(
      new CustomEvent('journal-list-rendered', {
        bubbles: true,
        detail: items,
      }),
    );
  }

  function showEmptyDetail() {
    editor?.destroy();
    editor = null;
    detail.innerHTML = `<div class="journal-detail-empty">${icon('book', 28)}<p>Select an entry, or create a new one.</p></div>`;
  }

  function confirmDiscard(): boolean {
    return (
      !editor?.isDirty() || confirm('You have unsaved changes. Discard them?')
    );
  }

  function openInPanel(entry: Entry, isNew: boolean) {
    editor?.destroy();
    selectedId = entry.reflection.id;
    editor = createEntryEditor(entry, ksbs, {
      isNew,
      async onSave(saved) {
        await saveEntry(saved);
        selectedId = saved.reflection.id;
      },
      async onDelete(toDelete) {
        await deleteEntry(toDelete);
        selectedId = null;
        showEmptyDetail();
      },
    });
    detail.replaceChildren(editor.element);
    renderList();
  }

  list.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>(
      '.journal-item',
    );
    if (
      !item?.dataset.id ||
      item.dataset.id === selectedId ||
      !confirmDiscard()
    )
      return;
    const entry = entries.find((x) => x.reflection.id === item.dataset.id);
    if (entry) openInPanel(entry, false);
  });

  q<HTMLButtonElement>('[data-action="new"]').addEventListener('click', () => {
    if (!confirmDiscard()) return;
    openInPanel(draftEntry(), true);
    detail.querySelector<HTMLInputElement>('[name="title"]')?.focus();
  });

  for (const el of [search, ksbFilter, statusFilter]) {
    el.addEventListener('input', renderList);
  }

  showEmptyDetail();
  currentKsbs().then((loaded) => {
    ksbs = loaded;
    ksbFilter.insertAdjacentHTML(
      'beforeend',
      ksbs
        .map(
          (k) =>
            `<option value="${k.code}">${k.code} — ${escapeHtml(k.title)}</option>`,
        )
        .join(''),
    );
  });

  // Re-render whenever entries change anywhere (dialog, calendar, other tabs).
  const subscription = liveQuery(listEntries).subscribe({
    next(loaded) {
      entries = loaded;
      renderList();
    },
    error: (err) => console.error('Journal: failed to load entries', err),
  });

  return () => {
    subscription.unsubscribe();
    editor?.destroy();
  };
}
