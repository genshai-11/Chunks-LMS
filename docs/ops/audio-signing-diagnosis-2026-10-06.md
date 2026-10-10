# Tests 1-1 audio signing diagnosis — 2026-10-06

## Status

The reported Storage signing failures are confirmed infrastructure connectivity errors. Later real traffic shows successful signing and signed downloads. No production configuration, database rows, audio objects, Functions or app code were changed during this investigation. This is a diagnostic record, not a claim that the agent repaired Supabase infrastructure.

Project: `ekubetkxfcuxlyahesrl`. Times below use Asia/Ho_Chi_Minh (UTC+07); service logs return UTC.

## Evidence

Read-only Supabase MCP log queries for 21:00–22:00 found:

| Window | Operation | Result |
|---|---|---|
| 21:07:26.622–21:10:45.548 | `storage.object.sign` | 15 HTTP 500 errors, all with `connect ECONNREFUSED ...:6543` |
| 21:37:08.371–21:39:14.518 | `storage.object.sign` | 5 HTTP 200 responses |
| 21:37:14.412–21:38:34.165 | `storage.object.get_signed` | 2 HTTP 200 responses |

The failing request stack was:

```text
pg-pool → beginTransaction → beginTransactionWithRetry
→ StoragePgDB.runQuery → StoragePgDB.findObject
→ ObjectStorage.signObjectUrl → getSignedURL
Error: connect ECONNREFUSED [internal IPv6 endpoint]:6543
```

Requests were made by the Edge runtime using `service_role`, Storage app version `1.77.5`, region `ap-southeast-1`. The error occurs while connecting to Storage's database/pooler endpoint, before an object lookup can complete. It is not evidence of a browser autoplay failure or a missing audio object. The reason that endpoint refused connections is not established; a restart, routing change or pooler outage needs provider-side evidence.

Read-only SQL verified:

- `narration-audio` is private (`public = false`).
- Object metadata exists for the three sampled paths: `level-a-green-test-cpd31v/s1-q1-en.wav`, `green-test-49q-v2/s1-q5-en.wav`, and `mini-tests/intro/Intro-mini-green-31.wav` under their full narration prefixes.
- Sampled narration variants referencing these assets are `approved`.
- Metadata existence alone does not verify every stored binary. Later signed GETs returned HTTP 200 for the Level A Q1 and mini-green-31 intro paths.

A tenant configuration update returned HTTP 204 at 21:11:57.224. This is a correlation, not proof of the recovery cause. There was no successful signing traffic observed between the failure window and 21:37 in the queried results; the exact recovery time is unknown.

## Application boundary

The inspected source path is:

```text
TeacherTestRunPage
→ web/src/modules/catalog/live-test-generation.ts:getNarrationPlaybackUrl
→ live-test-generation Edge Function:getNarrationPlaybackUrl
→ active staff / approved narration checks
→ audio_assets lookup
→ admin.storage.createSignedUrl(storage_path, 600)
→ Storage database connection failure
```

References:

- `supabase/functions/live-test-generation/index.ts:827–873`: staff validation, asset lookup and signed URL creation; signing errors are propagated.
- `web/src/modules/catalog/live-test-generation.ts:266–279`: successful URLs cached in memory for nine minutes.
- `web/src/lib/request-cache.ts:65–105`: rejected fetches are not cached as successful values; the in-flight entry is removed in `finally`.
- `web/src/pages/teacher/TeacherTestRunPage.tsx:1026–1138`: audio loading / item playback.

Item playback awaits signing without a local error boundary, while several callers discard its Promise with `void`. This is a separate resilience candidate: a signing failure may not provide the same controlled UI error state as `loadAudioVariant`. It did not cause the recorded Storage 500s. Confirm with a targeted rejected-signing regression test before changing product code.

## Safe recovery and verification

1. Reload the affected Tests 1-1 run and press Play explicitly after the service recovers. Do not clear assessment history or local mutation queues.
2. Verify both a question and an intro: Edge playback request succeeds, Storage signing POST returns 200, signed GET returns 200/206, and audio is audible.
3. If signing returns 500 again, capture `sb_request_id`, timestamp/timezone, Storage `error.message` and the corresponding Function error. Do not share signed URL tokens or service credentials.
4. If `ECONNREFUSED ...:6543` recurs, escalate the project/request IDs to Supabase support. Do not change RLS, rotate Auth signing keys, make the bucket public or regenerate files to treat this connectivity error.
5. Optional app hardening requires an approved local fix scope: controlled signing-error UI and manual retry, regression tests for recovery and no scoring/history changes. Automatic retries must be bounded and restricted to transient failures, not authorization/missing-object errors.

Browser playback was not verified in this investigation: no authenticated browser run was available. Later successful backend traffic confirms recovery of the observed signing/download paths, not every audio item or end-to-end browser behavior.

## Read-only log check

Run through Supabase MCP `query_logs`, with explicit ISO start/end timestamps including `+07:00` (maximum 24-hour window):

```sql
select min(timestamp) first_seen,
       max(timestamp) last_seen,
       count(*) requests,
       log_attributes['res.statusCode'] status,
       log_attributes['operation'] operation,
       log_attributes['error.message'] error
from logs
where source = 'storage_logs'
  and log_attributes['operation'] in ('storage.object.sign', 'storage.object.get_signed')
group by status, operation, error
order by first_seen;
```

Do not use `scripts/verify-supabase.mjs` as a read-only production probe: it includes an organizations upsert/delete and does not test this signing boundary.

## Sources and limits

- Supabase MCP project URL, read-only SQL and timestamped service logs; the second read-only account had insufficient project permissions, so the project-scoped authenticated MCP was used.
- CodeGraph preflight reported current source content; SQL is not indexed and was checked directly.
- Current Supabase docs: [Serving private assets](https://supabase.com/docs/guides/storage/serving/downloads). Storage URL signing uses a dedicated internal key, distinct from Auth JWT signing keys.
- Supabase changelog index was fetched and checked for relevant Storage breaking changes. No evidence ties this incident to a documented API breaking change.
