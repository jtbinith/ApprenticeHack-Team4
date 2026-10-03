# Reflect — Apprentice Progress Companion

> **Reflect** helps UK apprentices log off-the-job (OTJ) hours with a focus timer, capture STAR reflections as they learn, track what their university has accepted, and pre-fill pre-review forms — turning review prep from an all-nighter into a 10-minute check.

---

## 1. The problem

Apprentices must evidence progress against their standard's **KSBs** (Knowledge, Skills, Behaviours) at regular progress reviews and at End-Point Assessment (EPA). In practice:

- Reflections are written the night before a review — details are forgotten, entries are vague, links to the framework are weak.
- Evidence lives in many places (calendar, notes, tickets, code reviews, uni portal) with no single view of progress.
- Apprentices don't know what their assessor has actually **accepted** vs. what they've just submitted.
- Pre-review forms ask for the same information every time and have to be filled in from scratch.
- OTJ hours are logged retrospectively and inaccurately, often falling behind target unnoticed.

## 2. Who it's for

**Primary user:** UK apprentices on any standard and level (e.g. Software Engineer L6, Digital & Technology Solutions L6) who track KSBs, log OTJ hours, and have regular progress/tripartite reviews.

**Secondary beneficiaries:** skills coaches, university assessors and line managers — they receive clearer, better-structured evidence (shared by the apprentice via export).

## 3. Core user stories

### Story 1 — Capture while it's fresh
> *As an apprentice, I want to quickly reflect on work and track my OTJ learning time as it happens, with prompts for what's missing, so that my evidence is detailed, linked to my KSBs, and my hours are accurate.*

- Click a calendar event (or stop the OTJ timer) → fill a short STAR entry
- KSB tags are suggested; I confirm them
- Hints prompt me on what's missing (*"What was your part?"*, *"Add the link"*)

### Story 2 — Track what counts
> *As an apprentice, I want to see which KSBs I've evidenced, which my assessor has accepted in the university portal, and my OTJ hours vs target, so that I know my real progress and what needs fixing.*

- Coverage vs accepted, per KSB, per review period
- "Changes requested" items surfaced with assessor comments
- OTJ hours vs target with projection
- Countdown nudges before each review

### Story 3 — Walk into reviews prepared
> *As an apprentice, I want my pre-review form and reflection summary drafted from my entries, so that I can complete the form in minutes and arrive with clear evidence.*

- Deadline nudge → pre-filled form (progress, targets, OTJ, evidence status)
- One-click review pack (per-KSB STAR summaries + evidence links + gaps)
- Log feedback and targets after the review → tracked next period

## 4. Features

### 4.1 Setup wizard
- Pick an apprenticeship standard (bundled IfATE KSB lists) or start blank
- Customise KSBs and add general skills (e.g. Communication, Resilience)
- Add review dates (progress reviews, tripartite reviews, EPA gateway) and apprenticeship start/end dates
- Set OTJ target (from the apprentice's own training plan / commitment statement — not hard-coded)
- Choose provider pre-review form template (or build a custom one)
- Optionally connect apps

### 4.2 Calendar (Notion Calendar-style)
- Week view with time grid; drag to create events
- Click an event → side panel with STAR reflection, notes, KSB tags, evidence links
- Review meetings highlighted on the timeline; time is grouped into **review periods** (review → next review)

### 4.3 STAR reflections
| Field | Prompt |
|---|---|
| **S**ituation | What was happening? (pre-filled from event) |
| **T**ask | What were you responsible for? |
| **A**ction | What did *you* do? |
| **R**esult | What happened, and what did you learn? |
| KSBs | Suggested via keyword match; apprentice confirms |
| Evidence | Links / files |

Notion-style block editor (Editor.js) for free-form notes alongside.

### 4.4 Context-missing hints
Rule-based completeness checks (offline, no AI) show small notes under each field:

| Check | Hint |
|---|---|
| Empty / very short field | Field-specific prompt |
| Vague words ("stuff", "helped", "did it") | "What exactly did you do?" |
| No "I" in Action | "What was *your* part?" |
| No learning in Result | "What did you learn or would you change?" |
| KSB tagged but not justified | "How does this show K5?" |
| No evidence attached | "Add a link or screenshot" |
| No measurable result | "Any measurable outcome?" |

- Max 2–3 hints per entry, dismissible ("Not relevant" / "Remind me later")
- Hints only ask questions — never auto-write content (keeps work authentic for EPA)
- Completeness score per entry feeds an evidence-strength score per KSB

### 4.5 OTJ tracking (Flora-style focus timer)
- Start / pause / stop timer with activity + OTJ category (Uni, Self-study, Shadowing, Mentoring, Course, Assignment)
- Plant grows during a session; weekly "garden" view; streaks for hitting weekly target
- Stop → quick reflection prompt (hours and evidence captured together)
- Calendar suggestions: tagged events (e.g. "Uni lecture") → *"Log 2h as OTJ?"*
- Manual entry for past sessions
- Dashboard: hours vs target (week / period / total), category & KSB breakdown, projection
- Configurable guidance on what typically counts (e.g. progress reviews usually don't) with *"check with your provider"* flags

### 4.6 University portal integration
Many portals (SmartAssessor, OneFile, Aptem, Bud, university VLEs) lack public APIs, so integration is staged:

| Stage | Approach |
|---|---|
| MVP | Manual status per entry + "Copy for portal" formatted text |
| P1 | Import portal CSV/export → auto-match entries and update status |
| P2 | Browser extension acting in the user's own logged-in session (read statuses, fill fields) |
| Future | Official API / provider partnership |

**Evidence status lifecycle:**
```
Draft → Ready → Submitted → Reviewed → ✅ Accepted
                                   └→ ↩ Changes requested (assessor comment)
```
No server-side scraping and no stored portal passwords.

### 4.7 Pre-review form helper
- Form templates: list of questions/fields per provider
- Nudge ~7 days before review: *"Your progress review form is due — start draft?"*
- Auto-fill from app data:
  - Progress since last review → period's reflections & KSBs covered
  - Targets → status of last review's targets
  - OTJ hours → logged totals & breakdown
  - Evidence → accepted / submitted / pending
- Apprentice edits each field → copy per field (MVP) or extension autofill (P2)
- Form status (Not started / Draft / Submitted) shown on the review countdown

### 4.8 Dashboard
- KSB coverage radar / heatmap (evidenced vs accepted)
- Gaps in current period + suggested actions
- Review countdown banner
- OTJ progress & projection
- "Needs attention": changes requested, incomplete entries, unreflected events

### 4.9 Review pack
```
Review Pack — Period 3 (12 Jun → 12 Oct 2026)
├─ Summary: reflections, KSBs evidenced/accepted, OTJ hours
├─ Per KSB: condensed STAR entries + evidence links
├─ Gaps & proposed next-period goals
└─ Last review targets → status
```
- **Template mode** (default, offline) stitches STAR fields into structured prose
- **AI polish** (opt-in): PII stripped first, side-by-side diff, accept per section
- Export PDF / Markdown
- Post-review: log feedback + targets → tracked next period

### 4.10 Connectors
Pluggable interface — each integration is one module:
```ts
interface Connector {
  id: string;               // "ics", "google-calendar", "outlook", "github", "jira", "portal-csv"
  name: string;
  scopes: string[];         // shown on consent screen
  connect(): Promise<void>;
  fetch(since: Date): Promise<Activity[]>;
}
```
MVP: `.ics` import, manual entry, mock data. Stretch: Google Calendar, Microsoft Graph (Outlook/Teams), GitHub, Jira, Notion, browser capture extension.

## 5. Privacy & GDPR (by design)
- **Local-first:** data stored on-device (IndexedDB); nothing leaves without opt-in
- **Data minimisation:** event titles/times only — no meeting bodies or attendee lists
- **Per-source consent** with clear "what we read" descriptions
- **Right to erasure & portability:** "Delete all" and "Export all"
- **Human in the loop:** KSB tags and AI output are suggestions until confirmed
- **AI opt-in only**, with names/emails stripped before sending
- **Apprentice owns sharing:** coaches/managers receive exports, not live access

## 6. Data model (draft)
```ts
Standard   { id, name, ksbs: KSB[] }
KSB        { code, type: 'K'|'S'|'B'|'General', title, keywords[] }
Review     { id, date, kind, formTemplateId?, formStatus, feedback?, targets: Target[] }
Target     { id, text, status: 'open'|'met'|'carried' }
Activity   { id, source, title, start, end?, url? }
Reflection { id, activityId?, date, situation, task, action, result,
             ksbs[], evidence[], confirmed, completeness, portalStatus, assessorComment? }
OtjSession { id, start, end, minutes, category, ksbs[], reflectionId?, portalStatus }
FormTemplate { id, provider, fields: { key, label, source? }[] }
Period     = derived: [review[i].date, review[i+1].date)
```

## 7. Tech stack
Desktop app for **Linux and macOS**, built with **Electron + TypeScript** (vanilla TS, no React).

| Layer | Choice |
|---|---|
| App shell | Electron (via Electron Forge `vite-typescript` template) |
| Language | TypeScript (shared types across main / preload / renderer) |
| Build / dev server | Vite (hot reload) |
| UI | Plain HTML + CSS (Notion-like minimal look) |
| Calendar | Schedule-X (vanilla JS API) |
| Notes editor | Editor.js |
| Storage | Dexie.js (IndexedDB) |
| Charts | Chart.js |
| Export | Markdown + PDF via Electron `printToPDF` |
| Packaging | Electron Forge makers: `.deb` / AppImage (Linux), `.dmg` (macOS via GitHub Actions) |
| Extension (stretch) | Chrome Manifest V3 |

Main process handles OS features (tray timer, notifications, global shortcut, file export); the renderer stays browser-compatible (no Node APIs) and talks to main via typed IPC through `contextBridge`.

## 8. Scope & priorities

| Priority | Items |
|---|---|
| **P0 — must demo** | Setup wizard · week calendar · STAR side panel · KSB tagging · rule-based hints · OTJ timer (start/stop → reflect) · review timeline · template review pack · PDF export · seeded mock data |
| **P1 — strong demo** | Dashboard (coverage, gaps, OTJ projection) · review countdown nudges · pre-review form auto-fill · manual portal status + "copy for portal" · `.ics` import · plant/garden gamification · post-review targets |
| **P2 — stretch** | AI polish & AI follow-up questions · portal CSV import · Google/Outlook OAuth · browser extension (capture + portal autofill) · idle detection |

## 9. Demo script (≈3 min)
1. **Setup** — pick standard, add review dates & OTJ target (20s)
2. **Capture** — run the OTJ timer, stop → STAR entry; show hints prompting for missing context (45s)
3. **Track** — dashboard: KSB coverage vs accepted, "changes requested" item, OTJ projection, review countdown (40s)
4. **Prepare** — pre-review form auto-filled; generate review pack → export PDF (50s)
5. **Privacy** — local-first, consent per source, apprentice owns sharing (25s)

## 10. Success metrics
- Review prep time: hours → minutes
- KSBs evidenced (and accepted) per review period ↑
- Entry completeness score ↑
- OTJ hours logged on time and on target

## 11. Open questions
- Hackathon length, team size and skills split?
- Which AI service (if any) is permitted? (e.g. Bedrock, local model, none)
- Judging criteria — impact vs technical depth vs polish?
- Which portal(s) does the team's cohort use? (target one, e.g. SmartAssessor, for a convincing demo)
- Suggest reflections from event titles alone, or only after the apprentice adds notes?

## 12. Suggested team split
1. Calendar view + event side panel
2. STAR editor, hints engine, KSB tagging
3. Setup wizard, reviews, pre-review form, review pack/export
4. OTJ timer + dashboard + connectors (ICS / mock first)
