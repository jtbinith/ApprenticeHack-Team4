// Right-hand widget column (top → bottom: AI chat, focus timer, weekly progress).
// Each feature fills its slot:
//
//   registerWidget('timer', (card) => { card.innerHTML = '...'; });
//
// The slot element is the card itself; its variant styling (green AI card,
// lime timer card) is already applied by the shell.

export const WIDGET_SLOTS = ['ai', 'timer', 'progress'] as const;
export type WidgetSlot = (typeof WIDGET_SLOTS)[number];

export type WidgetMount = (card: HTMLElement) => void;

export function registerWidget(slot: WidgetSlot, mount: WidgetMount) {
  const card = document.querySelector<HTMLElement>(`[data-widget="${slot}"]`);
  if (!card) throw new Error(`Unknown widget slot: ${slot}`);
  card.replaceChildren();
  card.classList.remove('is-placeholder');
  mount(card);
}
