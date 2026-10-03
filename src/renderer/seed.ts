// Demo seed data, generated relative to today so the calendar always looks populated.
// The full IfATE KSB lists belong to the Setup wizard (#55); this is a small demo subset.

import type {
  Activity,
  ActivityKind,
  Ksb,
  OtjSession,
  Reflection,
  Review,
  Settings,
  Standard,
  StoredFile,
} from '../shared/types';
import { makeDemoPdf } from './demoPdf';

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

// General enough for any apprentice; the Setup wizard (#55) will load real standards.
const DEMO_STANDARD: Standard = {
  id: 'demo-standard',
  name: 'Demo standard (sample KSBs + general skills)',
  ksbs: [
    k('K1', 'K', 'How the organisation works', [
      'organisation',
      'business',
      'stakeholder',
    ]),
    k('K2', 'K', 'Tools and technologies for the role', [
      'tool',
      'software',
      'technology',
      'data',
      'analytics',
    ]),
    k('S1', 'S', 'Communicate clearly with colleagues and stakeholders', [
      'present',
      'presentation',
      'update',
      'explain',
      'stakeholder',
    ]),
    k('S2', 'S', 'Plan and prioritise work', [
      'plan',
      'planning',
      'prioritise',
      'deadline',
      'kanban',
    ]),
    k('S3', 'S', 'Solve problems and suggest improvements', [
      'problem',
      'issue',
      'fix',
      'improve',
      'hackathon',
    ]),
    k('B1', 'B', 'Reflective practice', [
      'reflect',
      'reflection',
      'journal',
      'feedback',
    ]),
    k('B2', 'B', 'Works collaboratively', [
      'team',
      'mentor',
      'pair',
      'shadow',
      'colleague',
    ]),
    k('B3', 'B', 'Committed to continued professional development', [
      'course',
      'workshop',
      'lecture',
      'linkedin',
      'network',
      'cpd',
      'newsletter',
    ]),
    k('G1', 'General', 'Leadership', [
      'lead',
      'organise',
      'volunteer',
      'volunteering',
    ]),
    k('G2', 'General', 'Resilience', ['challenge', 'setback', 'pressure']),
  ],
};

function k(
  code: string,
  type: Ksb['type'],
  title: string,
  keywords: string[],
): Ksb {
  return { code, type, title, keywords };
}

export interface SeedData {
  settings: Settings;
  standards: Standard[];
  activities: Activity[];
  reflections: Reflection[];
  otjSessions: OtjSession[];
  reviews: Review[];
  files: StoredFile[];
}

const LECTURES = [
  'Project management',
  'Data and analytics',
  'Professional practice',
  'Business processes',
  'Digital tools',
  'Research methods',
  'Communication skills',
  'Agile ways of working',
  'Ethics and GDPR',
];

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

  // Weekly rhythm, four weeks either side of today (weekdays only).
  let lecture = 0;
  for (let day = -28; day <= 28; day++) {
    const weekday = at(day, 0).getDay(); // 0 = Sunday
    const week = Math.floor((day + 28) / 7);
    if (weekday === 1) add(day, 10, 1, 'Team planning meeting', 'meeting');
    if (weekday === 2) {
      add(
        day,
        14,
        2,
        `Uni lecture: ${LECTURES[lecture++ % LECTURES.length]}`,
        'learning',
      );
    }
    if (weekday === 3) add(day, 15, 1, 'Team meeting', 'meeting');
    if (weekday === 4 && week % 2 === 0)
      add(day, 11, 1, '1:1 with mentor', 'meeting');
    if (weekday === 5) add(day, 16, 0.5, 'Weekly journal', 'journal');
  }

  // One-offs.
  add(-26, 9, 3, 'Induction: apprentice welcome session', 'learning');
  add(-20, 13, 2, 'Workshop: time management', 'learning');
  add(-18, 12, 1, 'Assignment 1 due', 'deadline');
  const shadowing = add(
    -15,
    10,
    3,
    'Shadowing: customer support team',
    'learning',
  );
  const hackathon = add(
    -9,
    9,
    7,
    'Hackathon: improving apprentice life',
    'learning',
  );
  const volunteering = add(
    -5,
    13,
    3,
    'Volunteering: STEM careers fair',
    'learning',
  );
  const linkedin = add(
    -2,
    12,
    1,
    'Set up LinkedIn and grew my network',
    'learning',
  );
  add(0, 10, 1, 'Shadowing a senior colleague', 'learning');
  add(3, 13, 1.5, 'Workshop: presentation skills', 'learning');
  add(4, 12, 1, 'Assignment 2 due', 'deadline');
  const review = add(9, 10, 1.5, 'Progress review (tripartite)', 'review');
  add(11, 14, 2, 'Shadowing: data team', 'learning');
  add(15, 12, 1, 'Portfolio evidence submission', 'deadline');
  add(18, 15, 2, 'Volunteering: school coding club', 'learning');
  add(22, 9, 2, 'Uni exam: Project management', 'deadline');
  add(25, 10, 2, 'Online course: module 5', 'learning');

  /** The most recent past occurrence of a recurring event, optionally renamed. */
  const lastPast = (titlePrefix: string, rename?: string) => {
    const now = toLocalDateTime(new Date());
    const match = activities
      .filter((a) => a.title.startsWith(titlePrefix) && a.start < now)
      .sort((x, y) => y.start.localeCompare(x.start))[0];
    if (rename) match.title = rename;
    return match;
  };
  const teamMeeting = lastPast('Team meeting', 'Team meeting: project update');
  const mentor = lastPast('1:1 with mentor');
  const journal = lastPast('Weekly journal');
  const lastLecture = lastPast('Uni lecture');
  const workshop = activities.find(
    (a) => a.title === 'Workshop: time management',
  )!;
  const assignment = activities.find((a) => a.title === 'Assignment 2 due')!;

  const reflection = (
    activity: Activity,
    fields: Pick<
      Reflection,
      | 'situation'
      | 'task'
      | 'action'
      | 'result'
      | 'ksbs'
      | 'evidence'
      | 'confirmed'
      | 'portalStatus'
    > & { assessorComment?: string },
  ): Reflection => ({
    id: crypto.randomUUID(),
    activityId: activity.id,
    date: activity.start,
    ...fields,
  });

  const reflections: Reflection[] = [
    // Complete entries — show what "good" looks like.
    reflection(teamMeeting, {
      situation:
        'Weekly team meeting where everyone shares progress on their projects.',
      task: 'I presented my project update to the team for the first time.',
      action:
        'I prepared three key points and a short demo, and asked a colleague for feedback on my slides beforehand.',
      result:
        'The team understood my blockers and two people offered to help. I learned that a short demo explains progress better than slides; next time I will time my update.',
      ksbs: ['S1', 'B2'],
      evidence: [
        { kind: 'link', url: 'https://example.invalid/slides/team-update' },
      ],
      confirmed: true,
      portalStatus: 'accepted',
    }),
    reflection(hackathon, {
      situation:
        'A day-long apprentice hackathon on improving apprentice life.',
      task: 'I worked in a team of four on an app to track off-the-job hours and KSB evidence.',
      action:
        'I planned our tasks on a Kanban board and built the journal feature.',
      result:
        'We demoed a working prototype. I learned to agree how the parts fit together early so the team can build in parallel.',
      ksbs: ['S2', 'S3', 'B2'],
      evidence: [],
      confirmed: true,
      portalStatus: 'submitted',
    }),
    reflection(volunteering, {
      situation: 'A STEM careers fair at a local secondary school.',
      task: 'I volunteered to run the apprenticeship stand and answer questions from students and parents.',
      action:
        'I prepared a one-page guide on how apprenticeships work, and I led a short Q&A for a group of 20 students.',
      result:
        'Five students asked for follow-up information. I learned to explain my role without jargon; next time I will bring a short demo.',
      ksbs: ['G1', 'S1'],
      evidence: [],
      confirmed: true,
      portalStatus: 'ready',
    }),
    reflection(linkedin, {
      situation:
        'I wanted a professional presence as an apprentice and to connect with people in my industry and uni cohort.',
      task: 'Set up my LinkedIn profile and start building my network as part of my professional development.',
      action:
        'I wrote a profile summary, joined 2 groups, followed 62 company pages, subscribed to 13 newsletters and connected with colleagues after events.',
      result:
        'I now have 555 connections. Newsletters keep me up to date with industry trends; next I will post a short reflection on my first project.',
      ksbs: ['B3'],
      evidence: [{ kind: 'link', url: 'https://www.linkedin.com/mynetwork/' }],
      confirmed: true,
      portalStatus: 'ready',
    }),
    reflection(shadowing, {
      situation: 'I spent a morning shadowing the customer support team.',
      task: 'Understand how support requests reach our team and how they are handled.',
      action:
        'I listened in on calls, took notes on common issues and asked the team lead how they decide what to escalate.',
      result: 'I now understand the main reasons customers contact us.',
      ksbs: ['K1', 'B2'],
      evidence: [],
      confirmed: true,
      portalStatus: 'changes-requested',
      assessorComment:
        'Good start. Add what you learned about how the team prioritises requests, and how it changes your own work.',
    }),
    reflection(journal, {
      situation: 'End-of-week reflection.',
      task: 'Review what went well this week and what I want to improve.',
      action:
        'I looked back at my calendar and notes, and picked one thing to do differently next week.',
      result:
        'I realised I spend too long on emails in the morning, so next week I will block out focus time before 11am.',
      ksbs: ['B1'],
      evidence: [],
      confirmed: true,
      portalStatus: 'draft',
    }),
    // Partial / thin entries — give the hints engine (#51) something to flag.
    reflection(lastLecture, {
      situation: lastLecture.title,
      task: 'Attend the lecture and take notes.',
      action: 'I took notes and asked a question about the assignment.',
      result: '',
      ksbs: ['B3'],
      evidence: [],
      confirmed: false,
      portalStatus: 'draft',
    }),
    reflection(workshop, {
      situation: 'Time management workshop',
      task: 'Learn some techniques',
      action: 'We did some exercises',
      result: 'It was useful',
      ksbs: [],
      evidence: [],
      confirmed: false,
      portalStatus: 'draft',
    }),
    reflection(mentor, {
      situation: '1:1 with mentor',
      task: 'Talked about stuff',
      action: 'We discussed things',
      result: '',
      ksbs: ['B2'],
      evidence: [],
      confirmed: false,
      portalStatus: 'draft',
    }),
    // Deadline with just the brief attached (no reflection written yet).
    reflection(assignment, {
      situation: 'Assignment 2: a project plan for a workplace improvement.',
      task: 'Write and submit a 2,000-word project plan.',
      action: '',
      result: '',
      ksbs: ['S2'],
      evidence: [],
      confirmed: true,
      portalStatus: 'draft',
    }),
  ];

  // Demo documents and links attached to entries, so the calendar shows that
  // notes, docs and links live with each event.
  const files: StoredFile[] = [];
  const attachPdf = (
    activity: Activity,
    name: string,
    title: string,
    lines: string[],
  ) => {
    const blob = makeDemoPdf(title, lines);
    const file: StoredFile = {
      id: crypto.randomUUID(),
      name,
      type: 'application/pdf',
      size: blob.size,
      blob,
      addedAt: new Date().toISOString(),
    };
    files.push(file);
    reflections
      .find((r) => r.activityId === activity.id)
      ?.evidence.push({
        kind: 'file',
        fileId: file.id,
        name,
        type: file.type,
        size: file.size,
      });
  };
  const attachLink = (activity: Activity, url: string) =>
    reflections
      .find((r) => r.activityId === activity.id)
      ?.evidence.push({ kind: 'link', url });

  attachPdf(
    lastLecture,
    'Uni lecture notes.pdf',
    `Uni lecture notes: ${lastLecture.title.replace('Uni lecture: ', '')}`,
    [
      'Key points from today:',
      '- Main ideas covered in the lecture',
      '- Examples from the case study',
      '- Reading for next week',
      'Question I asked: how this links to Assignment 2.',
    ],
  );
  attachLink(lastLecture, 'https://example.invalid/uni/vle/lecture-slides');
  attachPdf(
    teamMeeting,
    'Team meeting minutes.pdf',
    'Team meeting: agenda and minutes',
    [
      'Agenda:',
      '1. Project updates (my update: demo + three key points)',
      '2. Blockers and help needed',
      '3. Actions for next week',
      'Action for me: share slides with the team.',
    ],
  );
  attachPdf(hackathon, 'Hackathon pitch.pdf', 'Hackathon pitch: Canopy', [
    'Problem: apprentices lose track of evidence before reviews.',
    'Idea: one workspace for calendar, journal, OTJ hours and KSBs.',
    'Demo: log a session, reflect, and export a review pack.',
  ]);
  attachLink(hackathon, 'https://github.com/jtbinith/ApprenticeHack-Team4');
  attachPdf(
    volunteering,
    'Careers fair guide.pdf',
    'Apprenticeships: a one-page guide',
    [
      'What an apprenticeship is: paid work + study.',
      'How the week works: job, uni and off-the-job learning.',
      'How to apply, and where to find vacancies.',
    ],
  );
  attachPdf(
    shadowing,
    'Shadowing notes.pdf',
    'Shadowing notes: customer support',
    [
      'Common reasons customers get in touch:',
      '- account access',
      '- billing questions',
      '- how-to questions',
      'Escalation: anything affecting many customers goes to the team lead.',
    ],
  );
  attachPdf(
    workshop,
    'Workshop handout.pdf',
    'Workshop handout: time management',
    [
      'Techniques covered:',
      '- Prioritise with an urgent / important grid',
      '- Block focus time in your calendar',
      '- Review your week every Friday',
    ],
  );
  attachPdf(assignment, 'Assignment 2 brief.pdf', 'Assignment 2 brief', [
    'Write a project plan for an improvement in your workplace.',
    'Length: 2,000 words. Include scope, timeline, risks and stakeholders.',
    'Submit through the university portal.',
  ]);

  // OTJ sessions for the last 8 weeks (up to today):
  // [weeks ago, day (0 = Monday), minutes, task, category, KSBs]. Some weeks
  // hit the 6h target and some don't, so the Hours tab shows a streak and gaps.
  const today = new Date().getDay(); // 0 = Sunday
  const mondayOffset = today === 0 ? -6 : 1 - today;
  const otjSessions: OtjSession[] = (
    [
      [0, 0, 90, 'Uni reading', 'Self-study', ['B3']],
      [0, 1, 60, 'Mentor session', 'Mentoring', ['B2']],
      [0, 2, 45, 'Online course module', 'Course', ['B3']],
      [1, 0, 120, 'Uni lecture: Professional practice', 'Uni', ['B3']],
      [1, 2, 90, 'Assignment 1 research', 'Assignment', ['K1']],
      [1, 3, 150, 'Online course: data tools', 'Course', ['K2']],
      [2, 1, 180, 'Uni lecture: Project management', 'Uni', ['S2']],
      [
        2,
        3,
        120,
        'Shadowing: customer support team',
        'Shadowing',
        ['K1', 'B2'],
      ],
      [2, 4, 60, 'Weekly reflection and reading', 'Self-study', ['B1']],
      [3, 0, 60, 'Self-study: Kanban and planning', 'Self-study', ['S2']],
      [3, 2, 90, 'Mentor session', 'Mentoring', ['B2']],
      [4, 1, 180, 'Uni lecture: Data and analytics', 'Uni', ['K2']],
      [4, 2, 120, 'Spreadsheet skills practice', 'Self-study', ['K2']],
      [4, 4, 90, 'Assignment 1 write-up', 'Assignment', ['B1']],
      [5, 1, 120, 'Shadowing: data team', 'Shadowing', ['B2']],
      [6, 0, 180, 'Uni lecture: Business processes', 'Uni', ['K1']],
      [6, 3, 150, 'Workshop: problem solving', 'Course', ['S3']],
      [7, 2, 120, 'Self-study: presentation skills', 'Self-study', ['S1']],
    ] as const
  )
    .filter(([weeksAgo, day]) => mondayOffset - weeksAgo * 7 + day <= 0)
    .map(([weeksAgo, day, minutes, task, category, ksbs]) => ({
      id: crypto.randomUUID(),
      task,
      category,
      minutes,
      endedAt: at(mondayOffset - weeksAgo * 7 + day, 17).toISOString(),
      ksbs: [...ksbs],
      portalStatus: weeksAgo >= 2 ? 'accepted' : 'draft',
    }));

  const reviews: Review[] = [
    {
      id: crypto.randomUUID(),
      date: toLocalDateTime(at(-80, 10)),
      kind: 'progress',
      formStatus: 'submitted',
      feedback:
        'Good progress on communication; needs more evidence of problem solving.',
      targets: [
        {
          id: crypto.randomUUID(),
          text: 'Evidence S3 (problem solving) with a real example',
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
      apprenticeshipStart: toLocalDateTime(at(-84, 9)),
      apprenticeshipEnd: toLocalDateTime(at(540, 17)),
      weeklyOtjTargetHours: 6,
    },
    standards: [DEMO_STANDARD],
    activities,
    reflections,
    otjSessions,
    reviews,
    files,
  };
}
