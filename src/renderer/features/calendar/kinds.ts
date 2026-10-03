// Calendar entry kinds, in legend order. Colours are the `--kind-<kind>-*`
// tokens in src/styles/tokens.css (`.pill--<kind>`, `.dot--<kind>`).

import type { ActivityKind } from '../../../shared/types';

export const KINDS: { kind: ActivityKind; label: string }[] = [
  { kind: 'journal', label: 'Journal' },
  { kind: 'meeting', label: 'Meeting' },
  { kind: 'deadline', label: 'Deadline' },
  { kind: 'learning', label: 'Learning' },
  { kind: 'review', label: 'Review' },
  { kind: 'otj', label: 'OTJ' },
];
