// KSBs tab (#56): coverage heatmap (evidenced vs accepted per review period),
// gaps in the current period with suggested actions, and "needs attention".
// Everything opens the Journal entry form (#50) so fixes happen in one place.

import './ksbs.css';
import { liveQuery } from 'dexie';
import type { Activity, KsbType } from '../../../shared/types';
import { navigate, registerView } from '../../shell/router';
import { escapeHtml } from '../../ui/dom';
import { openEntryDialog } from '../journal';
import { type Entry, PORTAL_STATUS_LABELS } from '../journal/entries';
import { daysUntil } from '../reviews/periods';
import {
  attention,
  type Column,
  columns,
  type Coverage,
  coverage,
  currentRange,
  type Gap,
  gaps,
  type KsbData,
  loadKsbData,
  shortDate,
} from './data';

const TYPE_LABELS: Record<KsbType, string> = {
  K: 'Knowledge',
  S: 'Skills',
  B: 'Behaviours',
  General: 'General skills',
};

/** Max items shown per "needs attention" group before "and N more". */
const LIST_LIMIT = 5;

export function registerKsbs() {
  registerView('ksbs', {
    eyebrow: 'Your framework',
    title: 'KSBs',
    mount(outlet) {
      // Own element, so the click listener goes away with the tab.
      const container = document.createElement('div');
      container.className = 'ksbs';
      outlet.append(container);

      const expanded = new Set<string>();
      let data: KsbData | undefined;
      const render = () => data && renderView(container, data, expanded);

      const subscription = liveQuery(loadKsbData).subscribe({
        next(next) {
          data = next;
          render();
        },
        error: (err) => console.error('KSBs: failed to load', err),
      });

      container.addEventListener('click', (event) => {
        const el = (event.target as HTMLElement).closest<HTMLElement>(
          '[data-action]',
        );
        if (!el || !data) return;
        const { action, id } = el.dataset;
        if (action === 'toggle' && id) {
          if (expanded.has(id)) expanded.delete(id);
          else expanded.add(id);
          render();
        } else if (action === 'entry') {
          const entry = data.entries.find((e) => e.reflection.id === id);
          if (entry) openEntry(entry);
        } else if (action === 'activity' && id) {
          void openEntryDialog({ activityId: id });
        } else if (action === 'new') {
          void openEntryDialog();
        }
      });

      return () => subscription.unsubscribe();
    },
  });
}

function openEntry(entry: Entry) {
  // Focus-timer reflections aren't calendar items; edit them in the Journal.
  if (entry.reflection.activityId) {
    void openEntryDialog({ activityId: entry.reflection.activityId });
  } else {
    navigate('journal');
  }
}

function renderView(
  container: HTMLElement,
  data: KsbData,
  expanded: Set<string>,
) {
  if (!data.ksbs.length) {
    container.innerHTML = `<div class="placeholder">Pick your apprenticeship standard in Setup to see your KSBs.</div>`;
    return;
  }

  const now = new Date();
  const cols = columns(data, now);
  const rows = coverage(data, cols);
  const evidenced = rows.filter((r) => r.entries.length).length;
  const accepted = rows.filter((r) => r.accepted).length;

  container.innerHTML = `
    <p class="ksbs-summary">
      ${escapeHtml(data.standardName)} ·
      <strong>${evidenced} of ${rows.length}</strong> KSBs evidenced ·
      <strong>${accepted}</strong> with accepted evidence
    </p>
    ${coverageCard(rows, cols, expanded)}
    <div class="ksbs-columns">
      ${gapsCard(gaps(data, cols, now), currentRange(cols, now).reviewDate, now)}
      ${attentionCard(data, cols, now)}
    </div>`;
}

// Coverage

function coverageCard(
  rows: Coverage[],
  cols: Column[],
  expanded: Set<string>,
): string {
  const span = cols.length + 4;
  const groups = (Object.keys(TYPE_LABELS) as KsbType[])
    .map((type) => ({ type, rows: rows.filter((r) => r.ksb.type === type) }))
    .filter((g) => g.rows.length);

  return `
    <section class="ksbs-box">
      <div class="ksbs-box-head">
        <h2 class="ksbs-box-title">Coverage</h2>
        <div class="ksbs-legend" aria-hidden="true">
          <span><i class="heat heat--0"></i>None</span>
          <span><i class="heat heat--1"></i>1</span>
          <span><i class="heat heat--2"></i>2</span>
          <span><i class="heat heat--3"></i>3+</span>
          <span><i class="heat heat--1 has-accepted"></i>Includes accepted</span>
        </div>
      </div>
      <table class="ksbs-heat">
        <thead>
          <tr>
            <th scope="col">KSB</th>
            ${cols.map((c) => `<th scope="col" class="ksbs-period${c.current ? ' is-current' : ''}">${c.current ? 'This period' : escapeHtml(c.label)}</th>`).join('')}
            <th scope="col" class="ksbs-num">Evidenced</th>
            <th scope="col" class="ksbs-num">Accepted</th>
            <th scope="col">Strength</th>
          </tr>
        </thead>
        <tbody>
          ${groups
            .map(
              (g) => `
            <tr class="ksbs-group"><th colspan="${span}" scope="colgroup">${TYPE_LABELS[g.type]}</th></tr>
            ${g.rows.map((r) => coverageRow(r, cols, expanded.has(r.ksb.code), span)).join('')}`,
            )
            .join('')}
        </tbody>
      </table>
      <p class="ksbs-help">Strength is how complete the tagged entries are on average (from the hints checks). Click a KSB to see its evidence.</p>
    </section>`;
}

function coverageRow(
  row: Coverage,
  cols: Column[],
  isOpen: boolean,
  span: number,
): string {
  const { ksb } = row;
  const strength = Math.round(row.strength * 100);
  const cells = row.perColumn
    .map(({ count, accepted }, i) => {
      const level = Math.min(count, 3);
      const label = `${count} entr${count === 1 ? 'y' : 'ies'}${accepted ? `, ${accepted} accepted` : ''} (${cols[i].current ? 'this period' : cols[i].label.toLowerCase()})`;
      return `<td><span class="heat heat--${level}${accepted ? ' has-accepted' : ''}" title="${label}" aria-label="${label}">${count || ''}</span></td>`;
    })
    .join('');

  return `
    <tr class="ksbs-row${isOpen ? ' is-open' : ''}">
      <th scope="row">
        <button class="ksbs-ksb" data-action="toggle" data-id="${escapeHtml(ksb.code)}" aria-expanded="${isOpen}">
          <span class="ksbs-code">${escapeHtml(ksb.code)}</span>
          <span class="ksbs-title">${escapeHtml(ksb.title)}</span>
        </button>
      </th>
      ${cells}
      <td class="ksbs-num">${row.entries.length}</td>
      <td class="ksbs-num">${row.accepted}</td>
      <td>
        ${
          row.entries.length
            ? `<div class="ksbs-strength" title="${strength}% complete on average">
                <div class="progress"><div class="progress-bar" style="width: ${strength}%"></div></div>
                <span>${strength}%</span>
              </div>`
            : '<span class="ksbs-muted">–</span>'
        }
      </td>
    </tr>
    ${
      isOpen
        ? `<tr class="ksbs-detail"><td colspan="${span}">
            ${
              row.entries.length
                ? `<ul class="ksbs-list">${row.entries.map((e) => entryItem(e)).join('')}</ul>`
                : '<p class="ksbs-muted">No evidence yet. See Gaps for a suggestion.</p>'
            }
          </td></tr>`
        : ''
    }`;
}

function entryItem(entry: Entry, meta?: string): string {
  const status = entry.reflection.portalStatus;
  return `
    <li>
      <button class="ksbs-item" data-action="entry" data-id="${escapeHtml(entry.reflection.id)}">
        <span class="ksbs-item-main">
          <span class="ksbs-item-title">${escapeHtml(entry.activity.title || 'Untitled')}</span>
          <span class="ksbs-item-meta">${shortDate(entry.activity.start)}${meta ? ` · ${meta}` : ''}</span>
        </span>
        <span class="ksbs-status ksbs-status--${status}">${PORTAL_STATUS_LABELS[status]}</span>
      </button>
    </li>`;
}

function activityItem(activity: Activity, meta: string): string {
  return `
    <li>
      <button class="ksbs-item" data-action="activity" data-id="${escapeHtml(activity.id)}">
        <span class="ksbs-item-main">
          <span class="ksbs-item-title">${escapeHtml(activity.title)}</span>
          <span class="ksbs-item-meta">${meta}</span>
        </span>
      </button>
    </li>`;
}

// Gaps

function gapsCard(list: Gap[], reviewDate: Date | null, now: Date): string {
  const days = reviewDate ? daysUntil(reviewDate, now) : null;
  return `
    <section class="ksbs-box">
      <div class="ksbs-box-head">
        <h2 class="ksbs-box-title">Gaps this period</h2>
        ${days !== null ? `<span class="badge">Review in ${days} day${days === 1 ? '' : 's'}</span>` : ''}
      </div>
      ${
        list.length
          ? `<ul class="ksbs-gaps">${list.map(gapItem).join('')}</ul>`
          : '<p class="ksbs-muted">Every KSB has evidence this period. Nice work.</p>'
      }
    </section>`;
}

function gapItem({ ksb, target, suggestion }: Gap): string {
  let text: string;
  let button = '';
  switch (suggestion.kind) {
    case 'reflect':
      text = `Reflect on <strong>${escapeHtml(suggestion.activity.title)}</strong> (${shortDate(suggestion.activity.start)}).`;
      button = `<button class="btn btn-secondary" data-action="activity" data-id="${escapeHtml(suggestion.activity.id)}">Reflect</button>`;
      break;
    case 'upcoming':
      text = `Coming up: <strong>${escapeHtml(suggestion.activity.title)}</strong> on ${shortDate(suggestion.activity.start)}. Reflect on it afterwards.`;
      button = `<button class="btn btn-ghost" data-action="activity" data-id="${escapeHtml(suggestion.activity.id)}">View</button>`;
      break;
    case 'tag':
      text = `<strong>${escapeHtml(suggestion.entry.activity.title || 'An entry')}</strong> mentions this. Tag ${escapeHtml(ksb.code)} and add a line on how it shows it.`;
      button = `<button class="btn btn-secondary" data-action="entry" data-id="${escapeHtml(suggestion.entry.reflection.id)}">Open</button>`;
      break;
    case 'new':
      text =
        'Nothing on your calendar matches yet. Write an entry about a time you showed this.';
      button = `<button class="btn btn-secondary" data-action="new">New entry</button>`;
      break;
  }
  return `
    <li class="ksbs-gap">
      <div class="ksbs-gap-main">
        <div class="ksbs-gap-title">
          <span class="ksbs-code">${escapeHtml(ksb.code)}</span> ${escapeHtml(ksb.title)}
          ${target ? `<span class="ksbs-target" title="${escapeHtml(target.text)}">Review target</span>` : ''}
        </div>
        <div class="ksbs-gap-text">${text}</div>
      </div>
      ${button}
    </li>`;
}

// Needs attention

function attentionCard(data: KsbData, cols: Column[], now: Date): string {
  const { changesRequested, incomplete, unreflected } = attention(
    data,
    cols,
    now,
  );
  const total =
    changesRequested.length + incomplete.length + unreflected.length;

  const group = (title: string, items: string[]) =>
    items.length
      ? `<h3 class="ksbs-subtitle">${title} <span class="ksbs-count">${items.length}</span></h3>
         <ul class="ksbs-list">${items.slice(0, LIST_LIMIT).join('')}</ul>
         ${items.length > LIST_LIMIT ? `<p class="ksbs-muted">and ${items.length - LIST_LIMIT} more</p>` : ''}`
      : '';

  return `
    <section class="ksbs-box">
      <div class="ksbs-box-head">
        <h2 class="ksbs-box-title">Needs attention</h2>
        ${total ? `<span class="badge">${total}</span>` : ''}
      </div>
      ${
        total
          ? [
              group(
                'Changes requested',
                changesRequested.map((e) =>
                  entryItem(
                    e,
                    e.reflection.assessorComment
                      ? `“${escapeHtml(e.reflection.assessorComment)}”`
                      : 'Your assessor asked for changes',
                  ),
                ),
              ),
              group(
                'Incomplete entries',
                incomplete.map(({ entry, passed, total: checks, hint }) =>
                  entryItem(
                    entry,
                    `${passed}/${checks} complete${hint ? ` · ${escapeHtml(hint)}` : ''}`,
                  ),
                ),
              ),
              group(
                'Not reflected on yet',
                unreflected.map((a) =>
                  activityItem(a, `${shortDate(a.start)} · No reflection yet`),
                ),
              ),
            ].join('')
          : '<p class="ksbs-muted">Nothing needs attention right now.</p>'
      }
    </section>`;
}
