// Hours tab (#53): OTJ hours for this week / review period / apprenticeship,
// projections, breakdowns by category and KSB, the weekly "garden" + streak,
// suggestions from calendar events and recent sessions.

import { liveQuery } from 'dexie';
import { db } from '../../db';
import { registerView } from '../../shell/router';
import { escapeHtml } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { openLogHoursDialog, openTargetDialog } from './dialogs';
import {
  activityMinutes,
  addDays,
  byCategory,
  byKsb,
  currentPeriod,
  formatDate,
  formatHours,
  guessCategory,
  loadHoursData,
  otjSuggestions,
  sessionsIn,
  startOfWeek,
  totalMinutes,
  weeklyPace,
  weeklyStreak,
  weeklyTargetMinutes,
  weeklyTotals,
  weeksBetween,
  type HoursData,
} from './stats';

type Scope = 'week' | 'period' | 'total';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'period', label: 'This period' },
  { id: 'total', label: 'All time' },
];

const GARDEN_WEEKS = 8;
const RECENT_COUNT = 8;

let scope: Scope = 'period';

export function registerHoursView() {
  registerView('hours', {
    eyebrow: 'Off-the-job',
    title: 'Hours',
    customHeader: true,
    mount(outlet) {
      // Own element, so listeners go away with the tab (the outlet is reused).
      const container = document.createElement('div');
      outlet.append(container);
      let data: HoursData | undefined;
      const render = () => data && renderView(container, data);

      const subscription = liveQuery(loadHoursData).subscribe({
        next: (next) => {
          data = next;
          render();
        },
        error: console.error,
      });

      container.addEventListener('click', (event) => {
        const el = (event.target as HTMLElement).closest<HTMLElement>(
          '[data-action]',
        );
        if (!el || !data) return;
        const { action, id } = el.dataset;
        if (action === 'log') void openLogHoursDialog();
        else if (action === 'target') void openTargetDialog();
        else if (action === 'scope') {
          scope = id as Scope;
          render();
        } else if (action === 'suggest') {
          const activity = data.learning.find((a) => a.id === id);
          if (activity)
            void openLogHoursDialog({
              task: activity.title,
              category: guessCategory(activity.title),
              minutes: activityMinutes(activity),
              date: new Date(activity.end),
              activityId: activity.id,
            });
        } else if (action === 'delete') {
          const session = data.sessions.find((s) => s.id === id);
          if (session && confirm(`Delete "${session.task}"?`))
            void db.otjSessions.delete(session.id);
        }
      });

      return () => subscription.unsubscribe();
    },
  });
}

function renderView(container: HTMLElement, data: HoursData) {
  const now = new Date();
  const target = weeklyTargetMinutes(data);
  const pace = weeklyPace(data.sessions, now);

  // This week
  const week = startOfWeek(now);
  const weekEnd = addDays(week, 7);
  const weekLogged = totalMinutes(sessionsIn(data.sessions, week, weekEnd));
  const weekLeft = target - weekLogged;

  // Review period
  const period = currentPeriod(data, now);
  const periodLogged = totalMinutes(
    sessionsIn(data.sessions, period.start, null),
  );
  const periodTarget = period.end
    ? weeksBetween(period.start, period.end) * target
    : null;
  const periodProjected = period.end
    ? periodLogged + pace * weeksBetween(now, period.end)
    : null;
  const daysToReview = period.end
    ? Math.ceil((period.end.getTime() - now.getTime()) / 86_400_000)
    : null;

  // Whole apprenticeship
  const start = data.settings?.apprenticeshipStart
    ? new Date(data.settings.apprenticeshipStart)
    : null;
  const end = data.settings?.apprenticeshipEnd
    ? new Date(data.settings.apprenticeshipEnd)
    : null;
  const totalLogged = totalMinutes(data.sessions);
  const totalTarget = start && end ? weeksBetween(start, end) * target : null;
  const totalProjected = end
    ? totalLogged + pace * weeksBetween(now, end)
    : null;

  const scoped =
    scope === 'week'
      ? sessionsIn(data.sessions, week, weekEnd)
      : scope === 'period'
        ? sessionsIn(data.sessions, period.start, null)
        : data.sessions;

  container.innerHTML = `
    <div class="hours-header">
      <div>
        <div class="eyebrow">Off-the-job</div>
        <h1 class="view-title">Hours</h1>
      </div>
      <div class="hours-header-actions">
        <button class="btn btn-secondary" data-action="target">Weekly target: ${formatHours(target)}h</button>
        <button class="btn btn-primary" data-action="log">${icon('plus', 16)} Log hours</button>
      </div>
    </div>

    <div class="hours-stats">
      ${statCard({
        label: 'This week',
        logged: weekLogged,
        target,
        note:
          weekLeft > 0
            ? `${formatHours(weekLeft)}h to go by Sunday`
            : 'Weekly target met',
      })}
      ${statCard({
        label: 'This review period',
        logged: periodLogged,
        target: periodTarget,
        note:
          period.end && periodTarget !== null
            ? `Review in ${daysToReview} day${daysToReview === 1 ? '' : 's'}. ${projectionText(periodProjected, periodTarget, 'by then')}`
            : `Since ${formatDate(period.start)}. Add your next review date to see a target.`,
      })}
      ${statCard({
        label: 'Apprenticeship',
        logged: totalLogged,
        target: totalTarget,
        note:
          end && totalTarget !== null
            ? projectionText(
                totalProjected,
                totalTarget,
                `by ${formatDate(end, true)}`,
              )
            : 'Add your apprenticeship start and end dates to see a projection.',
      })}
    </div>
    <p class="hours-pace">Projections use your average over the last 4 weeks: ${formatHours(pace)}h a week.</p>

    ${gardenCard(data, now, target)}

    <div class="hours-scope" role="group" aria-label="Breakdown period">
      ${SCOPES.map((s) => `<button class="chip${s.id === scope ? ' is-active' : ''}" data-action="scope" data-id="${s.id}" aria-pressed="${s.id === scope}">${s.label}</button>`).join('')}
    </div>
    <div class="hours-columns">
      <section class="hours-box">
        <h2 class="hours-box-title">By category</h2>
        ${bars(byCategory(scoped).map((c) => ({ label: c.category, minutes: c.minutes })))}
      </section>
      <section class="hours-box">
        <h2 class="hours-box-title">By KSB</h2>
        ${
          data.ksbs.length
            ? bars(
                byKsb(scoped, data.ksbs).map((k) => ({
                  label: k.ksb.code,
                  title: k.ksb.title,
                  minutes: k.minutes,
                })),
              )
            : '<p class="hours-empty">Pick your apprenticeship standard in setup to see KSBs.</p>'
        }
        <p class="hours-help">A session tagged with several KSBs counts towards each. Untagged: ${formatHours(totalMinutes(scoped.filter((s) => s.ksbs.length === 0)))}h.</p>
      </section>
    </div>

    <div class="hours-columns">
      ${suggestionsCard(data, now)}
      ${recentCard(data)}
    </div>`;
}

function statCard(stat: {
  label: string;
  logged: number;
  target: number | null;
  note: string;
}): string {
  const percent =
    stat.target && stat.target > 0
      ? Math.min(100, Math.round((stat.logged / stat.target) * 100))
      : 0;
  return `
    <section class="hours-box hours-stat">
      <div class="eyebrow">${stat.label}</div>
      <div class="hours-figure">${formatHours(stat.logged)}<span>${stat.target !== null ? ` / ${formatHours(stat.target)}h` : 'h'}</span></div>
      <div class="progress"><div class="progress-bar" style="width: ${percent}%"></div></div>
      <p class="hours-note">${stat.note}</p>
    </section>`;
}

function projectionText(
  projected: number | null,
  target: number,
  when: string,
): string {
  if (projected === null) return '';
  const gap = projected - target;
  const status =
    gap >= 0 ? 'on track' : `${formatHours(-gap)}h short of the target`;
  return `On pace for ${formatHours(projected)}h ${when}, ${status}.`;
}

function bars(rows: { label: string; title?: string; minutes: number }[]) {
  const max = Math.max(...rows.map((r) => r.minutes), 1);
  return `<div class="hours-bars">
    ${rows
      .map(
        (r) => `
      <div class="hours-bar-row"${r.title ? ` title="${escapeHtml(r.title)}"` : ''}>
        <span class="hours-bar-label">${escapeHtml(r.label)}</span>
        <div class="hours-bar-track"><div class="hours-bar-fill" style="width: ${(r.minutes / max) * 100}%"></div></div>
        <span class="hours-bar-value">${formatHours(r.minutes)}h</span>
      </div>`,
      )
      .join('')}
  </div>`;
}

function gardenCard(data: HoursData, now: Date, target: number): string {
  const weeks = weeklyTotals(data.sessions, now, GARDEN_WEEKS);
  const streak = weeklyStreak(data.sessions, now, target);
  return `
    <section class="hours-box hours-garden">
      <div class="hours-garden-head">
        <h2 class="hours-box-title">Your garden</h2>
        <span class="badge">${streak > 0 ? `${streak}-week streak` : 'No streak yet'}</span>
      </div>
      <p class="hours-help">Each plant is a week. Hit your ${formatHours(target)}h target to make it flower.</p>
      <div class="hours-plants">
        ${weeks
          .map((w, i) => {
            const ratio = target > 0 ? w.minutes / target : 0;
            const current = i === weeks.length - 1;
            return `
          <div class="hours-plant${current ? ' is-current' : ''}" title="${formatHours(w.minutes)}h of ${formatHours(target)}h">
            ${plant(ratio)}
            <span class="hours-plant-hours">${formatHours(w.minutes)}h</span>
            <span class="hours-plant-week">${current ? 'This week' : formatDate(w.start)}</span>
          </div>`;
          })
          .join('')}
      </div>
    </section>`;
}

/** A plant that grows with the share of the weekly target logged. */
function plant(ratio: number): string {
  const stage =
    ratio >= 1 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : ratio > 0 ? 1 : 0;
  const stemTop = [44, 36, 28, 20, 14][stage];
  const leaf = (y: number, size: number) => `
    <ellipse class="plant-leaf" cx="${20 - size}" cy="${y}" rx="${size}" ry="${size / 2}" transform="rotate(-30 ${20 - size} ${y})"/>
    <ellipse class="plant-leaf" cx="${20 + size}" cy="${y}" rx="${size}" ry="${size / 2}" transform="rotate(30 ${20 + size} ${y})"/>`;

  return `<svg class="plant" viewBox="0 0 40 48" width="40" height="48" aria-hidden="true">
    <ellipse class="plant-soil" cx="20" cy="45" rx="13" ry="3"/>
    ${stage > 0 ? `<path class="plant-stem" d="M20 44V${stemTop}"/>` : ''}
    ${stage >= 1 ? leaf(stemTop + 2, stage === 1 ? 3 : 5) : ''}
    ${stage >= 3 ? leaf(stemTop + 12, 6) : ''}
    ${stage === 4 ? '<circle class="plant-flower" cx="20" cy="12" r="6"/><circle class="plant-flower-centre" cx="20" cy="12" r="2.5"/>' : ''}
  </svg>`;
}

function suggestionsCard(data: HoursData, now: Date): string {
  const suggestions = otjSuggestions(data, now);
  return `
    <section class="hours-box">
      <h2 class="hours-box-title">From your calendar</h2>
      ${
        suggestions.length
          ? `<ul class="hours-list">
          ${suggestions
            .map((a) => {
              const minutes = activityMinutes(a);
              return `
            <li class="hours-list-item">
              <div>
                <div class="hours-list-title">${escapeHtml(a.title)}</div>
                <div class="hours-list-meta">${formatDate(new Date(a.start))} · ${guessCategory(a.title)}</div>
              </div>
              <button class="btn btn-secondary" data-action="suggest" data-id="${escapeHtml(a.id)}">Log ${formatHours(minutes)}h</button>
            </li>`;
            })
            .join('')}
        </ul>
        <p class="hours-help">Not everything counts as off-the-job (progress reviews usually don't). If in doubt, check with your provider.</p>`
          : '<p class="hours-empty">No unlogged learning events from the last 30 days.</p>'
      }
    </section>`;
}

function recentCard(data: HoursData): string {
  const recent = [...data.sessions]
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
    .slice(0, RECENT_COUNT);
  return `
    <section class="hours-box">
      <h2 class="hours-box-title">Recent sessions</h2>
      ${
        recent.length
          ? `<ul class="hours-list">
          ${recent
            .map(
              (s) => `
            <li class="hours-list-item">
              <div>
                <div class="hours-list-title">${escapeHtml(s.task)}</div>
                <div class="hours-list-meta">${formatDate(new Date(s.endedAt))} · ${escapeHtml(s.category)}${s.ksbs.length ? ` · ${s.ksbs.map(escapeHtml).join(', ')}` : ''}</div>
              </div>
              <span class="hours-list-hours">${formatHours(s.minutes)}h</span>
              <button class="btn btn-icon btn-ghost" data-action="delete" data-id="${escapeHtml(s.id)}" aria-label="Delete session" title="Delete">${icon('x', 14)}</button>
            </li>`,
            )
            .join('')}
        </ul>`
          : '<p class="hours-empty">Nothing logged yet. Use the focus timer or Log hours.</p>'
      }
    </section>`;
}
