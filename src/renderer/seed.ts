// Demo seed data, generated relative to today so the calendar always looks populated.
// The full IfATE KSB lists belong to the Setup wizard (#55); this is a small demo subset.

import type {
  Activity,
  ActivityKind,
  OtjSession,
  Reflection,
  Review,
  Settings,
  Standard,
} from '../shared/types';

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `Date` → `YYYY-MM-DDTHH:mm` in local time. */
export function toLocalDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const DEMO_STANDARD: Standard = {
  id: 'demo-software-engineer-l6',
  name: 'Software Engineer (Level 6) — demo subset',
  ksbs: [
    {
      code: 'K4',
      type: 'K',
      title: 'Data structures and algorithms',
      keywords: ['algorithm', 'data structure'],
    },
    {
      code: 'K5',
      type: 'K',
      title: 'Software design approaches and patterns',
      keywords: ['design', 'pattern', 'architecture'],
    },
    {
      code: 'K8',
      type: 'K',
      title: 'Cloud and deployment',
      keywords: ['aws', 'lambda', 'cloud', 'deploy'],
    },
    {
      code: 'S1',
      type: 'S',
      title: 'Create logical and maintainable code',
      keywords: ['code', 'refactor'],
    },
    {
      code: 'S5',
      type: 'S',
      title: 'Test code and analyse results',
      keywords: ['test', 'unit test'],
    },
    {
      code: 'S11',
      type: 'S',
      title: 'Participate in code reviews',
      keywords: ['cr', 'code review'],
    },
    {
      code: 'B1',
      type: 'B',
      title: 'Reflective practice',
      keywords: ['reflect', 'journal'],
    },
    {
      code: 'B4',
      type: 'B',
      title: 'Works collaboratively',
      keywords: ['mentor', 'pair', 'team'],
    },
  ],
};

export interface SeedData {
  settings: Settings;
  standards: Standard[];
  activities: Activity[];
  reflections: Reflection[];
  otjSessions: OtjSession[];
  reviews: Review[];
}

export function seed(): SeedData {
  const activities: Activity[] = [];
  const add = (
    day: number,
    hour: number,
    hours: number,
    title: string,
    kind: ActivityKind,
  ) => {
    const start = at(day, hour);
    const activity: Activity = {
      id: crypto.randomUUID(),
      title,
      kind,
      start: toLocalDateTime(start),
      end: toLocalDateTime(new Date(start.getTime() + hours * 3_600_000)),
      source: 'seed',
    };
    activities.push(activity);
    return activity;
  };

  add(-12, 10, 1, 'Sprint planning', 'meeting');
  add(-10, 14, 2, 'Uni lecture: Data structures', 'learning');
  add(-8, 16, 0.5, 'Weekly journal', 'journal');
  const mentor = add(-6, 11, 1, '1:1 with mentor', 'meeting');
  add(-5, 9, 3, 'AWS Lambda course', 'learning');
  const cr = add(-3, 15, 1, 'CR review with team', 'meeting');
  add(-1, 16, 0.5, 'Weekly journal', 'journal');
  add(0, 10, 1, 'Pairing: firmware unit tests', 'learning');
  add(2, 14, 2, 'Uni lecture: Software design', 'learning');
  add(4, 12, 1, 'Assignment 2 due', 'deadline');
  add(6, 16, 0.5, 'Weekly journal', 'journal');
  add(11, 14, 1, 'Shadowing: on-call handover', 'learning');
  add(15, 12, 1, 'KSB evidence submission', 'deadline');
  const review = add(9, 10, 1.5, 'Progress review (tripartite)', 'review');

  const reflections: Reflection[] = [
    {
      // Complete entry — shows what "good" looks like.
      id: crypto.randomUUID(),
      activityId: cr.id,
      date: cr.start,
      situation: 'Team code review of the motion-detection refactor.',
      task: 'I was the author and had to respond to 12 review comments.',
      action:
        'I split the change into two smaller CRs and added unit tests for the edge cases reviewers raised.',
      result:
        'Both CRs were approved in a day. I learned to keep CRs under 300 lines so reviews are faster.',
      ksbs: ['S11', 'S5'],
      evidence: [{ kind: 'link', url: 'https://example.invalid/cr/123' }],
      confirmed: true,
      portalStatus: 'accepted',
    },
    {
      // Deliberately thin entry — gives the hints engine (#51) something to flag.
      id: crypto.randomUUID(),
      activityId: mentor.id,
      date: mentor.start,
      situation: '1:1 with mentor',
      task: 'Talked about stuff',
      action: 'We discussed things',
      result: '',
      ksbs: ['B4'],
      evidence: [],
      confirmed: false,
      portalStatus: 'draft',
    },
  ];

  const today = new Date().getDay(); // 0 = Sunday
  const mondayOffset = today === 0 ? -6 : 1 - today;
  const otjSessions: OtjSession[] = (
    [
      [0, 90, 'Data structures reading', 'Self-study'],
      [1, 60, 'Mentor session', 'Mentoring'],
      [2, 45, 'Lambda course module 3', 'Course'],
    ] as const
  )
    .filter(([day]) => mondayOffset + day <= 0)
    .map(([day, minutes, task, category]) => ({
      id: crypto.randomUUID(),
      task,
      category,
      minutes,
      endedAt: at(mondayOffset + day, 17).toISOString(),
      ksbs: [],
      portalStatus: 'draft',
    }));

  const reviews: Review[] = [
    {
      id: crypto.randomUUID(),
      date: toLocalDateTime(at(-80, 10)),
      kind: 'progress',
      formStatus: 'submitted',
      feedback:
        'Good progress on code quality; needs more evidence of design work.',
      targets: [
        {
          id: crypto.randomUUID(),
          text: 'Evidence K5 with a design doc',
          status: 'open',
        },
        {
          id: crypto.randomUUID(),
          text: 'Log OTJ hours weekly',
          status: 'met',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      date: review.start,
      kind: 'tripartite',
      formStatus: 'not-started',
      targets: [],
    },
  ];

  return {
    settings: {
      id: 'settings',
      apprenticeName: 'Alex',
      standardId: DEMO_STANDARD.id,
      weeklyOtjTargetHours: 6,
    },
    standards: [DEMO_STANDARD],
    activities,
    reflections,
    otjSessions,
    reviews,
  };
}
