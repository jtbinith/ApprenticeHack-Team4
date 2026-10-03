// The entry form: title, type, date/time, STAR fields, KSB tags, evidence and notes.
// Used in the Journal side panel and in openEntryDialog().
//
// Fires an `entry-change` event (detail: Entry) on its root element whenever the
// content changes, so other features (e.g. hints, #51) can react. Each field has
// an empty `[data-hint-for="<field>"]` slot underneath it for that purpose.

import EditorJS, {
  type OutputData,
  type ToolConstructable,
} from '@editorjs/editorjs';
import Header from '@editorjs/header';
import EditorjsList from '@editorjs/list';
import type { ActivityKind, Ksb } from '../../../shared/types';
import { pad } from '../../seed';
import { escapeHtml } from '../../ui/dom';
import { createEvidenceField } from './evidence';
import { icon } from '../../ui/icons';
import {
  type Entry,
  KIND_LABELS,
  PORTAL_STATUS_LABELS,
  suggestKsbs,
} from './entries';

export const STAR_FIELDS = [
  {
    key: 'situation',
    letter: 'S',
    label: 'Situation',
    prompt: 'What was happening?',
  },
  {
    key: 'task',
    letter: 'T',
    label: 'Task',
    prompt: 'What were you responsible for?',
  },
  { key: 'action', letter: 'A', label: 'Action', prompt: 'What did you do?' },
  {
    key: 'result',
    letter: 'R',
    label: 'Result',
    prompt: 'What happened, and what did you learn?',
  },
] as const;

export type StarField = (typeof STAR_FIELDS)[number]['key'];

export interface EntryEditorOptions {
  isNew: boolean;
  onSave: (entry: Entry) => Promise<void> | void;
  onDelete?: (entry: Entry) => Promise<void> | void;
}

export interface EntryEditor {
  element: HTMLElement;
  /** Current values, including unsaved edits (notes are as of the last change). */
  getEntry(): Entry;
  isDirty(): boolean;
  destroy(): void;
}

export function createEntryEditor(
  initial: Entry,
  ksbs: Ksb[],
  options: EntryEditorOptions,
): EntryEditor {
  const entry: Entry = structuredClone(initial);
  let dirty = false;
  let notes: OutputData | undefined = entry.reflection.notes as
    | OutputData
    | undefined;

  const root = document.createElement('form');
  root.className = 'entry-editor';
  root.noValidate = true;
  const [date, startTime] = entry.activity.start.split('T');
  const endTime = entry.activity.end.split('T')[1];

  root.innerHTML = `
    <label class="field">
      <span>Title</span>
      <input class="input" name="title" required placeholder="e.g. 1:1 with mentor" value="${escapeHtml(entry.activity.title)}">
    </label>
    <div class="entry-row">
      <label class="field"><span>Type</span>
        <select class="input" name="kind">
          ${(Object.keys(KIND_LABELS) as ActivityKind[])
            .map(
              (k) =>
                `<option value="${k}" ${k === entry.activity.kind ? 'selected' : ''}>${KIND_LABELS[k]}</option>`,
            )
            .join('')}
        </select>
      </label>
      <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${date}"></label>
      <label class="field"><span>From</span><input class="input" type="time" name="start" value="${startTime}"></label>
      <label class="field"><span>To</span><input class="input" type="time" name="end" value="${endTime}"></label>
    </div>

    ${STAR_FIELDS.map(
      (f) => `
      <label class="field star-field">
        <span><b class="star-letter">${f.letter}</b>${f.label}</span>
        <textarea class="input" name="${f.key}" rows="2" placeholder="${f.prompt}">${escapeHtml(entry.reflection[f.key])}</textarea>
        <div class="hint-slot" data-hint-for="${f.key}"></div>
      </label>`,
    ).join('')}

    <div class="field">
      <span>KSBs</span>
      <div class="ksb-tags"></div>
      <div class="ksb-suggestions"></div>
      <select class="input ksb-add" aria-label="Add a KSB">
        <option value="">+ Add a KSB…</option>
        ${ksbs.map((k) => `<option value="${k.code}">${k.code} — ${escapeHtml(k.title)}</option>`).join('')}
      </select>
      <div class="hint-slot" data-hint-for="ksbs"></div>
    </div>

    <div class="field">
      <span>Evidence</span>
      <div class="evidence-slot"></div>
      <div class="hint-slot" data-hint-for="evidence"></div>
    </div>

    <div class="field">
      <span>Notes</span>
      <div class="notes-editor"></div>
    </div>

    <footer class="entry-footer">
      <span class="entry-status">${PORTAL_STATUS_LABELS[entry.reflection.portalStatus]}</span>
      <span class="entry-saved" aria-live="polite"></span>
      ${options.onDelete ? `<button type="button" class="btn btn-ghost" data-action="delete" ${options.isNew ? 'hidden' : ''}>Delete</button>` : ''}
      <button type="submit" class="btn btn-primary">Save</button>
    </footer>`;

  const q = <T extends HTMLElement>(sel: string) =>
    root.querySelector(sel) as T;
  const savedLabel = q<HTMLElement>('.entry-saved');

  // --- Reading form values into `entry` ---
  function readForm() {
    const data = new FormData(root);
    const value = (name: string) => String(data.get(name) ?? '');
    entry.activity.title = value('title').trim();
    entry.activity.kind = value('kind') as ActivityKind;
    const day = value('date');
    const start = value('start') || '09:00';
    let end = value('end') || start;
    if (end < start) end = start;
    entry.activity.start = `${day}T${start}`;
    entry.activity.end = `${day}T${end}`;
    for (const f of STAR_FIELDS) entry.reflection[f.key] = value(f.key);
    entry.reflection.date = entry.activity.start;
  }

  function changed() {
    dirty = true;
    savedLabel.textContent = '';
    readForm();
    renderSuggestions();
    root.dispatchEvent(
      new CustomEvent<Entry>('entry-change', { detail: entry }),
    );
  }

  // --- KSB tags ---
  function renderTags() {
    const tags = q<HTMLElement>('.ksb-tags');
    const unconfirmed =
      !entry.reflection.confirmed && entry.reflection.ksbs.length > 0;
    if (!entry.reflection.ksbs.length) {
      tags.innerHTML =
        '<span class="muted">No KSBs tagged yet — pick a suggestion or add one below.</span>';
      return;
    }
    tags.innerHTML =
      entry.reflection.ksbs
        .map((code) => {
          const k = ksbs.find((x) => x.code === code);
          return `<span class="ksb-tag ${unconfirmed ? 'is-unconfirmed' : ''}" title="${escapeHtml(k ? `${k.code}: ${k.title}` : code)}">
            <b class="ksb-code">${code}</b>${k ? `<span class="ksb-title">${escapeHtml(k.title)}</span>` : ''}
            <button type="button" class="ksb-remove" data-remove-ksb="${code}" aria-label="Remove ${code}">${icon('x', 14)}</button>
          </span>`;
        })
        .join('') +
      (unconfirmed
        ? `<span class="ksb-confirm"><span class="muted">Suggested tags — confirm they fit.</span>
            <button type="button" class="btn btn-secondary btn-small" data-action="confirm-ksbs">Confirm tags</button></span>`
        : '');
  }

  function renderSuggestions() {
    const text = [
      entry.activity.title,
      ...STAR_FIELDS.map((f) => entry.reflection[f.key]),
    ].join(' ');
    const suggestions = suggestKsbs(text, ksbs, entry.reflection.ksbs);
    q<HTMLElement>('.ksb-suggestions').innerHTML = suggestions.length
      ? `<span class="muted">Suggested from your writing:</span> ${suggestions
          .map(
            (k) =>
              `<button type="button" class="ksb-tag is-suggestion" data-add-ksb="${k.code}" title="Add ${escapeHtml(`${k.code}: ${k.title}`)}">
                ${icon('plus', 14)}<b class="ksb-code">${k.code}</b><span class="ksb-title">${escapeHtml(k.title)}</span>
              </button>`,
          )
          .join('')}`
      : '';
  }

  function addKsb(code: string) {
    if (!code || entry.reflection.ksbs.includes(code)) return;
    entry.reflection.ksbs.push(code);
    entry.reflection.confirmed = true; // the apprentice chose it
    renderTags();
    changed();
  }

  // --- Evidence (links + files) ---
  const evidenceField = createEvidenceField(entry.reflection.evidence, changed);
  q<HTMLElement>('.evidence-slot').replaceWith(evidenceField.element);

  // --- Events ---
  root.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).closest('.notes-editor')) return;
    if ((e.target as HTMLElement).closest('.evidence')) return;
    changed();
  });

  root.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!target) return;
    if (target.dataset.removeKsb) {
      entry.reflection.ksbs = entry.reflection.ksbs.filter(
        (c) => c !== target.dataset.removeKsb,
      );
      renderTags();
      changed();
    } else if (target.dataset.addKsb) {
      addKsb(target.dataset.addKsb);
    } else if (target.dataset.action === 'confirm-ksbs') {
      entry.reflection.confirmed = true;
      renderTags();
      changed();
    } else if (target.dataset.action === 'delete' && options.onDelete) {
      if (confirm('Delete this entry? This can’t be undone.'))
        await options.onDelete(entry);
    }
  });

  q<HTMLSelectElement>('.ksb-add').addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    addKsb(select.value);
    select.value = '';
  });

  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    readForm();
    const title = q<HTMLInputElement>('[name="title"]');
    if (!entry.activity.title) {
      title.focus();
      title.setCustomValidity('Give the entry a title');
      title.reportValidity();
      title.setCustomValidity('');
      return;
    }
    if (notesEditor) {
      notes = await notesEditor.save();
    }
    entry.reflection.notes = notes?.blocks.length ? notes : undefined;
    await options.onSave(structuredClone(entry));
    dirty = false;
    savedLabel.textContent = 'Saved';
    root
      .querySelector<HTMLElement>('[data-action="delete"]')
      ?.removeAttribute('hidden');
  });

  // --- Notes (Editor.js) ---
  let notesEditor: EditorJS | undefined;
  const notesHolder = q<HTMLElement>('.notes-editor');
  // Editor.js needs its holder in the document; wait a frame for the caller to attach us.
  requestAnimationFrame(() => {
    if (!root.isConnected) return;
    notesEditor = new EditorJS({
      holder: notesHolder,
      minHeight: 60,
      placeholder: 'Anything else — links, learnings, next steps…',
      data: notes,
      tools: {
        header: {
          class: Header as unknown as ToolConstructable,
          config: { levels: [2, 3], defaultLevel: 3 },
        },
        list: {
          class: EditorjsList as unknown as ToolConstructable,
          inlineToolbar: true,
        },
      },
      onChange: async () => {
        notes = await notesEditor?.save();
        changed();
      },
    });
  });

  renderTags();
  renderSuggestions();

  return {
    element: root,
    getEntry: () => entry,
    isDirty: () => dirty,
    destroy() {
      evidenceField.destroy();
      notesEditor?.destroy?.();
      notesEditor = undefined;
    },
  };
}

/** `YYYY-MM-DD` for today, in local time. */
export function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
