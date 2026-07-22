# Hosted end-to-end checklist

Run against **production** (or production-like preview with native Supabase Auth).  
Do **not** enable `VITE_AUTH_BYPASS` for this checklist.

**Date:** _______________  
**URL:** _______________  
**Operator:** _______________  

---

## A. Auth & shell

| # | Check | Pass |
|---|--------|------|
| A1 | Home loads; no auth bypass badge | ☐ |
| A2 | Supabase staff signup/confirmation/sign-in and refresh persistence work | ☐ |
| A3 | Unsigned user cannot open `/admin` or `/teacher` | ☐ |
| A4 | Top bar shows only staff roles held + Portal | ☐ |
| A5 | Learner path remains scoped `/access` and separate from staff Auth | ☐ |

## B. Admin provisioning

| # | Check | Pass |
|---|--------|------|
| B1 | Create or open a Course | ☐ |
| B2 | Create Class with teacher + capacity ≥ 1 | ☐ |
| B3 | Seat learner with unique email | ☐ |
| B4 | Copy invite link; URL contains `/access?email=` | ☐ |
| B5 | Metrics page loads; max probes configurable | ☐ |

## C. Teacher live path

| # | Check | Pass |
|---|--------|------|
| C1 | Teacher home shows active class (switcher if multi) | ☐ |
| C2 | Schedule: plan or start session | ☐ |
| C3 | Live session: mark attendance for all seats | ☐ |
| C4 | Observe: record Red/Yellow/Green/Purple; resolve Green probe if used | ☐ |
| C5 | Complete session | ☐ |
| C6 | Analysis: sample size ≥ 1 for at least one metric window | ☐ |
| C7 | Archive: completed day appears with colors | ☐ |

## D. Learner portal

| # | Check | Pass |
|---|--------|------|
| D1 | Open invite link in private/incognito window | ☐ |
| D2 | Portal shows correct display name | ☐ |
| D3 | Attendance reflects teacher marks | ☐ |
| D4 | Analysis shows only that learner’s results | ☐ |
| D5 | Cannot navigate to Admin/Teacher without a native session and active staff role | ☐ |

## E. Multi-user / integrity

| # | Check | Pass |
|---|--------|------|
| E1 | Second browser as Admin: Reload workspace; class/learners still present | ☐ |
| E2 | During open session, data not wiped by Admin edits to unrelated course fields | ☐ |
| E3 | Admin Ops shows completed/open sessions sensibly | ☐ |
| E4 | Admin Attendance matrix has cells for the day | ☐ |
| E5 | Admin Audit lists finalize (and correction if tested) | ☐ |
| E6 | Admin Integrity: Run reconciliation (OK or known empty) | ☐ |
| E7 | Admin Integrity: Rebuild ledger from cloud succeeds | ☐ |

## F. Sign-off

| Item | Value |
|------|--------|
| Course code | |
| Class name | |
| Learning session day # | |
| Finalized result count | |
| Issues / notes | |
| Signed | |

**Pass criteria for Phase E exit:** A1–A5, B1–B4, C3–C6, D1–D4, E1, E6 all Pass.
