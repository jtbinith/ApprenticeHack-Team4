// Reviews tab (#57): review timeline, countdown, pre-review form with auto-fill,
// and post-review feedback + targets that carry into the next period.

import './reviews.css';
import type {
  FormStatus,
  FormTemplate,
  Review,
  ReviewKind,
  Target,
} from '../../../shared/types';
import { db, newId } from '../../db';
import { registerView } from '../../shell/router';
import { escapeHtml } from '../../ui/dom';
import { icon } from '../../ui/icons';
import {
  daysUntil,
  reviewPeriods,
  type ReviewPeriod,
  upcoming,
} from './periods';
import { autofill, hours, periodStats, type PeriodStats } from './stats';
import { templateFor } from './templates';

export { reviewPeriods, upcoming, type ReviewPeriod } from './periods';
export { periodStats, type PeriodStats } from './stats';

export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
  progress: 'Progress review',
  tripartite: 'Tripartite review',
  'epa-gateway': 'EPA gateway',
};

const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  'not-started': 'Not started',
  draft: 'Draft',
  submitted: 'Submitted',
};

const TARGET_STATUS_LABELS: Record<Target['status'], string> = {
  open: 'In progress',
  met: 'Met',
  carried: 'Carried over',
};

/** Reviews within this many days get a countdown banner and tab badge. */
const NUDGE_DAYS = 14;

export function registerReviews() {
  registerView('reviews', {
    eyebrow: 'Progress reviews',
    title: 'Reviews',
    mount: mountReviews,
  });
  updateTabBadge();
  window.addEventListener('hashchange', updateTabBadge);
}

/** Small "9d" badge on the Reviews tab when a review is close. */
async function updateTabBadge() {
  const next = upcoming(await reviewPeriods());
  const tab = document.querySelector<HTMLElement>('[data-tab="reviews"]');
  if (!tab) return;
  tab.querySelector('.tab-badge')?.remove();
  const days = next ? daysUntil(next.to) : Infinity;
  if (days <= NUDGE_DAYS) {
    tab.insertAdjacentHTML(
      'beforeend',
      `<span class="tab-badge" title="Next review in ${days} days">${days === 0 ? 'today' : `${days}d`}</span>`,
    );
  }
}

const longDate = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

function when(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 0) return `In ${days} days`;
  return days === -1 ? 'Yesterday' : `${-days} days ago`;
}

function mountReviews(container: HTMLElement) {
  let periods: ReviewPeriod[] = [];
  let selectedId: string | undefined;

  container.innerHTML = `
    <div class="reviews-banner" hidden></div>
    <div class="reviews">
      <ol class="review-timeline" aria-label="Reviews"></ol>
      <section class="review-detail"></section>
    </div>`;
  const banner = container.querySelector('.reviews-banner') as HTMLElement;
  const timeline = container.querySelector('.review-timeline') as HTMLElement;
  const detail = container.querySelector('.review-detail') as HTMLElement;

  async function load(message?: string) {
    periods = await reviewPeriods();
    selectedId ??= (upcoming(periods) ?? periods.at(-1))?.review.id;
    renderBanner();
    renderTimeline();
    await renderDetail(message);
    updateTabBadge();
  }

  function renderBanner() {
    const next = upcoming(periods);
    const days = next ? daysUntil(next.to) : Infinity;
    banner.hidden = !next || days > NUDGE_DAYS;
    if (banner.hidden || !next) return;
    banner.innerHTML = `
      ${icon('calendar', 20)}
      <span><b>${REVIEW_KIND_LABELS[next.review.kind]} ${when(days).toLowerCase()}</b> —
      your pre-review form is <b>${FORM_STATUS_LABELS[next.review.formStatus].toLowerCase()}</b>.</span>
      <button class="btn btn-primary btn-small" data-select="${next.review.id}">Prepare form</button>`;
  }

  function renderTimeline() {
    if (!periods.length) {
      timeline.innerHTML = `<li class="review-empty">No reviews yet. Add your review dates in Setup (click your avatar).</li>`;
      return;
    }
    timeline.innerHTML = periods
      .map(({ review, to }) => {
        const days = daysUntil(to);
        return `
        <li>
          <button class="review-node ${review.id === selectedId ? 'is-selected' : ''} ${days < 0 ? 'is-past' : ''}" data-select="${review.id}">
            <span class="review-node-dot"></span>
            <span class="review-node-main">
              <span class="review-node-title">${REVIEW_KIND_LABELS[review.kind]}</span>
              <span class="review-node-meta">${to.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${when(days)}</span>
            </span>
            <span class="review-form-status is-${review.formStatus}">${FORM_STATUS_LABELS[review.formStatus]}</span>
          </button>
        </li>`;
      })
      .join('');
  }

  async function renderDetail(message?: string) {
    const period = periods.find((p) => p.review.id === selectedId);
    if (!period) {
      detail.innerHTML = '';
      return;
    }
    const [stats, template] = await Promise.all([
      periodStats(period),
      templateFor(period.review.formTemplateId),
    ]);
    detail.replaceChildren(reviewDetail(period, stats, template, load));
    if (message) {
      detail.querySelector('.entry-saved')!.textContent = message;
    }
  }

  container.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-select]')
      ?.dataset.select;
    if (!id || id === selectedId) return;
    selectedId = id;
    renderTimeline();
    renderDetail();
  });

  load();
}

function statTiles(stats: PeriodStats): string {
  const evidenced = stats.ksbs.length - stats.gaps.length;
  const accepted = stats.evidenceByStatus.get('accepted') ?? 0;
  const otjPct = stats.otjTargetMinutes
    ? Math.min(
        100,
        Math.round((stats.otjMinutes / stats.otjTargetMinutes) * 100),
      )
    : 0;
  return `
    <div class="stat-tiles">
      <div class="stat"><span class="stat-value">${stats.entries.length}</span><span class="stat-label">Journal entries</span></div>
      <div class="stat"><span class="stat-value">${evidenced}<small>/${stats.ksbs.length}</small></span><span class="stat-label">KSBs evidenced</span></div>
      <div class="stat"><span class="stat-value">${hours(stats.otjMinutes)}<small>/${hours(stats.otjTargetMinutes)}</small></span><span class="stat-label">OTJ hours</span>
        <div class="progress"><div class="progress-bar" style="width: ${otjPct}%"></div></div></div>
      <div class="stat"><span class="stat-value">${accepted}</span><span class="stat-label">Evidence accepted</span></div>
    </div>`;
}

function reviewDetail(
  period: ReviewPeriod,
  stats: PeriodStats,
  template: FormTemplate,
  reload: (message?: string) => Promise<void>,
): HTMLElement {
  const review: Review = structuredClone(period.review);
  const answers = (review.formAnswers ??= {});
  const days = daysUntil(period.to);
  const root = document.createElement('div');
  root.className = 'review-detail-inner';

  const fieldsHtml = () =>
    template.fields
      .map(
        (f) => `
      <div class="field review-field">
        <div class="review-field-head">
          <span>${escapeHtml(f.label)}</span>
          <button type="button" class="btn btn-ghost btn-small" data-copy="${escapeHtml(f.key)}" title="Copy to paste into your portal">${icon('file', 14)}Copy</button>
        </div>
        <textarea class="input" rows="${f.source ? 4 : 2}" data-answer="${escapeHtml(f.key)}" placeholder="${f.source ? 'Use “Fill from my data”, then edit.' : 'Write your answer…'}">${escapeHtml(answers[f.key] ?? '')}</textarea>
      </div>`,
      )
      .join('');

  root.innerHTML = `
    <header class="review-head">
      <div>
        <div class="eyebrow">${when(days)}</div>
        <h2>${REVIEW_KIND_LABELS[review.kind]}</h2>
        <p class="muted">${longDate(period.to)} · period from ${period.from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
      </div>
    </header>

    ${statTiles(stats)}

    <section class="review-section">
      <div class="review-section-head">
        <h3>Pre-review form</h3>
        <label class="review-status">Status
          <select class="input" data-form-status>
            ${(Object.keys(FORM_STATUS_LABELS) as FormStatus[])
              .map(
                (s) =>
                  `<option value="${s}" ${s === review.formStatus ? 'selected' : ''}>${FORM_STATUS_LABELS[s]}</option>`,
              )
              .join('')}
          </select>
        </label>
        <button type="button" class="btn btn-secondary btn-small" data-action="autofill">${icon('sparkles', 14)}Fill from my data</button>
      </div>
      <div class="review-fields">${fieldsHtml()}</div>
      <details class="review-template">
        <summary>Edit form fields (${escapeHtml(template.provider)})</summary>
        <ul class="template-fields">
          ${template.fields
            .map(
              (
                f,
                i,
              ) => `<li><input class="input" data-template-label="${i}" value="${escapeHtml(f.label)}" aria-label="Field label">
              <button type="button" class="btn btn-icon btn-ghost" data-template-remove="${i}" aria-label="Remove field">${icon('x', 14)}</button></li>`,
            )
            .join('')}
        </ul>
        <div class="template-actions">
          <button type="button" class="btn btn-secondary btn-small" data-action="template-add">${icon('plus', 14)}Add field</button>
          <button type="button" class="btn btn-secondary btn-small" data-action="template-save">Save fields</button>
        </div>
      </details>
    </section>

    <section class="review-section">
      <div class="review-section-head"><h3>After the review</h3>
        ${days > 0 ? '<span class="muted">Fill this in once your review has happened.</span>' : ''}</div>
      <label class="field"><span>Feedback from your coach / manager</span>
        <textarea class="input" rows="3" data-feedback>${escapeHtml(review.feedback ?? '')}</textarea></label>
      <div class="field"><span>Targets for next period</span>
        <ul class="target-list"></ul>
        <button type="button" class="btn btn-secondary btn-small" data-action="target-add">${icon('plus', 14)}Add target</button>
      </div>
    </section>

    <footer class="entry-footer">
      <span class="entry-saved" aria-live="polite"></span>
      <button type="button" class="btn btn-primary" data-action="save">Save review</button>
    </footer>`;

  const q = <T extends HTMLElement>(sel: string) =>
    root.querySelector(sel) as T;
  const saved = q<HTMLElement>('.entry-saved');

  function renderTargets() {
    q<HTMLElement>('.target-list').innerHTML = review.targets.length
      ? review.targets
          .map(
            (t, i) => `
        <li class="target">
          <input class="input" data-target-text="${i}" value="${escapeHtml(t.text)}" placeholder="e.g. Evidence S3 with a real example">
          <select class="input" data-target-status="${i}">
            ${(Object.keys(TARGET_STATUS_LABELS) as Target['status'][])
              .map(
                (s) =>
                  `<option value="${s}" ${s === t.status ? 'selected' : ''}>${TARGET_STATUS_LABELS[s]}</option>`,
              )
              .join('')}
          </select>
          <button type="button" class="btn btn-icon btn-ghost" data-target-remove="${i}" aria-label="Remove target">${icon('x', 14)}</button>
        </li>`,
          )
          .join('')
      : '<li class="muted">No targets yet.</li>';
  }

  function readInputs() {
    root
      .querySelectorAll<HTMLTextAreaElement>('[data-answer]')
      .forEach((ta) => {
        answers[ta.dataset.answer!] = ta.value;
      });
    review.formStatus = q<HTMLSelectElement>('[data-form-status]')
      .value as FormStatus;
    review.feedback = q<HTMLTextAreaElement>('[data-feedback]').value;
    root
      .querySelectorAll<HTMLInputElement>('[data-target-text]')
      .forEach((input) => {
        review.targets[Number(input.dataset.targetText)].text = input.value;
      });
    root
      .querySelectorAll<HTMLSelectElement>('[data-target-status]')
      .forEach((select) => {
        review.targets[Number(select.dataset.targetStatus)].status =
          select.value as Target['status'];
      });
  }

  /** Save typed answers before re-rendering, so editing fields doesn't lose them. */
  async function keepDraft() {
    readInputs();
    review.formTemplateId = template.id;
    await db.reviews.put(review);
  }

  root.addEventListener('input', () => {
    saved.textContent = '';
  });

  root.addEventListener('click', async (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!button) return;
    const action = button.dataset.action;

    if (button.dataset.copy) {
      const ta = root.querySelector<HTMLTextAreaElement>(
        `[data-answer="${button.dataset.copy}"]`,
      );
      await navigator.clipboard.writeText(ta?.value ?? '');
      button.lastChild!.textContent = 'Copied';
      setTimeout(() => (button.lastChild!.textContent = 'Copy'), 1500);
    } else if (action === 'autofill') {
      const filled = autofill(stats);
      const hasText = template.fields.some(
        (f) => f.source && answers[f.key]?.trim(),
      );
      if (
        hasText &&
        !confirm(
          'Replace the auto-filled answers with fresh figures from your data?',
        )
      )
        return;
      for (const f of template.fields) {
        if (!f.source) continue;
        const ta = root.querySelector<HTMLTextAreaElement>(
          `[data-answer="${f.key}"]`,
        );
        if (ta) ta.value = filled[f.source];
      }
      if (review.formStatus === 'not-started') {
        q<HTMLSelectElement>('[data-form-status]').value = 'draft';
      }
      saved.textContent = 'Filled — check and edit before saving';
    } else if (action === 'target-add') {
      readInputs();
      review.targets.push({ id: newId(), text: '', status: 'open' });
      renderTargets();
      root
        .querySelector<HTMLInputElement>(
          `[data-target-text="${review.targets.length - 1}"]`,
        )
        ?.focus();
    } else if (button.dataset.targetRemove) {
      readInputs();
      review.targets.splice(Number(button.dataset.targetRemove), 1);
      renderTargets();
    } else if (action === 'template-add') {
      await keepDraft();
      template.fields.push({
        key: `custom-${newId().slice(0, 8)}`,
        label: 'New question',
      });
      await db.formTemplates.put(template);
      await reload();
    } else if (button.dataset.templateRemove) {
      await keepDraft();
      template.fields.splice(Number(button.dataset.templateRemove), 1);
      await db.formTemplates.put(template);
      await reload();
    } else if (action === 'template-save') {
      await keepDraft();
      root
        .querySelectorAll<HTMLInputElement>('[data-template-label]')
        .forEach((input) => {
          template.fields[Number(input.dataset.templateLabel)].label =
            input.value.trim() || 'Untitled';
        });
      await db.formTemplates.put(template);
      await reload('Form fields saved');
    } else if (action === 'save') {
      readInputs();
      review.formTemplateId = template.id;
      review.targets = review.targets.filter((t) => t.text.trim());
      await db.reviews.put(review);
      await reload('Saved');
    }
  });

  renderTargets();
  return root;
}
