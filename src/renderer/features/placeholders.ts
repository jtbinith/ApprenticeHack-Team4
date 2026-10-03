// "Coming soon" views and widgets for features not built yet.
// When you build a feature, register its real view/widget from its own folder
// (e.g. src/renderer/features/calendar/) and delete its entry here.

import { registerView, type TabName } from '../shell/router';
import { registerWidget, type WidgetSlot } from '../shell/widgets';

const VIEWS: Record<
  TabName,
  { eyebrow: string; title: string; issue: string }
> = {
  calendar: {
    eyebrow: 'Your learning calendar',
    title: 'Calendar',
    issue: '#49 Calendar: month and week views',
  },
  journal: {
    eyebrow: 'Reflections',
    title: 'Journal',
    issue: '#50 Journal: STAR entries, KSB tagging, evidence',
  },
  hours: {
    eyebrow: 'Off-the-job',
    title: 'Hours',
    issue: '#53 Hours tab & weekly progress widget',
  },
  ksbs: {
    eyebrow: 'Your framework',
    title: 'KSBs',
    issue: '#56 KSBs tab: coverage, gaps, needs attention',
  },
  reviews: {
    eyebrow: 'Progress reviews',
    title: 'Reviews',
    issue: '#57 Reviews tab & pre-review form',
  },
};

const WIDGETS: Record<WidgetSlot, { title: string; issue: string }> = {
  ai: { title: 'Canopy AI', issue: 'Chat widget · #54' },
  timer: { title: 'Focus timer', issue: 'Timer & OTJ logging · #52' },
  progress: { title: 'Weekly progress', issue: 'Hours logged · #53' },
};

export function registerPlaceholders() {
  for (const [tab, v] of Object.entries(VIEWS) as [
    TabName,
    (typeof VIEWS)[TabName],
  ][]) {
    registerView(tab, {
      eyebrow: v.eyebrow,
      title: v.title,
      mount(container) {
        container.innerHTML = `<div class="placeholder">Coming soon — ${v.issue}</div>`;
      },
    });
  }

  for (const [slot, w] of Object.entries(WIDGETS) as [
    WidgetSlot,
    (typeof WIDGETS)[WidgetSlot],
  ][]) {
    registerWidget(slot, (card) => {
      card.classList.add('is-placeholder');
      card.innerHTML = `<div class="widget-title">${w.title}</div><div class="widget-note">${w.issue}</div>`;
    });
  }
}
