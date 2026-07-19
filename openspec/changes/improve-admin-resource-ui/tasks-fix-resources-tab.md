# Redefine Admin Resources from Chunks Resource.xlsx

Source reviewed: `C:\Users\gensh\Downloads\Chunks Resource.xlsx` on 2026-07-19.

## Workbook-derived data model

### Sheets

1. **Package-test**
   - Defines one package: `Pre-test`
   - Description in workbook: `Test đầu khóa ERE`; product target from Lucy: `Bài test đầu khóa EE65`
   - Contains 8 package sessions: `Test 01` … `Test 08`

2. **CCI**
   - Defines 8 CCI rows: `cci-001` … `cci-008`
   - Columns: `Session`, `CCI_id`, `CCI Name`, `Ampe (A)`, `Description`, `Category`
   - App mapping:
     - `CCI Name` → `cci_categories.label`
     - `Ampe (A)` → `cci_categories.value`
     - `Description` → `cci_categories.description`
     - `Category` → `cci_categories.metadata.mainCategory` (`Blow` / `Flow` / `Chunks`; workbook has `null` for sessions 4 and 8)
     - `CCI_id` → `cci_categories.metadata.sourceCciId`

3. **Chunks-resource - CVR_new**
   - Defines 80 sentence items
   - 8 sessions × 10 items/session
   - Columns: `Material`, `Session No.`, `Item_id`, `CCI-id`, `CVR-id`, `Term (Tiếng Việt)`, `Term (Tiếng Anh)`, `Session No.`, `Complete Sentence (Vie)`, `Complete Sentence (Eng)`
   - App mapping:
     - one row → one `test_items` row
     - `Complete Sentence (Vie/Eng)` → `prompt_vi` / `prompt_en`
     - `Term` fields → `term_vi` / `term_en`
     - `CVR-id` → stored as `source_metadata.sourceCvrId` and mirrored into generated `measured_cvr` by `tc=CVR-id`, `lc=1`, `tl=1` until true TC/LC/TL are available
     - `CCI-id` → item-level source metadata; session-level CCI still comes from `Package-test`/`CCI` mapping

### Distribution verified

- Session 1: 10 items, CVR 3.0, workbook item-level CCI has `cci-001` × 9 and `cci-002` × 1
- Session 2: 10 items, CVR 5.0, CCI `cci-002`
- Session 3: 10 items, CVR 7.0, CCI `cci-003`
- Session 4: 10 items, CVR 9.0, CCI `cci-004`
- Session 5: 10 items, CVR 11.0, CCI `cci-005`
- Session 6: 10 items, CVR 13.0, CCI `cci-006`
- Session 7: 10 items, CVR 15.0, CCI `cci-007`
- Session 8: 10 items, CVR 17.0, CCI `cci-008`

## Required implementation update

### Phase 1 — Supabase canonical seed from workbook

- [x] T1.1 Review workbook sheets and derive package/session/CCI/CVR item model
- [x] T1.2 Add idempotent Supabase migration to seed canonical `Pre-test` / `Bài test đầu khóa EE65`
- [x] T1.3 Seed 8 CCI categories with source IDs, Ampe, descriptions, and main categories
- [x] T1.4 Seed 8 Test Sections mapped to CCI and target CVR
- [x] T1.5 Seed 80 Test Items with sentence text, term text, source item id, source CCI id, and source CVR id
- [x] T1.6 Preserve existing legacy/resource rows; do not delete or rewrite assessment history

### Phase 2 — Package-first Admin Resources UI

- [x] T2.1 Rename/reframe Resources page around `Test Packages`, not generic resources
- [x] T2.2 Add package selector/list: package name, version, description, session count, item count, mapping status
- [ ] T2.3 Show selected package sessions: Session/Test name, target CVR, mapped CCI, Ampe, CPD = target CVR × Ampe, item count
- [ ] T2.4 Session drill-in shows the 10 sentence items with VI/EN sentence, term, source CCI id, source CVR id, and measured CVR
- [x] T2.5 Keep CCI CRUD as supporting catalog management, not the primary page model
- [x] T2.6 Keep CVR sentence CRUD scoped to selected package/session instead of showing a global unscoped item list by default

### Phase 3 — Package creation/editing UX

- [ ] T3.1 Create package from existing CCI/CVR sentence rows or manual empty draft
- [ ] T3.2 Admin can edit draft package name/version/description
- [ ] T3.3 Admin can edit draft session CCI/CVR mapping and see CPD immediately
- [ ] T3.4 Admin can edit draft item sentences and term fields
- [ ] T3.5 Published/history-linked packages remain immutable; create new draft/version for changes

### Phase 4 — Verification and release controls

- [ ] T4.1 `npm run openspec:validate`
- [ ] T4.2 `npm run lint`
- [ ] T4.3 `npm run typecheck`
- [ ] T4.4 `npm run test`
- [ ] T4.5 `npm run build`
- [ ] T4.6 Do not apply remote Supabase migration or deploy production without Lucy's explicit approval in the current turn
