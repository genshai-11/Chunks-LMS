# Fix Admin/Resources Tab – OpenSpec Tasks

> **Baseline**: Tests ✅ (36 files, 151 tests), TypeCheck ✅  
> **Gate**: All tasks below must pass `npm run lint && npm run typecheck && npm run test -- --run && npm run build` before any push/deploy.

---

## Gap analysis (what is currently broken / missing)

| #   | Area                                            | Problem                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **CCI tab – create**                            | No way to create a new CCI Profile or add a new CCI Category to a draft profile. CRUD is only edit + delete + archive-profile.                                                                                                                                                    |
| G2  | **CCI tab – publish**                           | No way to publish a draft CCI Profile to `active` status directly from Resources tab. Only archive is offered.                                                                                                                                                                    |
| G3  | **CCI tab – supersede**                         | No way to create a measurement override snapshot (supersede) from the CCI tab; the override form only lives inside `AdminLiveTestsPage`.                                                                                                                                          |
| G4  | **Sessions tab – set/override CCI+CVR mapping** | Measurement snapshot column is read-only. Admin can _see_ `activeCciLabel / activeTargetCvrOhm` but cannot set or override the mapping from this tab. Must navigate to Live Tests page, which is opaque.                                                                          |
| G5  | **Sessions tab – drill into items**             | Sessions tab shows `itemCount` but clicking it does nothing. No inline or linked view of the CVR items (questions) belonging to a section.                                                                                                                                        |
| G6  | **CVR tab – filter by session/section**         | CVR tab lists all items across all packages. No section-scoped filter. Only text search and status filter exist.                                                                                                                                                                  |
| G7  | **Sessions – no-snapshot warning**              | Sessions table shows snapshot label+value but does not warn when no snapshot is set (blocking a live session).                                                                                                                                                                    |
| G8  | **CCI status filter ambiguity**                 | CCI `profileStatus` uses `active` (not `published`). The shared `StatusFilter` has `active` as an option but the hint text says "published, active, archived" mixing package-version and CCI-profile status terminology. Needs clarity + verify the predicate is correctly wired. |

---

## Task list

### Phase 1 – Fixes (bugs / missing critical paths)

#### T1 – Add section-scoped filter to CVR tab

**Files**: `web/src/pages/admin/AdminResourcesPage.tsx`  
**What**: Add a **Section** `<select>` populated from unique `(sectionId, sectionTitle, sectionOrder)` tuples already present in `cvrRows`. Adds `sectionFilter` state; `filteredCvrRows` gains `.filter(row => sectionFilter === 'all' || row.sectionId === sectionFilter)`.  
**Acceptance**:

- [ ] Section select resets to `all` when switching tabs.
- [ ] Items correctly scoped when a section is chosen.
- [ ] Visual verify; no new unit test required.

---

#### T2 – Drill-in: Sessions tab → items inline

**Files**: `web/src/pages/admin/AdminResourcesPage.tsx`  
**What**: Each session row gets an expand toggle. When expanded, render a sub-table of items filtered from `cvrRows` by `sectionId` (no new network call needed).  
**Acceptance**:

- [ ] Expanded view shows: item order, promptVi, promptEn, TC, LC, TL, measured CVR, status.
- [ ] Collapse restores row to compact view.
- [ ] Visual verify; no new unit test required.

---

#### T3 – Show "No snapshot" warning on Sessions rows

**Files**: `web/src/pages/admin/AdminResourcesPage.tsx`  
**What**: In the Measurement snapshot column, if both `row.activeTargetCvrOhm === null` and `row.activeCciLabel === null`, replace the current `—` with a `⚠ No snapshot set` badge in a warning color.  
**Acceptance**:

- [ ] Badge visible for rows with no snapshot.
- [ ] Normal display unchanged for rows with snapshot data.

---

#### T4 – Inline "Set / Override mapping" for Sessions tab

**Files**:

- `web/src/pages/admin/AdminResourcesPage.tsx`
- `web/src/lib/test-packages.ts` (already has `createSnapshotOverride`)

**What**: Add an inline form per Sessions row:

1. **Target CVR (Ω)** — number input, required.
2. **CCI Profile** — select from `cciRows` distinct profiles where `profileStatus` is `draft` or `active`, ordered by name.
3. **CCI Category** — select filtered by chosen profile, ordered by `categoryOrder`.
4. **Reason** — text input (required for override when a snapshot already exists; optional for first mapping).
5. Save button calls existing `createSnapshotOverride()` from `lib/test-packages.ts`.
6. On success: update `sessionRows[n].activeTargetCvrOhm`, `activeCciLabel`, `activeCciValue` in local state.

**Acceptance**:

- [ ] Form opens inline (not a modal).
- [ ] Profile/Category selects are wired correctly (category list re-fetches from already-loaded `cciRows`, no new network call).
- [ ] Validation error shown if CVR or Category missing.
- [ ] Supersedes previous snapshot (`supersedesSnapshotId` = current snapshot id or null).
- [ ] No DB migration needed — `section_measurement_snapshots` table exists since `20260719033446`.

---

#### T5 – Verify and fix CCI `active` status filter

**Files**: `web/src/pages/admin/AdminResourcesPage.tsx`  
**What**: Audit `filteredCciRows` predicate — confirm `statusFilter === 'active'` correctly matches `row.profileStatus === 'active'`. Update hint text from "Published, active, archived" → "Active, draft, archived" specifically for CCI context, or add a tooltip clarifying the difference between package `published` and CCI profile `active`.  
**Acceptance**:

- [ ] Setting status filter to `active` shows only active CCI profile rows.
- [ ] Setting to `published` shows zero CCI rows (since CCI has no `published` state) — current behavior is probably wrong here.
- [ ] Hint/tooltip text is accurate for both CVR (package version status) and CCI (profile status) contexts.

---

#### T6 – Add "Publish profile" button for draft CCI profiles

**Files**:

- `web/src/pages/admin/AdminResourcesPage.tsx`
- `web/src/lib/test-packages.ts`

**What**:

1. Add `publishCciProfile(profileId)` to `lib/test-packages.ts`: updates `cci_profiles` set `status = 'active'` where `id = profileId` and current status is `draft`. Returns mapped `CciProfile`.
2. CCI rows table: add **"Publish profile"** button in Actions column, visible when `row.profileStatus === 'draft'`. Confirm dialog: "Publish this CCI Profile? Once active it can no longer be edited — only archived."
3. On success: update `cciRows` state entries for that `profileId` to `profileStatus: 'active'`.

**Acceptance**:

- [ ] `publishCciProfile` guard rejects non-draft profiles with a clear error.
- [ ] Button absent / disabled when profile is `active` or `archived`.
- [ ] On publish, CCI edit button becomes disabled for that profile's rows (same as `active` rows today).
- [ ] Unit test: add `publishCciProfile` domain guard test.

---

#### T7 – Add "Create category" form for draft CCI profiles

**Files**:

- `web/src/pages/admin/AdminResourcesPage.tsx`
- `web/src/lib/test-packages.ts`

**What**:

1. Add `createDraftCciCategory(input: { profileId, label, value, description, mainCategory })` to `lib/test-packages.ts`. Guard: profile must be `draft`. Inserts row, auto-computes `category_order` as `max + 1`. Returns mapped `CciCategory`.
2. CCI panel: show a **"+ Add category"** button per profile group (or at the CCI panel header). Opens an inline row form at the bottom of that profile's rows: label (text), value (number), description (text, optional), mainCategory (select: Blow/Flow/Chunks/Unmapped).
3. On save: append new `CciRow` (with `profileName`, `profileVersion`, `profileStatus`) to `cciRows` state.

**Acceptance**:

- [ ] Create form only appears for profiles with `profileStatus === 'draft'`.
- [ ] New category appears in the CCI table immediately.
- [ ] Unit test: domain guard (draft profile required).

---

### Phase 2 – UX polish (after Phase 1 green)

#### T8 – Sessions tab: snapshot history count

**Files**: `web/src/pages/admin/AdminResourcesPage.tsx`  
**What**: Extend `loadResources()` to count `section_measurement_snapshots` per `test_section_id`. Add `snapshotCount: number` to `SessionRow`. Display as "1 mapping" / "N mappings" / `⚠ No mapping` in the Measurement snapshot column.

#### T9 – CVR tab: package+version breadcrumb in section column

The section column already shows package title and version label but the width is fixed. Make it `min-width: auto` and allow wrapping on smaller viewports.

#### T10 – Deprecate snapshot override in AdminLiveTestsPage

After T4 is validated, add a `// TODO: remove after admin-resources override is live (tasks-fix-resources-tab T4)` comment to the snapshot override panel in `AdminLiveTestsPage.tsx` so it can be cleaned up in a follow-up pass without blocking current work.

---

## Pre-run checklist (before implementing any task)

- [x] `npm run test -- --run` passes (36 files, 151 tests — confirmed 2026-07-19)
- [x] `npm run typecheck` passes (confirmed 2026-07-19)
- [ ] `npm run lint` — run and fix any existing errors before starting
- [ ] `npm run build` — baseline to confirm no pre-existing build regressions

## Completion gate (after all Phase 1 tasks)

```bash
npm run lint
npm run typecheck
npm run test -- --run   # must remain 36+ files, 151+ tests
npm run build
```

**No production deploy or remote Supabase migration** until Lucy explicitly approves in the current turn.  
T4, T6, T7 write to already-migrated Supabase tables — no new migration SQL needed.
