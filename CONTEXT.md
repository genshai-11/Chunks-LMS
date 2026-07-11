# Chunks-LMS

Chunks-LMS measures a learner’s Focus and Awareness over a course through teacher-observed assessments, scheduling, attendance, and progress reports. It deliberately remains independent of question content and learning-resource ownership.

## People and ownership

**Organization**:
The administrative scope that owns users, courses, classes, metric templates, and reports.
_Avoid_: Tenant, school account

**User**:
A person authenticated to access an Organization.
_Avoid_: Account, profile

**Teacher**:
A User responsible for observing and assessing Learners in an assigned Class.
_Avoid_: Instructor, assessor

**Learner**:
A User whose Focus and Awareness progress is observed across a Course.
_Avoid_: Student, participant

## Learning structure

**Course**:
A longitudinal learning program over which Learner progress is measured.
May include an **auto-schedule**: start day, weekdays (e.g. Tue/Wed), meeting time, and session count (default 15 class days). The course **end date is auto-detected** as the date of the last meeting.
_Avoid_: Curriculum, program

**Class**:
A Teacher-led cohort of Learners taking one Course.
_Avoid_: Room, group, cohort

**Enrollment**:
A Learner’s time-bounded membership in a Class.
_Avoid_: Membership, registration

**Scheduled Session**:
A planned calendar occurrence for a Class.
_Avoid_: Lesson, booking

**Learning Session**:
The actual teaching and assessment occurrence associated with a Class.
_Avoid_: Round, room session

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
