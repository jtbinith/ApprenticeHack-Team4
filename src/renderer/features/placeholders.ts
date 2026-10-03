// "Coming soon" views and widgets for features not built yet.
// When you build a feature, register its real view/widget from its own folder
// (e.g. src/renderer/features/calendar/) and delete its entry here.

import { registerView, type TabName } from '../shell/router';
import { registerWidget, type WidgetSlot } from '../shell/widgets';

const VIEWS: Partial<
  Record<TabName, { eyebrow: string; title: string; issue: string }>
> = {
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

const WIDGETS: Partial<Record<WidgetSlot, { title: string; issue: string }>> = {
  ai: { title: 'Canopy AI', issue: 'Chat widget · #54' },
};

export function registerPlaceholders() {
  for (const [tab, v] of Object.entries(VIEWS) as [
    TabName,
    NonNullable<(typeof VIEWS)[TabName]>,
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
    NonNullable<(typeof WIDGETS)[WidgetSlot]>,
  ][]) {
    registerWidget(slot, (card) => {
      card.classList.add('is-placeholder');
      card.innerHTML = `<div class="widget-title">${w.title}</div><div class="widget-note">${w.issue}</div>`;
    });
  }
}
