# Chunks-LMS

Chunks-LMS measures a learner’s Focus and Awareness over a course through teacher-observed assessments, scheduling, attendance, and progress reports. It deliberately remains independent of question content and learning-resource ownership.

## People and ownership

**Organization**:
The administrative scope that owns users, metric templates, and reports.
_Avoid_: Tenant, school account

**User**:
A stable domain person. Staff may link to one native Supabase Auth identity through `auth_user_id`; a Learner remains profile-only and is managed through staff workspaces.
_Avoid_: Auth account, transient session

**Staff Auth Identity**:
A native Supabase `auth.users` account linked to one domain User. It authenticates but does not authorize; active database `staff_roles` grant Admin/Teacher access.
_Avoid_: Clerk subject, metadata role, frontend allowlist

**Staff Username**:
An optional, unique, normalized login identifier for an Admin or Teacher. A server-side resolver converts it to the linked Staff Auth Identity without exposing the account email; it never grants a role.
_Avoid_: Authorization claim, learner username, public email alias

**Account Status**:
Active or inactive for a Teacher or Learner profile. Admin may deactivate without deleting history.
_Avoid_: Banned, deleted

**Teacher**:
A User who owns classes/programs for their learners, starts sessions (selecting 1..N learners), observes, and analyses progress.
_Avoid_: Instructor, assessor

**Learner**:
A User whose Focus and Awareness progress is observed across a Course (program label). Learners do not have a public self-serve portal or share-link access in the current V1 runtime.
_Avoid_: Student, participant

## Learning structure

**Course** (program label):
A longitudinal learning program over which Learner progress is measured — **owned by Teacher** in product UX (Admin does not manage courses).
May include an **auto-schedule**: start day, weekdays (e.g. Tue/Wed), meeting time, and session count (default 15 class days). The course **end date is auto-detected** as the date of the last meeting.
_Avoid_: Curriculum only (prefer “program” in Teacher UI)

**Class**:
A Teacher-led cohort of Learners taking one Course — created and seated by Teacher.
_Avoid_: Room, group, cohort

**Enrollment**:
A Learner’s time-bounded membership in a Class.
_Avoid_: Membership, registration

**Scheduled Session**:
A planned calendar occurrence for a Class.
_Avoid_: Lesson, booking

**Learning Session**:
The actual teaching and assessment occurrence associated with a Class.
May carry **session kind** (regular, pretest, posttest) for RFC baseline comparison, **session format** (lesson or test) for input behavior, an optional **prompt language** for live-test item display/audio, and an optional **participant learner list** (subset of the class for multi-select capture).
_Avoid_: Round, room session

**Test Resource**:
A predefined live-test package containing ordered Test Blocks and Test Items, prompt text in Vietnamese/English, audio references, and CVR/CCI metadata.
_Avoid_: Resource library, lesson content

**Test Block**:
One ordered 10-item block within a Test Resource, used as the input for one live-test Learning Session.
_Avoid_: Learning Session, class session

**Test Item**:
One ordered bilingual complete-sentence prompt within a Test Section.
_Avoid_: Session Question, sentence identity

**Standalone Test Assignment**:
One active Learner assigned directly to one published Test Package Version. It has no Class or Enrollment dependency.
_Avoid_: Class test, hidden enrollment

**Standalone Test Run**:
One Learner's attempt at one Test Section with frozen CVR, CCI Name/Ampe, prompt language, voice, approved narration, ordered Test Items, and immutable result history. It is not a Learning Session.
_Avoid_: Live Test Session, class session

**Attendance**:
A Learner’s participation status for a Learning Session.
_Avoid_: Presence

## Assessment

**Session Question**:
An ordered measurement opportunity within a Learning Session, independent of question content.
Each Session Question maps to **exactly one** Learner (round-robin assignment across the class roster). With N questions and M learners, each learner is observed on ~N/M questions.
_Avoid_: Card, sentence, resource

**Assessment Attempt**:
One Teacher’s observation of one Learner for one Session Question. There is never more than one attempt per Session Question.
_Avoid_: Response, answer

**Provisional Result**:
The initial color assessment before any required follow-up is resolved.
_Avoid_: Temporary score, draft grade

**Spectrum Color**:
The official 7-color measurement vocabulary: Red, Orange, Yellow, Green, Blue, Indigo, Purple. Primary capture uses Red/Orange/Green/Purple. Green opens probe flow; Fail resolves Yellow, Continue records Blue probe depth, and Done resolves Indigo.
_Avoid_: Legacy four-color score only, Vietnamese probe color labels

**Probe Event**:
A Fail, Continue, or Done follow-up recorded after a Green Provisional Result.
_Avoid_: Sub-screen, sub-question

**Final Result**:
The effective Spectrum Color result eligible for progress metrics. Direct primary results finalize as Red, Orange, or Purple; Green probe Fail finalizes Yellow and Green probe Done finalizes Indigo.
_Avoid_: Score, grade

**Correction**:
An audit-preserving revision of a Final Result that never erases its prior history.
_Avoid_: Edit, overwrite

## Measurement

**Metric Template**:
An approved reusable definition for calculating one operational progress indicator.
_Avoid_: Formula, custom metric

**Metric Version**:
An immutable semantic version of a Metric Template.
_Avoid_: Metric revision

**Metric Observation**:
A calculated metric value for a defined subject and Report Window.
_Avoid_: Score record

**Report Window**:
An explicit period and population over which Metric Observations are calculated or compared.
_Avoid_: Filter, date range

**RFC**:
The share of warm Spectrum Color measurement steps (Red + Orange + Yellow) in a Report Window, using `N_total = planned primary questions + sum(probe steps)` where available.
_Avoid_: Failure score

**RAC**:
The share of cool Spectrum Color measurement steps (Green + Blue + Indigo + Purple) in a Report Window; also displayed as `%c` in Teacher analysis.
_Avoid_: Success score

**CVR**:
Semantic Complexity Value Rating for a Test Item prompt, calculated from `TC × TL × LC` (Unit: Ohm, $\Omega$).
- **TC (Term Complexity)**: Number of chunks / semantic elements from resource (default 3 $\Omega$).
- **TL (Topic Level / Time Latency)**: Vocabulary level progression (A1 to C1) and cognitive hesitation factor ($1.0 - 2.0$).
- **LC (Length / Lexical Complexity)**: Word count density factor ($1.0 - 2.5$, where ~8 words $\approx 1.0$, 15 words $\approx 1.5$, 18-22 words $\approx 2.0$, capped at max 22 words).
_Avoid_: Generic difficulty, final result

**CCI**:
Named current/intensity measurement for a Test Section. The canonical workbook maps `CCI.Ampe (A)` to CCI value and retains CCI ID, Name, description, and category. Unit is Ample (Ampe, A), configured via full CRUD profiles. Legacy `Unit (Ohm)` mappings are obsolete.
_Avoid_: CVR, manually derived score

**CPD**:
Derived live-test demand value calculated as `CVR × CCI` (Unit: Volt, V) and reproducible from stored source measurements.
Standard baseline targets: **12V** for Green Focus tests and **56V** for Red Awareness tests, or customizable on creation.
Spectrum color factors normalize CPD contribution: Red `0.00`, Orange `0.17`, Yellow `0.33`, Green `0.50`, Blue `0.67`, Indigo `0.83`, Purple `1.00`.
_Avoid_: Manually entered metric

**Green Test (Focus Archetype)**:
Live-test assessment measuring sustained focus, breath control, and complete sentence articulation.
Each item is a single, complete, natural bilingual sentence. Sentences follow a strictly linear word count progression across 7 sessions (9-10w up to max 22w), continuous tempo ($TL=1.0$), with zero semantic trap pauses.
_Avoid_: Fragmented hints, SSML break pauses

**Red Test (Awareness Archetype)**:
Live-test assessment measuring cognitive trap detection, awareness, and rapid recovery under semantic interference.
Each item presents a sequence of multi-word collocations (zero single words, each hint $\ge 2$ words). The initial term is always anchored in the Chunks curriculum; subsequent hints scale difficulty via semantic divergence and lower word frequency while preserving grammatical type functions. Audio injects 650ms SSML semantic gaps between hints.
_Avoid_: Single-word lists, complete smooth sentences

**Test Audio Lifecycle & GCP TTS**:
Full audio management covering package start, part intros (1–3), section intros, package end, and every test item. Uses the Google Cloud Text-to-Speech API endpoint (`https://texttospeech.googleapis.com/v1/text:synthesize`) with Neural2 voices (`vi-VN-Neural2-A` for Vietnamese, `en-US-Neural2-F` for English). Supports real-time playback review, single/batch regeneration, and custom audio upload overrides.
- **Audio Playback Chaining & Storage Mapping**:
  In test execution and studio preview playback, question audio follows a deterministic 2-step prefix chaining sequence:
  1. **Prefix Audio**: Plays the localized ordinal number clip `/audio/number_{order}.wav` (e.g. "Câu 1", "Câu 2"). If the clip is unavailable or non-standard (e.g. trial questions / Câu 0), playback gracefully proceeds directly to the item body.
  2. **Question Body Audio**: When the prefix audio completes, the player resolves the item's `narration_variants` record. If an approved storage asset exists, a secure signed playback URL is fetched via `getNarrationPlaybackUrl(variantId)`. If no stored asset exists, it gracefully falls back to Google Cloud TTS preview with a user notification ("Đang phát preview TTS (chưa có audio trong gói)").
  3. **Lifecycle & Intro Audio Resolution**: Non-item audio targets (`package_start`, `part_intro`, `section_intro`, `package_end`) map to approved `narration_variants` records for the selected language, streaming signed URLs from storage or falling back to GCP TTS preview.
_Avoid_: Client-side synthesis only, unverified audio assets, unchained raw prompt playback without ordinal prefixes


---

## Related project docs (not domain language)

| Doc | Purpose |
|-----|---------|
| [`docs/ops/production-runbook.md`](docs/ops/production-runbook.md) | First hosted class: env, seed, Day 1, smoke |
| [`docs/ops/hosted-e2e-checklist.md`](docs/ops/hosted-e2e-checklist.md) | Production pass/fail checklist |
| [`docs/ops/ci-cd.md`](docs/ops/ci-cd.md) | GitHub Actions CI/CD, Vercel secrets, migration promote |
| [`docs/ops/vercel-deploy.md`](docs/ops/vercel-deploy.md) | Manual / first-time Vercel deploy |
| [`docs/ops/supabase-egress-audit-2026-08-03.md`](docs/ops/supabase-egress-audit-2026-08-03.md) | Measured Storage/API egress baseline and prioritized remediation |
| [`docs/adr/`](docs/adr/) | Architecture decisions |

CI/CD workflows: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`. Domain terms above are the source of truth for product language; ops docs do not redefine them.
