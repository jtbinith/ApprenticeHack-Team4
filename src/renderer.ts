// Renderer entry point. Runs in the browser context (no Node APIs) — talk to
// main only via `window.canopy` (see src/shared/ipc.ts).
//
// Features plug in with registerView() (tabs) and registerWidget() (right column).
// Import your feature below the placeholders so it replaces its placeholder.

import './styles/index.css';
import { db, seedIfEmpty } from './renderer/db';
import { mountAiChat } from './renderer/features/ai-chat';
import { registerCalendar } from './renderer/features/calendar';
import { registerPlaceholders } from './renderer/features/placeholders';
import { startRouter } from './renderer/shell/router';
import { renderTopbar, setAvatar } from './renderer/shell/topbar';
import { registerWidget } from './renderer/shell/widgets';
import { byId } from './renderer/ui/dom';
import { mountFocusTimer } from './renderer/timer/widget';

async function init() {
  renderTopbar(byId('topbar'));
  registerPlaceholders();
  registerCalendar(); // #49
  registerWidget('timer', (card) => {
    card.classList.add('widget-timer'); // hook for src/renderer/timer/timer.css
    mountFocusTimer(card);
  }); // #52

  await seedIfEmpty();
  startRouter(byId('view'));

  const settings = await db.settings.get('settings');
  if (settings) setAvatar(settings.apprenticeName);
  registerWidget('ai', (card) => mountAiChat(card, settings?.apprenticeName)); // #54

  const info = await window.canopy.appInfo();
  console.info(`${info.name} v${info.version} on ${info.platform}`);
}

init().catch((err) => {
  console.error(err);
  byId('view').textContent = `Canopy failed to start: ${String(err)}`;
});
