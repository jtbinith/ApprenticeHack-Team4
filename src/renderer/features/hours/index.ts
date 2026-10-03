// Hours tab & weekly progress widget (#53).

import './hours.css';
import { registerHoursView } from './view';
import { registerWeeklyProgress } from './widget';

export function registerHours() {
  registerHoursView();
  registerWeeklyProgress();
}
