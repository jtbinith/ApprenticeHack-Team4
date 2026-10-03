// Tab router. Each feature registers the view for its tab:
//
//   registerView('calendar', {
//     eyebrow: 'Your learning calendar',
//     title: 'May 2025',
//     mount(container) { ...render...; return () => { ...cleanup... }; },
//   });
//
// The active tab is kept in the URL hash (#calendar) so a reload stays put.

export const TABS = [
  'calendar',
  'journal',
  'hours',
  'ksbs',
  'reviews',
] as const;
export type TabName = (typeof TABS)[number];

export interface View {
  /** Small uppercase label above the title. */
  eyebrow: string;
  title: string;
  /** Render into `container`; optionally return a cleanup function. */
  mount(container: HTMLElement): void | (() => void);
  /** Set true to render your own header instead of eyebrow + title. */
  customHeader?: boolean;
}

const views = new Map<TabName, View>();
let outlet: HTMLElement | null = null;
let cleanup: (() => void) | undefined;
let current: TabName | null = null;

export function registerView(tab: TabName, view: View) {
  views.set(tab, view);
  if (current === tab) render(tab);
}

export function navigate(tab: TabName) {
  if (location.hash !== `#${tab}`) location.hash = tab;
  else render(tab);
}

export function startRouter(container: HTMLElement) {
  outlet = container;
  window.addEventListener('hashchange', () => render(tabFromHash()));
  render(tabFromHash());
}

function tabFromHash(): TabName {
  const tab = location.hash.slice(1) as TabName;
  return TABS.includes(tab) ? tab : 'calendar';
}

function render(tab: TabName) {
  if (!outlet) return;
  cleanup?.();
  cleanup = undefined;
  current = tab;

  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => {
    const active = el.dataset.tab === tab;
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-current', active ? 'page' : 'false');
  });

  const view = views.get(tab);
  outlet.replaceChildren();
  if (!view) return;

  let body = outlet;
  if (!view.customHeader) {
    outlet.innerHTML = `
      <div class="view-header">
        <div class="eyebrow"></div>
        <h1 class="view-title"></h1>
      </div>
      <div class="view-body"></div>`;
    (outlet.querySelector('.eyebrow') as HTMLElement).textContent =
      view.eyebrow;
    (outlet.querySelector('.view-title') as HTMLElement).textContent =
      view.title;
    body = outlet.querySelector('.view-body') as HTMLElement;
  }
  cleanup = view.mount(body) ?? undefined;
}
