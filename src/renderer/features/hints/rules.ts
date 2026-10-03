// Context-missing hints (#51): rule-based, offline checks on a STAR reflection.
// Hints only ask questions — they never write content for the apprentice.
//
// Other features can use `completeness()` (e.g. KSBs tab #56, review pack #58).

import type { Ksb, Reflection } from '../../../shared/types';

export type HintField =
  | 'situation'
  | 'task'
  | 'action'
  | 'result'
  | 'ksbs'
  | 'evidence';

export interface Hint {
  /** Stable id, used to remember "not relevant" dismissals. */
  id: string;
  field: HintField;
  message: string;
  /** Higher = more important to assessors; the top few are shown. */
  weight: number;
}

const STAR = ['situation', 'task', 'action', 'result'] as const;

const EMPTY_PROMPTS: Record<(typeof STAR)[number], [string, number]> = {
  situation: ['What was happening? Set the scene in a sentence or two.', 2],
  task: ['What were you responsible for?', 3],
  action: ['What did you do? Describe your own steps.', 4],
  result: ['What happened as a result, and what did you learn?', 5],
};

const VAGUE_WORDS = [
  'stuff',
  'things',
  'something',
  'various',
  'etc',
  'some bits',
  'did it',
  'helped out',
  'it was good',
  'it was useful',
];

const LEARNING =
  /\b(learn(t|ed|ing)?|realis(e|ed)|realiz(e|ed)|next time|improve|would|will|understand|understood|discover(ed)?|found out)\b/i;
const MEASURABLE =
  /\d|%|\b(faster|quicker|reduced|increased|saved|approved|completed|delivered|fixed|feedback)\b/i;
const FIRST_PERSON = /\b(i|i'm|i've|i'd|my|me)\b/i;

const MIN_WORDS = 8;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** All hints for a reflection, most important first (dismissed ones included). */
export function getHints(reflection: Reflection, ksbs: Ksb[]): Hint[] {
  const hints: Hint[] = [];

  for (const field of STAR) {
    const text = reflection[field].trim();
    if (!text) {
      const [message, weight] = EMPTY_PROMPTS[field];
      hints.push({ id: `empty:${field}`, field, message, weight });
      continue;
    }
    const vague = VAGUE_WORDS.find((w) =>
      new RegExp(`\\b${w}\\b`, 'i').test(text),
    );
    if (vague) {
      hints.push({
        id: `vague:${field}`,
        field,
        message: `“${vague}” is vague — what exactly happened, or what did you do?`,
        weight: 3,
      });
    } else if (words(text) < MIN_WORDS) {
      hints.push({
        id: `short:${field}`,
        field,
        message: 'Can you add a bit more detail?',
        weight: 2,
      });
    }
  }

  const action = reflection.action.trim();
  if (action && !FIRST_PERSON.test(action)) {
    hints.push({
      id: 'no-i:action',
      field: 'action',
      message: 'What was your part? Try starting with “I…”.',
      weight: 4,
    });
  }

  const result = reflection.result.trim();
  if (result && !LEARNING.test(result)) {
    hints.push({
      id: 'no-learning:result',
      field: 'result',
      message:
        'What did you learn, or what would you do differently next time?',
      weight: 4,
    });
  }
  if (result && !MEASURABLE.test(result)) {
    hints.push({
      id: 'no-measure:result',
      field: 'result',
      message:
        'Any measurable outcome? For example time saved, people reached or feedback received.',
      weight: 1,
    });
  }

  if (!reflection.ksbs.length) {
    hints.push({
      id: 'no-ksb',
      field: 'ksbs',
      message: 'Tag at least one KSB that this entry evidences.',
      weight: 3,
    });
  } else {
    const text = STAR.map((f) => reflection[f])
      .join(' ')
      .toLowerCase();
    for (const code of reflection.ksbs) {
      const ksb = ksbs.find((k) => k.code === code);
      if (!ksb) continue;
      const linked =
        text.includes(code.toLowerCase()) ||
        ksb.keywords.some((kw) => text.includes(kw.toLowerCase()));
      if (!linked) {
        hints.push({
          id: `unjustified:${code}`,
          field: 'ksbs',
          message: `How does this show ${code} (${ksb.title})? Add a line linking your actions to it.`,
          weight: 3,
        });
      }
    }
  }

  if (!reflection.evidence.length) {
    hints.push({
      id: 'no-evidence',
      field: 'evidence',
      message: 'Add a link, file or screenshot so this counts as evidence.',
      weight: 2,
    });
  }

  return hints.sort((a, b) => b.weight - a.weight);
}

/** The hints to show: not dismissed, most important first, at most `max`. */
export function visibleHints(
  reflection: Reflection,
  ksbs: Ksb[],
  max = 3,
): Hint[] {
  const dismissed = new Set(reflection.dismissedHints ?? []);
  return getHints(reflection, ksbs)
    .filter((h) => !dismissed.has(h.id))
    .slice(0, max);
}

export interface Completeness {
  /** 0–1. */
  score: number;
  passed: number;
  total: number;
}

/**
 * How complete an entry is, out of 8 checks: each STAR field has real detail (4),
 * the action is first-person, the result includes learning, KSBs are tagged and
 * linked, and there is evidence. Dismissed hints count as passed.
 */
export function completeness(
  reflection: Reflection,
  ksbs: Ksb[],
): Completeness {
  const dismissed = new Set(reflection.dismissedHints ?? []);
  const open = getHints(reflection, ksbs).filter((h) => !dismissed.has(h.id));
  const has = (test: (h: Hint) => boolean) => open.some(test);
  const detailIssue = /^(empty|vague|short):/;

  const checks = [
    ...STAR.map((f) => !has((h) => h.field === f && detailIssue.test(h.id))),
    !has((h) => h.id === 'no-i:action'),
    !has((h) => h.id === 'no-learning:result'),
    !has((h) => h.field === 'ksbs'),
    !has((h) => h.id === 'no-evidence'),
  ];
  const passed = checks.filter(Boolean).length;
  return { score: passed / checks.length, passed, total: checks.length };
}
