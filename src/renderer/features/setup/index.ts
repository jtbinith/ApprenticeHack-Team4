// Setup wizard (#55): name and dates, standard + KSBs, review dates and OTJ target.
// Opened by clicking the avatar in the top bar.
//
//   import { openSetupWizard } from '../setup';
//   openSetupWizard();

import './setup.css';
import { navigate, TABS, type TabName } from '../../shell/router';
import { setAvatar } from '../../shell/topbar';
import { openSetupWizard } from './wizard';

export { openSetupWizard };

export function registerSetup() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  avatar.classList.add('is-clickable');
  avatar.setAttribute('role', 'button');
  avatar.setAttribute('tabindex', '0');
  avatar.setAttribute('aria-label', 'Your profile and setup');

  const open = () =>
    void openSetupWizard((state) => {
      setAvatar(state.name.trim());
      refreshView();
    });
  avatar.addEventListener('click', open);
  avatar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
}

/** Re-render the open tab so it picks up new reviews, KSBs and targets. */
function refreshView() {
  const tab = location.hash.slice(1) as TabName;
  navigate(TABS.includes(tab) ? tab : 'calendar');
}
