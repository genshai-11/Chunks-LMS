## Why

The Admin Live Tests page has grown into a single 1,600+ line component that mixes package selection, draft creation, CCI snapshot overrides, CSV import, CVR generation, narration approval, and legacy-resource inspection. This makes the UI hard to scan and hard to extend safely for Admin resource-management work.

Admins now need a compact resource management surface to load, view, edit, and remove eligible CVR, CCI, and Session catalog entries while preserving the published Package Version and assessment-history immutability guarantees in `CONTEXT.md` and ADR 0007.

---

## What Changes

- Add an Admin **Resources** tab/page for catalog-oriented management of CVR, CCI, and Live Test Session resources.
- Split resource management concerns from the current Admin Live Tests workflow so Live Tests can focus on package/version/section/item generation and review.
- Redesign `admin/live-tests` layout into smaller, responsive panels with a compact shared filter/selector bar instead of repeated selectors across tabs.
- Add guarded edit/delete/archive behavior: draft/unused catalog records may be edited or deleted where the database allows it; published or history-linked resources must be archived or superseded instead of destructively changed.
- Keep Learning Session assessment identity resource-agnostic and keep CVR/CCI/CPD as measurement/catalog metadata.

---

## Capabilities

### Modified Capabilities

- `session-scheduling`: Admins can manage resource catalog entries used to prepare test Learning Sessions without mutating historical Learning Sessions.
- `identity-access`: Admin-only resource management actions are protected by staff role checks and existing RLS/security boundaries.

---

## Non-goals and product-boundary check

- No content-authoring or general resource-library expansion outside Live Test Packages and measurement catalogs.
- No destructive rewrite of published Package Versions, Session Questions, Assessment Attempts, assessment events, snapshots, final results, or corrections.
- No production deploy or remote Supabase migration without explicit approval in the current turn.
- No independent UI scoring or CPD calculation rules beyond displaying values derived by catalog/domain helpers.
