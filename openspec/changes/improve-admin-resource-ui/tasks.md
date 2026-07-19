## 1. OpenSpec and discovery

- [x] 1.1 Read `AGENTS.md`, `CONTEXT.md`, relevant ADRs, and architecture review before implementation
- [x] 1.2 Inspect OpenSpec state with JSON commands
- [x] 1.3 Analyze `web/src/pages/admin/AdminLiveTestsPage.tsx`, `AdminLayout.tsx`, route wiring, and catalog helpers
- [x] 1.4 Add OpenSpec proposal/design/spec deltas for Admin Resources and Live Tests UI redesign
- [x] 1.5 Run strict OpenSpec validation

## 2. Admin Resources route and navigation

- [x] 2.1 Add `/admin/resources` route and Admin nav item
- [x] 2.2 Create `AdminResourcesPage` with CVR, CCI, and Sessions sub-tabs
- [x] 2.3 Add compact search/status/package/version/section filters shared across resource sub-tabs
- [x] 2.4 Add loading/empty/error states that match existing Admin UI patterns

## 3. Catalog data helpers and guarded actions

- [x] 3.1 Extend catalog helper functions to load resource overview data for CVR items, CCI profiles/categories, Test Packages, Package Versions, Test Sections, and usage counts
- [x] 3.2 Add draft-only edit helpers for eligible CVR/Test Item and Session/Test Section metadata
- [x] 3.3 Add draft/unlinked delete helpers with explicit confirmation and safe error reporting
- [x] 3.4 Add archive/supersede affordances for published or history-linked resources instead of destructive edit/delete

## 4. Redesign `admin/live-tests`

- [ ] 4.1 Extract compact package/version/section selector state into a reusable filter/selector component
- [ ] 4.2 Reorganize Live Tests tabs into focused workflow sections: Package workflow, Generate CVR, Narration review, CSV import, Legacy read-only
- [ ] 4.3 Replace repeated selector panels and wide inline grids with responsive panels that collapse cleanly on smaller screens
- [ ] 4.4 Keep package publish, snapshot override, generation, narration approval, and CSV import behavior unchanged unless covered by tests

## 5. CCI catalog correction

- [x] 5.1 Add CCI main category metadata (`Blow`/`Flow`/`Chunks`) to the Admin Resources CCI UI
- [x] 5.2 Add Supabase migration to normalize CCI action labels, Ampe values, descriptions, and latest measurement snapshot overrides
- [x] 5.3 Keep remote Supabase migration unapplied pending explicit production approval

## 6. Verification and release controls

- [x] 6.1 Run `npm run openspec:validate`
- [x] 6.2 Run `npm run lint`
- [x] 6.3 Run `npm run typecheck`
- [x] 6.4 Run `npm run test`
- [x] 6.5 Run `npm run build`
- [x] 6.6 Report no production deploy status, deployment impact, and rollback notes before any push/deploy request
