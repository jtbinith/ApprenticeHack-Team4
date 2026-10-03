// Renderer entry point. Runs in the browser context (no Node APIs) — talk to
// main only via `window.canopy` (see src/shared/ipc.ts).
//
// This is the Foundation skeleton (#47): tabs show placeholders pointing at the
// feature issue that owns each view, so features can be built in parallel.

import './index.css';
import { db, seedIfEmpty } from './renderer/db';

interface TabView {
  eyebrow: string;
  title: string;
  issue: string;
}

const VIEWS: Record<string, TabView> = {
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

const view = document.getElementById('view') as HTMLElement;

function showTab(name: string) {
  const v = VIEWS[name];
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
  });
  view.innerHTML = `
    <div class="eyebrow">${v.eyebrow}</div>
    <h1 class="view-title">${v.title}</h1>
    <div class="placeholder">Coming soon — ${v.issue}</div>`;
}

document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => showTab(tab.dataset.tab ?? 'calendar'));
});

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

async function init() {
  showTab('calendar');
  await seedIfEmpty();

  const settings = await db.settings.get('settings');
  const weekMinutes = (
    await db.otjSessions
      .where('endedAt')
      .aboveOrEqual(startOfWeek().toISOString())
      .toArray()
  ).reduce((sum, s) => sum + s.minutes, 0);
  const target = settings?.weeklyOtjTargetHours ?? 0;
  (document.getElementById('hours-stat') as HTMLElement).textContent =
    `${(weekMinutes / 60).toFixed(1)}h / ${target}h this week (from local data)`;

  if (settings) {
    (document.getElementById('avatar') as HTMLElement).textContent =
      settings.apprenticeName.slice(0, 2).toUpperCase();
  }

  const info = await window.canopy.appInfo();
  const [activities, reflections, reviews] = await Promise.all([
    db.activities.count(),
    db.reflections.count(),
    db.reviews.count(),
  ]);
  (document.getElementById('status') as HTMLElement).textContent =
    `${info.name} v${info.version} · ${info.platform} · local data: ${activities} activities, ${reflections} reflections, ${reviews} reviews`;
}

init().catch((err) => {
  console.error(err);
  (document.getElementById('status') as HTMLElement).textContent =
    `Startup error: ${String(err)}`;
});
