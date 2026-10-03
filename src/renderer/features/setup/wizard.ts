// The setup wizard dialog: You → Standard → KSBs → Review dates → OTJ target.
// Every step is pre-filled from the database, so reopening it edits rather than resets.

import type { Ksb, KsbType, ReviewKind, Standard } from '../../../shared/types';
import { openDialog } from '../../ui/dialog';
import { escapeHtml } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { blankStandard } from './standards';
import {
  loadWizard,
  newReview,
  REVIEW_LABELS,
  saveWizard,
  type WizardData,
  type WizardState,
} from './state';

interface Step {
  label: string;
  render(): string;
  /** Returns an error message, or '' if the step is complete. */
  validate(): string;
}

const TYPE_LABELS: Record<KsbType, string> = {
  K: 'Knowledge',
  S: 'Skill',
  B: 'Behaviour',
  General: 'General skill',
};
const TYPES = Object.keys(TYPE_LABELS) as KsbType[];
const CODE_PREFIX: Record<KsbType, string> = {
  K: 'K',
  S: 'S',
  B: 'B',
  General: 'G',
};

export async function openSetupWizard(
  onFinish?: (state: WizardState) => void,
): Promise<void> {
  const data = await loadWizard();
  const { state } = data;
  let current = 0;
  let filter: KsbType | 'all' = 'all';

  const steps: Step[] = [
    {
      label: 'You',
      render: () => renderYou(state),
      validate: () => validateYou(state),
    },
    {
      label: 'Standard',
      render: () => renderStandard(data),
      validate: () => '',
    },
    {
      label: 'KSBs',
      render: () => renderKsbs(data, filter),
      validate: () => validateKsbs(state.standard.ksbs),
    },
    {
      label: 'Review dates',
      render: () => renderReviews(state),
      validate: () => validateReviews(state),
    },
    {
      label: 'OTJ target',
      render: () => renderOtj(state),
      validate: () => validateOtj(state),
    },
  ];

  const root = document.createElement('form');
  root.className = 'setup';
  root.noValidate = true;
  root.innerHTML = `
    <ol class="setup-steps"></ol>
    <div class="setup-step"></div>
    <p class="setup-error" role="alert"></p>
    <footer class="setup-footer">
      <button type="button" class="btn btn-secondary" data-action="back">Back</button>
      <span class="setup-footer-spacer"></span>
      <button type="submit" class="btn btn-primary" data-action="next"></button>
    </footer>`;
  const q = <T extends HTMLElement>(sel: string) =>
    root.querySelector(sel) as T;

  let shown = -1;
  function render() {
    q('.setup-steps').innerHTML = steps
      .map(
        (s, i) => `
        <li><button type="button" class="setup-step-tab ${i === current ? 'is-active' : ''} ${i < current ? 'is-done' : ''}"
          data-action="goto" data-index="${i}" ${i === current ? 'aria-current="step"' : ''}>
          <span class="setup-step-number">${i + 1}</span>${s.label}
        </button></li>`,
      )
      .join('');
    q('.setup-step').innerHTML = steps[current].render();
    q('.setup-error').textContent = '';
    q<HTMLButtonElement>('[data-action="back"]').hidden = current === 0;
    q('[data-action="next"]').textContent =
      current === steps.length - 1 ? 'Finish' : 'Next';
    refreshLive();
    // A new step starts at the top of the (scrolling) dialog body.
    if (shown !== current) root.parentElement?.scrollTo({ top: 0 });
    shown = current;
  }

  function showError(message: string) {
    const error = q('.setup-error');
    error.textContent = message;
    error.scrollIntoView({ block: 'nearest' });
  }

  /** Parts of a step that update while typing, without re-rendering inputs. */
  function refreshLive() {
    const warning = root.querySelector<HTMLElement>('.setup-warning-slot');
    if (warning) warning.innerHTML = renderMismatch(data, current === 2);
    const total = root.querySelector<HTMLElement>('.setup-otj-total');
    if (total) total.textContent = otjTotal(state);
  }

  /** Move to step `target`, checking the steps in between first. */
  function goTo(target: number) {
    for (let i = current; i < target; i++) {
      const error = steps[i].validate();
      if (error) {
        if (i !== current) {
          current = i;
          render();
        }
        showError(error);
        return;
      }
    }
    current = target;
    if (current === 3) sortReviews(state);
    render();
  }

  async function finish() {
    for (let i = 0; i < steps.length; i++) {
      const error = steps[i].validate();
      if (error) {
        current = i;
        render();
        showError(error);
        return;
      }
    }
    const next = q<HTMLButtonElement>('[data-action="next"]');
    next.disabled = true;
    try {
      await saveWizard(state);
      dialog.close();
      onFinish?.(state);
    } catch (err) {
      console.error(err);
      showError(`Couldn't save: ${String(err)}`);
      next.disabled = false;
    }
  }

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    if (current === steps.length - 1) void finish();
    else goTo(current + 1);
  });

  root.addEventListener('input', (e) => {
    updateField(state, e.target as HTMLInputElement);
    refreshLive();
  });

  root.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.name === 'standard') {
      chooseStandard(data, target.value);
      render();
    } else if (target.dataset.field === 'type') {
      render(); // filter counts change
    }
  });

  root.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-action]',
    );
    if (!button || button.dataset.action === 'next') return;
    const index = Number(button.dataset.index);
    const ksbs = state.standard.ksbs;
    switch (button.dataset.action) {
      case 'back':
        current = Math.max(0, current - 1);
        render();
        return;
      case 'goto':
        if (index <= current) {
          current = index;
          render();
        } else goTo(index);
        return;
      case 'filter':
        filter = button.dataset.filter as KsbType | 'all';
        render();
        return;
      case 'add-ksb':
      case 'add-general': {
        const type: KsbType =
          button.dataset.action === 'add-general'
            ? 'General'
            : filter === 'all' || filter === 'General'
              ? 'K'
              : filter;
        ksbs.push({
          code: nextCode(ksbs, type),
          type,
          title: '',
          keywords: [],
        });
        if (filter !== 'all' && filter !== type) filter = 'all';
        render();
        root
          .querySelector<HTMLInputElement>(
            `[data-ksb="${ksbs.length - 1}"][data-field="title"]`,
          )
          ?.focus();
        return;
      }
      case 'remove-ksb':
        ksbs.splice(index, 1);
        render();
        return;
      case 'add-review':
        state.reviews.push(newReview());
        render();
        root
          .querySelector<HTMLInputElement>(
            `[data-review="${state.reviews.length - 1}"][data-field="date"]`,
          )
          ?.focus();
        return;
      case 'remove-review':
        state.reviews.splice(index, 1);
        render();
        return;
    }
  });

  render();
  const dialog = openDialog({
    title: 'Set up Canopy',
    body: root,
    wide: true,
  });
}

// --- Step 1: You ---

function renderYou(state: WizardState): string {
  return `
    <p class="setup-intro">Tell Canopy about your apprenticeship. You can change any of this later by clicking your avatar.</p>
    <label class="field"><span>Your name</span>
      <input class="input" data-bind="name" autocomplete="name" placeholder="e.g. Alex Smith" value="${escapeHtml(state.name)}">
    </label>
    <div class="setup-row">
      <label class="field"><span>Apprenticeship start</span>
        <input class="input" type="date" data-bind="start" value="${state.start}">
      </label>
      <label class="field"><span>Planned end</span>
        <input class="input" type="date" data-bind="end" value="${state.end}">
      </label>
    </div>`;
}

function validateYou(state: WizardState): string {
  if (!state.name.trim()) return 'Enter your name.';
  if (state.start && state.end && state.end <= state.start)
    return 'The end date must be after the start date.';
  return '';
}

// --- Step 2: Standard ---

function renderStandard(data: WizardData): string {
  const { state, options, savedIds } = data;
  const isBlank = !options.some((o) => o.id === state.standard.id);
  const option = (s: Standard) => {
    const selected = s.id === state.standard.id;
    const source = savedIds.has(s.id)
      ? 'Saved on this device'
      : 'Official KSBs from IfATE';
    return `
      <label class="setup-option ${selected ? 'is-selected' : ''}">
        <input type="radio" name="standard" value="${escapeHtml(s.id)}" ${selected ? 'checked' : ''}>
        <span class="setup-option-main">
          <b>${escapeHtml(s.name)}</b>
          <span class="setup-option-meta">${countSummary(selected ? state.standard.ksbs : s.ksbs)} · ${source}</span>
        </span>
        ${s.reference ? `<span class="badge">${escapeHtml(s.reference)}</span>` : ''}
      </label>`;
  };
  const sources = options.filter((o) => o.sourceUrl);
  return `
    <p class="setup-intro">Pick the apprenticeship standard you're on. Its KSBs are used to tag journal entries and track your evidence.</p>
    <div class="setup-options" role="radiogroup" aria-label="Standard">
      ${options.map(option).join('')}
      <label class="setup-option ${isBlank ? 'is-selected' : ''}">
        <input type="radio" name="standard" value="" ${isBlank ? 'checked' : ''}>
        <span class="setup-option-main">
          <b>Start blank</b>
          <span class="setup-option-meta">Add your own KSBs and general skills in the next step</span>
        </span>
      </label>
    </div>
    <div class="setup-warning-slot"></div>
    ${
      sources.length
        ? `<p class="setup-note">KSB wording is copied from the official standards: ${sources
            .map(
              (s) =>
                `<a href="${escapeHtml(s.sourceUrl!)}" target="_blank" rel="noreferrer">${escapeHtml(s.reference ?? s.name)}</a>`,
            )
            .join(', ')}. You can edit them in the next step.</p>`
        : ''
    }`;
}

function chooseStandard(data: WizardData, id: string) {
  if (id === data.state.standard.id) return;
  const option = data.options.find((o) => o.id === id);
  data.state.standard = option ? structuredClone(option) : blankStandard();
}

/** Warns when journal tags don't exist in the chosen standard. Nothing is deleted. */
function renderMismatch(data: WizardData, always: boolean): string {
  const { state, taggedCodes } = data;
  const switched = state.standard.id !== state.originalStandardId;
  if (!switched && !always) return '';
  const codes = new Set(state.standard.ksbs.map((k) => k.code.trim()));
  const missing = [...taggedCodes].filter((c) => !codes.has(c)).sort();
  if (!missing.length) return '';
  const list = missing.slice(0, 8).map(escapeHtml).join(', ');
  const more = missing.length > 8 ? ` and ${missing.length - 8} more` : '';
  return `
    <p class="setup-warning">
      ${missing.length === 1 ? 'One code' : `${missing.length} codes`} used in your journal tags ${missing.length === 1 ? "isn't" : "aren't"} in this standard (${list}${more}).
      Nothing will be deleted, but those tags won't match a KSB until you add the codes here or re-tag the entries.
    </p>`;
}

// --- Step 3: KSBs ---

function renderKsbs(data: WizardData, filter: KsbType | 'all'): string {
  const { standard } = data.state;
  const count = (t: KsbType) =>
    standard.ksbs.filter((k) => k.type === t).length;
  const chip = (value: KsbType | 'all', label: string, n: number) =>
    `<button type="button" class="chip ${filter === value ? 'is-active' : ''}" data-action="filter" data-filter="${value}">${label} (${n})</button>`;
  const rows = standard.ksbs
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => filter === 'all' || k.type === filter);
  return `
    <label class="field"><span>Standard name</span>
      <input class="input" data-bind="standardName" value="${escapeHtml(standard.name)}">
    </label>
    <div class="setup-ksb-toolbar">
      <div class="setup-filters">
        ${chip('all', 'All', standard.ksbs.length)}
        ${TYPES.map((t) => chip(t, TYPE_LABELS[t], count(t))).join('')}
      </div>
      <div class="setup-ksb-add">
        <button type="button" class="btn btn-secondary" data-action="add-ksb">${icon('plus', 16)}KSB</button>
        <button type="button" class="btn btn-secondary" data-action="add-general">${icon('plus', 16)}General skill</button>
      </div>
    </div>
    <p class="setup-note">Keywords drive KSB suggestions in the journal: if a reflection mentions one, the KSB is suggested.</p>
    <div class="setup-ksb-list">
      ${rows.length ? rows.map(({ k, i }) => renderKsbRow(k, i)).join('') : '<p class="setup-empty">No KSBs here yet. Add one above.</p>'}
    </div>
    <div class="setup-warning-slot"></div>`;
}

function renderKsbRow(k: Ksb, i: number): string {
  return `
    <div class="setup-ksb">
      <input class="input setup-ksb-code" data-ksb="${i}" data-field="code" aria-label="Code" value="${escapeHtml(k.code)}">
      <select class="input" data-ksb="${i}" data-field="type" aria-label="Type">
        ${TYPES.map((t) => `<option value="${t}" ${t === k.type ? 'selected' : ''}>${TYPE_LABELS[t]}</option>`).join('')}
      </select>
      <input class="input" data-ksb="${i}" data-field="title" aria-label="Title" placeholder="Short title, e.g. Communication" value="${escapeHtml(k.title)}">
      <button type="button" class="btn btn-icon btn-ghost" data-action="remove-ksb" data-index="${i}" aria-label="Remove ${escapeHtml(k.code)}" title="Remove">${icon('x', 16)}</button>
      <input class="input setup-ksb-keywords" data-ksb="${i}" data-field="keywords" aria-label="Keywords"
        placeholder="Keywords, comma separated (e.g. present, explain, stakeholder)" value="${escapeHtml(k.keywords.join(', '))}">
      ${k.detail ? `<p class="setup-ksb-detail">${escapeHtml(k.detail)}</p>` : ''}
    </div>`;
}

function validateKsbs(ksbs: Ksb[]): string {
  const seen = new Set<string>();
  for (const k of ksbs) {
    const code = k.code.trim();
    if (!code) return 'Every KSB needs a code (e.g. K1, S2, G1).';
    if (seen.has(code)) return `The code ${code} is used twice.`;
    if (!k.title.trim()) return `Give ${code} a short title.`;
    seen.add(code);
  }
  return '';
}

/** Next free code for a type, e.g. G3 after G1 and G2. */
function nextCode(ksbs: Ksb[], type: KsbType): string {
  const prefix = CODE_PREFIX[type];
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const max = Math.max(
    0,
    ...ksbs.map((k) => Number(pattern.exec(k.code.trim())?.[1] ?? 0)),
  );
  return `${prefix}${max + 1}`;
}

function countSummary(ksbs: Ksb[]): string {
  const n = (t: KsbType) => ksbs.filter((k) => k.type === t).length;
  const parts = [`${n('K')} K`, `${n('S')} S`, `${n('B')} B`];
  if (n('General')) parts.push(`${n('General')} general`);
  return ksbs.length ? parts.join(' · ') : 'No KSBs yet';
}

// --- Step 4: Review dates ---

function renderReviews(state: WizardState): string {
  const kinds = Object.keys(REVIEW_LABELS) as ReviewKind[];
  const rows = state.reviews
    .map(
      (r, i) => `
      <div class="setup-review">
        <select class="input" data-review="${i}" data-field="kind" aria-label="Review type">
          ${kinds.map((k) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${REVIEW_LABELS[k]}</option>`).join('')}
        </select>
        <input class="input" type="date" data-review="${i}" data-field="date" aria-label="Date" value="${r.date}">
        <input class="input" type="time" data-review="${i}" data-field="time" aria-label="Time" value="${r.time}">
        <button type="button" class="btn btn-icon btn-ghost" data-action="remove-review" data-index="${i}" aria-label="Remove review" title="Remove">${icon('x', 16)}</button>
      </div>`,
    )
    .join('');
  return `
    <p class="setup-intro">Add your progress reviews, tripartite reviews and EPA gateway. Each one appears on your calendar.</p>
    <div class="setup-reviews">
      ${rows || '<p class="setup-empty">No review dates yet.</p>'}
    </div>
    <div><button type="button" class="btn btn-secondary" data-action="add-review">${icon('plus', 16)}Add review date</button></div>
    <p class="setup-note">Targets and feedback already recorded for a review are kept when you change its date.</p>`;
}

function validateReviews(state: WizardState): string {
  return state.reviews.some((r) => !r.date)
    ? 'Pick a date for each review, or remove it.'
    : '';
}

function sortReviews(state: WizardState) {
  state.reviews.sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
  );
}

// --- Step 5: OTJ target ---

function renderOtj(state: WizardState): string {
  return `
    <label class="field setup-otj"><span>Weekly off-the-job training target (hours)</span>
      <input class="input" type="number" min="0" max="40" step="0.5" data-bind="otjHours" value="${state.otjHours}">
    </label>
    <p class="setup-note">Use the figure from your training plan or commitment statement, agreed between you, your employer and your training provider. Canopy uses it to show your progress each week.</p>
    <p class="setup-otj-total"></p>`;
}

function validateOtj(state: WizardState): string {
  return Number.isFinite(state.otjHours) &&
    state.otjHours >= 0 &&
    state.otjHours <= 40
    ? ''
    : 'Enter a weekly target between 0 and 40 hours.';
}

function otjTotal(state: WizardState): string {
  if (!state.start || !state.end || state.end <= state.start) return '';
  const weeks =
    (new Date(state.end).getTime() - new Date(state.start).getTime()) /
    (7 * 86_400_000);
  const total = Math.round(weeks * state.otjHours);
  return `That's about ${total.toLocaleString()} hours over ${Math.round(weeks)} weeks (before holidays).`;
}

// --- Input binding ---

function updateField(state: WizardState, el: HTMLInputElement) {
  const { bind, field, ksb, review } = el.dataset;
  if (bind === 'name') state.name = el.value;
  else if (bind === 'start') state.start = el.value;
  else if (bind === 'end') state.end = el.value;
  else if (bind === 'standardName') state.standard.name = el.value;
  else if (bind === 'otjHours') state.otjHours = el.valueAsNumber;
  else if (ksb !== undefined && field) {
    const k = state.standard.ksbs[Number(ksb)];
    if (field === 'code') k.code = el.value;
    else if (field === 'title') k.title = el.value;
    else if (field === 'type') k.type = el.value as KsbType;
    else if (field === 'keywords')
      k.keywords = el.value
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
  } else if (review !== undefined && field) {
    const r = state.reviews[Number(review)];
    if (field === 'kind') r.kind = el.value as ReviewKind;
    else if (field === 'date') r.date = el.value;
    else if (field === 'time') r.time = el.value;
  }
}
