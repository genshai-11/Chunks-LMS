# Chunks-LMS

Chunks-LMS measures a learner’s Focus and Awareness over a course through teacher-observed assessments, scheduling, attendance, and progress reports. It deliberately remains independent of question content and learning-resource ownership.

## People and ownership

**Organization**:
The administrative scope that owns users, metric templates, and reports.
_Avoid_: Tenant, school account

**User**:
A stable domain person. Staff may link to one native Supabase Auth identity through `auth_user_id`; a Learner may remain profile-only and use a scoped invite link.
_Avoid_: Auth account, transient session

**Staff Auth Identity**:
A native Supabase `auth.users` account linked to one domain User. It authenticates but does not authorize; active database `staff_roles` grant Admin/Teacher access.
_Avoid_: Clerk subject, metadata role, frontend allowlist

**Account Status**:
Active or inactive for a Teacher or Learner profile. Admin may deactivate without deleting history.
_Avoid_: Banned, deleted

**Teacher**:
A User who owns classes/programs for their learners, starts sessions (selecting 1..N learners), observes, and analyses progress.
_Avoid_: Instructor, assessor

**Learner**:
A User whose Focus and Awareness progress is observed across a Course (program label). Access uses a scoped learner invite rather than staff Supabase Auth in V1.
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

**Probe Event**:
A Fail, Continue, or Done follow-up recorded after a Green Provisional Result.
_Avoid_: Sub-screen, sub-question

**Final Result**:
The effective color result eligible for progress metrics.
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
The share of finalized Assessment Attempts ending Red or Yellow in a Report Window.
_Avoid_: Failure score

**RAC**:
The share of finalized Assessment Attempts ending Green or Purple in a Report Window.
_Avoid_: Success score

**CVR**:
Semantic Complexity Value Rating for a Test Item prompt, calculated from Estimated TC × LC × TL.
_Avoid_: Generic difficulty, final result

**CCI**:
Named current/intensity measurement for a Test Section. The canonical workbook maps `CCI.Ampe (A)` to CCI value and retains CCI ID, Name, description, and category. Legacy `Unit (Ohm)` mappings are obsolete.
_Avoid_: CVR, manually derived score

**CPD**:
Derived live-test demand value calculated as CVR × CCI and reproducible from stored source measurements.
_Avoid_: Manually entered metric

---

## Related project docs (not domain language)

| Doc | Purpose |
|-----|---------|
| [`docs/ops/production-runbook.md`](docs/ops/production-runbook.md) | First hosted class: env, seed, Day 1, smoke |
| [`docs/ops/hosted-e2e-checklist.md`](docs/ops/hosted-e2e-checklist.md) | Production pass/fail checklist |
| [`docs/ops/ci-cd.md`](docs/ops/ci-cd.md) | GitHub Actions CI/CD, Vercel secrets, migration promote |
| [`docs/ops/vercel-deploy.md`](docs/ops/vercel-deploy.md) | Manual / first-time Vercel deploy |
| [`docs/adr/`](docs/adr/) | Architecture decisions |

CI/CD workflows: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`. Domain terms above are the source of truth for product language; ops docs do not redefine them.
