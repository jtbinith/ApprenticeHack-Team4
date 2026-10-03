// Canned replies for the static AI mock (#54). No network, no LLM: the first
// rule with a keyword in the message wins, otherwise FALLBACK. Keywords match
// as word prefixes ("hour" matches "hours"); two-letter ones only as
// whole words, so "hi" doesn't fire on "history".

interface Rule {
  keywords: string[];
  reply: string;
}

const RULES: Rule[] = [
  {
    keywords: ['plan', 'week', 'schedule', 'busy', 'calendar'],
    reply:
      'This week you have a mentor check-in and a weekly journal due. I’d block two 25-minute focus sessions before Friday to write up your evidence.',
  },
  {
    keywords: ['ksb', 'match', 'evidence', 'tag', 'journal', 'reflection'],
    reply:
      'That entry looks like a fit for S2 (implements code) and B1 (works independently). Open it in Journal to confirm the tags — suggestions only count once you accept them.',
  },
  {
    keywords: ['hour', 'otj', 'off-the-job', 'off the job', 'timer', 'log'],
    reply:
      'You’re a little behind your weekly OTJ target. A 45-minute focus session on today’s learning would close most of the gap — stop the timer to log it.',
  },
  {
    keywords: ['review', 'portfolio', 'epa', 'assessment', 'coach'],
    reply:
      'For your next review, pick 3–4 strong journal entries and check the KSBs tab for gaps. Anything marked “needs attention” is worth a reflection first.',
  },
  {
    keywords: ['hello', 'hi', 'hey', 'morning', 'afternoon', 'evening'],
    reply:
      'Hi! I can help you plan your week, match journal entries to KSBs, or get ready for a progress review.',
  },
  {
    keywords: ['thank', 'thanks', 'cheers'],
    reply: 'Any time — good luck with this week!',
  },
];

const FALLBACK =
  'I’m a preview for now, so I only know a few tricks. Try asking about your week, KSBs, OTJ hours or your next review.';

export function cannedReply(message: string): string {
  const words = message.toLowerCase();
  const hit = RULES.find((rule) =>
    rule.keywords.some((k) =>
      new RegExp(`\\b${k}${k.length <= 2 ? '\\b' : ''}`).test(words),
    ),
  );
  return hit?.reply ?? FALLBACK;
}
