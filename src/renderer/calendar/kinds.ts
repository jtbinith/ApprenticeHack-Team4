// Calendar entry kinds, in legend order. Colours live in calendar.css
// (`.cal-kind-<kind>`), built from the tokens in src/index.css.

import type { ActivityKind } from '../../shared/types';

export const KINDS: { kind: ActivityKind; label: string }[] = [
  { kind: 'journal', label: 'Journal' },
  { kind: 'meeting', label: 'Meeting' },
  { kind: 'deadline', label: 'Deadline' },
  { kind: 'learning', label: 'Learning' },
  { kind: 'review', label: 'Review' },
  { kind: 'otj', label: 'OTJ' },
];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
