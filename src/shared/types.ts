// Canopy data model, shared by main, preload and renderer. See IDEA.md §6.
// Dates are stored as strings: local date-times as `YYYY-MM-DDTHH:mm`,
// instants (e.g. when a timer stopped) as ISO 8601.

export type KsbType = 'K' | 'S' | 'B' | 'General';

export interface Ksb {
  code: string; // e.g. "K5"
  type: KsbType;
  title: string;
  keywords: string[];
}

export interface Standard {
  id: string;
  name: string;
  ksbs: Ksb[];
}

/** Anything on the calendar. */
export type ActivityKind =
  | 'journal'
  | 'meeting'
  | 'deadline'
  | 'learning'
  | 'review';

export interface Activity {
  id: string;
  title: string;
  kind: ActivityKind;
  start: string;
  end: string;
  /** Where it came from: "manual", "ics", "seed", … */
  source: string;
  url?: string;
}

export type PortalStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'reviewed'
  | 'accepted'
  | 'changes-requested';

/** A STAR journal entry, optionally linked to a calendar activity. */
export interface Reflection {
  id: string;
  activityId?: string;
  date: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  ksbs: string[];
  evidence: string[];
  /** KSB tags confirmed by the apprentice (vs only suggested). */
  confirmed: boolean;
  portalStatus: PortalStatus;
  assessorComment?: string;
}

export const OTJ_CATEGORIES = [
  'Uni',
  'Self-study',
  'Shadowing',
  'Mentoring',
  'Course',
  'Assignment',
] as const;

export type OtjCategory = (typeof OTJ_CATEGORIES)[number];

export interface OtjSession {
  id: string;
  task: string;
  category: OtjCategory;
  /** ISO timestamp the session ended. */
  endedAt: string;
  minutes: number;
  ksbs: string[];
  reflectionId?: string;
  portalStatus: PortalStatus;
}

export type ReviewKind = 'progress' | 'tripartite' | 'epa-gateway';
export type FormStatus = 'not-started' | 'draft' | 'submitted';

export interface Target {
  id: string;
  text: string;
  status: 'open' | 'met' | 'carried';
}

export interface Review {
  id: string;
  date: string;
  kind: ReviewKind;
  formTemplateId?: string;
  formStatus: FormStatus;
  feedback?: string;
  targets: Target[];
}

export interface FormTemplate {
  id: string;
  provider: string;
  fields: { key: string; label: string; source?: string }[];
}

export interface Settings {
  id: 'settings';
  apprenticeName: string;
  standardId?: string;
  apprenticeshipStart?: string;
  apprenticeshipEnd?: string;
  /** Weekly OTJ target in hours, taken from the apprentice's training plan. */
  weeklyOtjTargetHours: number;
}
