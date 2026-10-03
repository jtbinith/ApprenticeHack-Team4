// Weekly progress widget (right column): hours logged this week vs target.

import { liveQuery } from 'dexie';
import { registerWidget } from '../../shell/widgets';
import { icon } from '../../ui/icons';
import { openLogHoursDialog, openTargetDialog } from './dialogs';
import {
  addDays,
  formatHours,
  loadHoursData,
  sessionsIn,
  startOfWeek,
  totalMinutes,
  weeklyTargetMinutes,
  type HoursData,
} from './stats';

export function registerWeeklyProgress() {
  registerWidget('progress', (card) => {
    let data: HoursData | undefined;
    const render = () => data && renderWidget(card, data);

    liveQuery(loadHoursData).subscribe({
      next: (next) => {
        data = next;
        render();
      },
      error: console.error,
    });
    // Roll over to the new week if the app is left open past Sunday midnight.
    setInterval(render, 60_000);

    card.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-action]',
      )?.dataset.action;
      if (action === 'log') void openLogHoursDialog();
      if (action === 'target') void openTargetDialog();
    });
  });
}

function renderWidget(card: HTMLElement, data: HoursData) {
  const week = startOfWeek(new Date());
  const logged = totalMinutes(
    sessionsIn(data.sessions, week, addDays(week, 7)),
  );
  const target = weeklyTargetMinutes(data);
  const percent = target > 0 ? Math.round((logged / target) * 100) : 0;
  const left = target - logged;

  card.innerHTML = `
    <div class="weekly-head">
      <div class="eyebrow">Weekly progress</div>
      <button class="btn btn-icon btn-ghost weekly-more" data-action="target" aria-label="Set weekly target" title="Set weekly target">${icon('more', 16)}</button>
    </div>
    <div class="weekly-title">Hours logged</div>
    <div class="weekly-figures">
      <div class="hours-figure">${formatHours(logged)}<span> / ${formatHours(target)}h</span></div>
      <span class="badge">${percent}% complete</span>
    </div>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(percent, 100)}" aria-label="Weekly OTJ hours">
      <div class="progress-bar" style="width: ${Math.min(percent, 100)}%"></div>
    </div>
    <div class="weekly-foot">
      <span>${left > 0 ? `${formatHours(left)}h remaining` : 'Target met this week'}</span>
      <button class="btn btn-ghost weekly-log" data-action="log">${icon('plus', 14)} Log hours</button>
    </div>`;
}
