## Context

`AdminLiveTestsPage.tsx` currently owns too many responsibilities:

- global package/version/section selection;
- draft Package Version creation and publish action;
- section measurement snapshot override;
- V2 item table and narration generation actions;
- narration approval queue;
- CSV preview/import;
- `/generate-CVR` preview/review/save flow;
- legacy V1 resource summary.

This causes repeated filters, inline styling, a large render tree, and fragile state coupling across tabs.

## Proposed UI structure

### Admin navigation

Add a top-level Admin navigation item:

- `/admin/resources` — **Resources**

This page owns catalog management:

1. **CVR** — view/search Test Items and their TC/LC/TL/measured CVR values; edit only draft items; delete only draft/unlinked items.
2. **CCI** — view CCI Profiles/Categories; edit draft categories; archive active profiles/categories when history may reference them.
3. **Sessions** — view Test Packages, Package Versions, Test Sections, and session resource readiness; edit draft sections; delete only draft/unlinked sections; archived/superseded for published/history-linked entries.

`/admin/live-tests` remains the operational workflow for package generation, CSV import, narration approval, and preview/review work.

### Shared selector/filter model

Introduce compact UI helpers in or near the Admin pages:

- `ResourceScopeFilters` — package/version/section/status/search filter bar.
- `ResourceSummaryCards` — small readiness counts for packages, versions, sections, items, CCI, and CPD coverage.
- `ResourceTable` style patterns — dense table rows with action menus and confirmation affordances.

Prefer extraction into small components once behavior is clear. Keep domain/database helpers in `web/src/lib/test-packages.ts` or a new catalog-specific helper instead of performing table logic directly inside page render blocks.

## Data and safety rules

- **Draft Package Versions**: editable and deletable when no Learning Session or published resource snapshot depends on them.
- **Published Package Versions**: immutable. UI may archive or create a new draft/version but must not edit or delete published items/sections in place.
- **Section Measurement Snapshots**: supersede with a new snapshot for overrides. Do not overwrite historical snapshots.
- **CCI Profiles/Categories**: edit only drafts; archive/supersede active profiles/categories if referenced by snapshots.
- **Learning Sessions**: historical sessions are never deleted from resource management. The Resources page may show linked session usage/readiness and route to the owning Admin/Teacher workflow.

## Validation path

Before any production-impacting action:

1. `npm run openspec:validate`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`

For PR/preview release control, use feature branch validation first. Do not push to production-triggering branches, deploy, or apply remote Supabase migrations without Lucy's explicit current-turn approval.

## Risks and mitigations

- **Risk:** UI delete controls imply destructive history changes.  
  **Mitigation:** show delete only for draft/unlinked rows; otherwise show archive/supersede guidance.

- **Risk:** resource management becomes content-authoring.  
  **Mitigation:** keep the page scoped to Live Test Packages, CVR/CCI measurement catalogs, and session readiness.

- **Risk:** `AdminLiveTestsPage` extraction changes behavior unintentionally.  
  **Mitigation:** refactor by vertical slices and run lint/typecheck/test/build after each stable slice.
