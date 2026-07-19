# Chunks-LMS

Chunks-LMS measures a learner’s Focus and Awareness over a course through teacher-observed assessments, scheduling, attendance, and progress reports. It deliberately remains independent of general question content authoring and learning-resource ownership.

## People and ownership

**Chunks Workspace**:
The single administrative scope that owns staff, learners, classes, Live Test Packages, metric templates, and reports in the current product.
_Avoid_: Tenant, multi-organization workspace, school account

**User**:
A person represented in the Chunks Workspace, either as authenticated staff or as a learner reached through learner access.
_Avoid_: Account, profile

**Account Status**:
Active or inactive for a Teacher or Learner. Admin may deactivate without deleting history.
_Avoid_: Banned, deleted

**Admin**:
A staff User who manages workspace users, Live Test Packages, measurement catalogs, metric templates, and reports.
_Avoid_: Owner, superuser

**Teacher**:
A staff User who owns classes/programs for their learners, starts sessions (selecting 1..N learners), observes, and analyses progress.
_Avoid_: Instructor, assessor

**Learner**:
A User whose Focus and Awareness progress is observed across a Course (program label). Learners use signed learner access in this version, not staff authentication accounts.
_Avoid_: Student, participant

**Learner Access**:
A revocable, expiring invitation route that lets one Learner read only their permitted progress, attendance, schedule, and finalized reports.
_Avoid_: Learner login, learner account, public share link

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
May carry **session kind** (regular, pretest, posttest) for RFC baseline comparison, **session format** (lesson or test) for input behavior, optional prompt settings for live-test display/audio, and an optional participant learner list (subset of the class for multi-select capture).
_Avoid_: Round, room session

**Live Test Package**:
A versioned package of ordered Test Sections and Test Items used as predefined input for live-test Learning Sessions.
_Avoid_: Test Resource, resource library, lesson content

**Package Version**:
An immutable published version of a Live Test Package. Draft versions may change; published versions preserve their section, item, measurement, and narration snapshots.
_Avoid_: Resource revision, mutable package

**Test Section**:
An ordered section within a Package Version containing a flexible number of Test Items, section-level `target_cvr_ohm`, CCI snapshot, and optional intro narration.
_Avoid_: Fixed block, lesson section, class session

**Test Item**:
One ordered prompt within a Test Section whose selected language text can drive a Session Question through an external reference and whose TC/LC/TL values validate measured CVR.
_Avoid_: Session Question, sentence identity

**Narration Variant**:
An approved or generated audio choice for a Test Section intro or Test Item, with its own language and voice.
_Avoid_: Prompt language, package identity

**Attendance**:
A Learner’s participation status for a Learning Session.
_Avoid_: Presence

## Assessment

**Session Question**:
An ordered measurement opportunity within a Learning Session, independent of question content.
Each Session Question maps to exactly one Learner (round-robin assignment across the class roster). With N questions and M learners, each learner is observed on ~N/M questions.
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

**Target CVR**:
A section-level Semantic Complexity Value Rating target stored as `target_cvr_ohm` and imported from CSV `Unit (Ohm)` for the one-time V2 migration.
_Avoid_: Item CVR, final difficulty score

**Measured CVR**:
An item-level validation value calculated as `TC × LC × TL` for a Test Item prompt.
_Avoid_: Target CVR, CPD input target

**CCI Profile**:
An approved catalog of CCI Categories and values that can be snapshotted onto published Test Sections.
_Avoid_: Manual score sheet, runtime formula

**CCI Category**:
A named current/intensity category selected through a CCI Profile for Test Section measurement snapshots.
_Avoid_: Free-text CCI label

**CPD**:
Derived live-test demand value calculated as `target_cvr_ohm × CCI` and reproducible from stored section measurement snapshots.
_Avoid_: Manually entered metric

**Learner CPD Score**:
A report value calculated as `item_cpd × finalized effective color score` for a Learner’s finalized or corrected Assessment Attempt.
_Avoid_: Raw CPD, grade

---

## Related project docs (not domain language)

| Doc                                                                                                            | Purpose                                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`docs/architecture/v2-domain-architecture-contract.md`](docs/architecture/v2-domain-architecture-contract.md) | V2 domain and architecture contract                     |
| [`docs/ops/production-runbook.md`](docs/ops/production-runbook.md)                                             | First hosted class: env, seed, Day 1, smoke             |
| [`docs/ops/hosted-e2e-checklist.md`](docs/ops/hosted-e2e-checklist.md)                                         | Production pass/fail checklist                          |
| [`docs/ops/ci-cd.md`](docs/ops/ci-cd.md)                                                                       | GitHub Actions CI/CD, Vercel secrets, migration promote |
| [`docs/ops/vercel-deploy.md`](docs/ops/vercel-deploy.md)                                                       | Manual / first-time Vercel deploy                       |
| [`docs/adr/`](docs/adr/)                                                                                       | Architecture decisions                                  |

CI/CD workflows: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`. Domain terms above are the source of truth for product language; ops docs do not redefine them.
