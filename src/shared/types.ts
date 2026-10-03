// Canopy data model, shared by main, preload and renderer. See IDEA.md §6.
// Dates are stored as strings: local date-times as `YYYY-MM-DDTHH:mm`,
// instants (e.g. when a timer stopped) as ISO 8601.

export type KsbType = 'K' | 'S' | 'B' | 'General';

export interface Ksb {
  code: string; // e.g. "K5"
  type: KsbType;
  title: string;
  keywords: string[];
  /** Full wording from the official standard, when bundled from IfATE. */
  detail?: string;
}

export interface Standard {
  id: string;
  name: string;
  ksbs: Ksb[];
  /** IfATE reference and version, e.g. "ST0116 v1.2". */
  reference?: string;
  /** Where the KSB wording came from. */
  sourceUrl?: string;
}

/** Anything on the calendar. */
export type ActivityKind =
  | 'journal'
  | 'meeting'
  | 'deadline'
  | 'learning'
  | 'review'
  | 'otj';

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
  evidence: Evidence[];
  /** Free-form block notes (Editor.js output). */
  notes?: NotesData;
  /** KSB tags confirmed by the apprentice (vs only suggested). */
  confirmed: boolean;
  /** Hints the apprentice marked "not relevant" (#51). */
  dismissedHints?: string[];
  portalStatus: PortalStatus;
  assessorComment?: string;
}

/** A link, or a file stored locally in the `files` table. */
export type Evidence =
  | { kind: 'link'; url: string }
  | { kind: 'file'; fileId: string; name: string; type: string; size: number };

/** An evidence file (PDF, image, document…) stored on the device. */
export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  addedAt: string;
}

/** Editor.js document, kept generic so shared code doesn't depend on Editor.js. */
export interface NotesData {
  time?: number;
  version?: string;
  blocks: { id?: string; type: string; data: unknown }[];
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
  /** Calendar activity this was logged from (OTJ suggestions, #53). */
  activityId?: string;
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
  /** Pre-review form answers, keyed by FormTemplate field key. */
  formAnswers?: Record<string, string>;
  feedback?: string;
  targets: Target[];
  /** The calendar activity that shows this review. */
  activityId?: string;
}

/** Where a pre-review form field's auto-fill comes from (#57). */
export type FormFieldSource =
  | 'progress'
  | 'ksbs'
  | 'otj'
  | 'targets'
  | 'evidence';

export interface FormTemplate {
  id: string;
  provider: string;
  fields: { key: string; label: string; source?: FormFieldSource }[];
}

export interface Settings {
  id: 'settings';
  apprenticeName: string;
  standardId?: string;
  apprenticeshipStart?: string;
  apprenticeshipEnd?: string;
  /** Weekly OTJ target in hours, taken from the apprentice's training plan. */
  weeklyOtjTargetHours: number;
  /** When the setup wizard was last finished (ISO). */
  setupCompletedAt?: string;
}
