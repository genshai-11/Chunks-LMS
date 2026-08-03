# Supabase egress audit — 2026-08-03

- **Project:** `chunks-lms` (`ekubetkxfcuxlyahesrl`)
- **Mode:** read-only inspection; no production data, Storage metadata, migration, or function was changed
- **Dashboard baseline supplied by operator:** 2.87 GB used of 5 GB included (**57.4%**)

## Executive finding

The primary egress risk is **private narration audio**, not Postgres table size.

- `narration-audio` contains 650 objects / 192,147,468 bytes (~192.1 MB decimal).
- Storage logs show repeated pairs of signed-URL creation and WAV downloads.
- 589 objects / 165,520,380 bytes use only `max-age=3600`.
- 61 objects / 26,627,088 bytes use `no-cache`.
- The largest approved package references roughly 78 MB of narration rows; repeated end-to-end test runs can therefore consume the free quota quickly.
- The largest public Postgres relation is under 2 MB, so database row payloads alone do not explain gigabytes of traffic.

`POST /object/sign/...` responses are small. The expensive operation is the subsequent `GET ...wav`; rotating signed URLs and short/no-cache metadata reduce browser/CDN reuse.

## Evidence and limitations

### Storage inventory

| Metric                             |             Value |
| ---------------------------------- | ----------------: |
| Bucket visibility                  |           private |
| Objects                            |               650 |
| Storage bytes                      |       192,147,468 |
| Average object                     |     295,611 bytes |
| Largest object                     |   4,366,124 bytes |
| `audio_assets.bytes` tracked total | 155,807,074 bytes |
| Storage vs tracked difference      |  36,340,394 bytes |

The Storage/database difference warrants reconciliation. It can represent historical uploads, duplicates, or metadata drift; do not delete objects based only on this number.

### Database/query activity

`pg_stat_statements` has not been reset since 2026-07-11, so call counts below are cumulative—not billing-period bytes:

- standalone run-item nested graph: ~38,338 calls;
- latest narration lookups: ~33,736 calls on one hot shape, plus other variants;
- `audio_assets.*` lookups: ~8,172 calls;
- full narration-variant lists: ~7,289 calls;
- realtime `list_changes`: ~319k internal calls.

The hot run-item query selects a nested structure with broad `*` projections. That is a secondary API payload/latency risk, but still much smaller per response than WAV downloads.

### Current code behavior on merged `master`

- merged `master` caches/deduplicates a 10-minute signed URL for 9 minutes in memory + localStorage.
- live-test item priming signs up to four upcoming items but does not itself download each WAV.
- the in-page item playback cache does not record URL expiry, so a long-open test can retain a signed URL after its 10-minute validity.
- this branch retains the 9-minute in-memory reuse but stops persisting bearer URLs and clears that cache on sign-out.
- newly generated/custom-uploaded audio now sets one-year cache metadata in this branch; existing production objects are unchanged.

### Measurement limits

The MCP exposes recent logs and database statistics, not exact byte attribution per endpoint for the billing period. Dashboard usage and Logs Explorer should be captured daily after rollout to prove impact.

## Recommended actions

## P0 — audio transfer and caching

1. **Preserve 9-minute signed-URL request reuse in memory**, never in persistent browser storage, and clear bearer URL entries on sign-out.
2. **Keep audio demand-driven.** Sign current/upcoming items only; never load all 61–281 assets on page entry.
3. **Refresh expired in-page entries.** Add `expiresAt` to `ItemPlaybackCacheEntry` and re-sign shortly before expiry instead of retaining stale URLs indefinitely.
4. **Apply immutable cache metadata to existing objects through a reviewed Storage operation:**
   - 61 `no-cache` objects (~26.6 MB) first;
   - then consider extending the 589 one-hour objects;
   - inventory + checksum before/after;
   - do not update `storage.objects` directly and do not make the bucket public.
5. **Preserve one-year cache metadata for new immutable uploads.** This branch adds `cacheControl: 31536000` to generated and custom narration uploads.
6. **Reconcile 36.3 MB inventory drift** between Storage and `audio_assets.bytes` before removing any object.

Security note: longer browser caching does not require a public bucket. Signed URLs remain scoped, but the URL lifetime/security trade-off must be reviewed before extending the current 10-minute signature TTL.

## P1 — API payload and request count

1. Split `listStandaloneRunItems()` into:
   - immutable run-item/prompt fields cached by run/version;
   - mutable attempts/snapshots refreshed after scoring.
2. Replace nested `select('*')` projections with explicit columns needed by the run page.
3. Replace `select('*')` in package/version/assignment lists with mapper-required columns.
4. Keep request keys stable by immutable IDs and invalidate only the affected prefix after a mutation.
5. Verify React StrictMode/re-render paths do not start duplicate workspace/package loads; retain in-flight deduplication.

## P2 — database compute (not the first egress lever)

Supabase Performance Advisor currently reports:

- 67 unindexed foreign keys;
- 19 overlapping permissive RLS policy cases;
- several “unused” indexes.

Add indexes only for proven hot joins/filters after `EXPLAIN`; consolidate RLS policies only with an authorization regression review. Do not remove an index solely because current statistics label it unused.

References:

- [Unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

## Monitoring plan

For a 5 GB / 30-day allowance, a sustainable average is about **167 MB/day**.

Record for at least seven days after rollout:

1. daily total egress and cached/uncached split;
2. count of Storage signed-URL POSTs and WAV GETs;
3. top object paths by GET count (keep report output non-sensitive);
4. top REST paths and response payload sizes;
5. test sessions completed, to normalize egress per completed session.

Success criteria:

- no duplicate WAV GET for the same object during one normal playback flow;
- repeat playback within cache lifetime is served from browser/CDN cache;
- no full-package audio preload;
- daily average trends toward or below the sustainable quota;
- login/authorization and private-bucket controls remain unchanged.

## Production changes explicitly not performed

- production migration history has six `20260801...` versions absent from `master`; reconcile that drift before any future `db push`;
- no Supabase migration applied;
- no Edge Function deployed;
- no Storage object metadata rewritten;
- no object deleted;
- no bucket visibility changed;
- no `pg_stat_statements` reset.
