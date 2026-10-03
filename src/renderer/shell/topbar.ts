// Top bar: brand, tabs, search / notifications / avatar.

import { icon } from '../ui/icons';
import { TABS, type TabName } from './router';

const TAB_LABELS: Record<TabName, string> = {
  calendar: 'Calendar',
  journal: 'Journal',
  hours: 'Hours',
  ksbs: 'KSBs',
  reviews: 'Reviews',
};

export function renderTopbar(header: HTMLElement) {
  header.innerHTML = `
    <div class="brand">
      <div class="brand-mark">${icon('book', 20)}</div>
      <div>
        <div class="brand-name">Canopy</div>
        <div class="brand-sub">Apprentice workspace</div>
      </div>
    </div>
    <nav class="tabs" aria-label="Main">
      ${TABS.map((t) => `<a class="tab" href="#${t}" data-tab="${t}">${TAB_LABELS[t]}</a>`).join('')}
    </nav>
    <div class="topbar-actions">
      <button class="btn btn-icon btn-ghost" id="search-button" aria-label="Search" title="Search (coming soon)">${icon('search')}</button>
      <button class="btn btn-icon btn-ghost has-dot" id="notifications-button" aria-label="Notifications" title="Notifications (coming soon)">${icon('bell')}</button>
      <div class="avatar" id="avatar" aria-label="Profile"></div>
    </div>`;
}

export function setAvatar(name: string) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.textContent = initials || '?';
    avatar.title = name;
  }
}
