# Edge Generation Contract

## Function

`live-test-generation` remains JWT-verified and Admin-only.

## Supported actions in this release

### `generateNarration`

Input:

- package version ID
- target: `section_intro|test_item`
- exactly one section or item ID matching target
- language: `vi|en`
- voice ID

Output:

- generation job ID/status
- narration variant ID on success
- private audio path metadata
- redacted provider metadata
- typed error on failure

Rules:

- section intro source comes from the canonical text containing Session, CVR, CCI Ampe, and CCI Name;
- item source comes from the selected complete sentence;
- source hash is stored with the variant;
- generated status is not approved status;
- retries are bounded and audited;
- provider secrets and raw secret-bearing responses are never returned/stored.

### `approveGeneratedAsset`

Input: generation job ID and optional review notes.

Output: approved variant ID, approver, timestamp, and status.

Rules:

- only succeeded jobs with a generated audio asset may be approved;
- source hash must still match current draft source;
- approving one language/voice does not approve another.

### `generateTestItem`

Retained for existing/future review workflows. Generated content is preview-only and cannot auto-publish.

## Explicitly deferred

`generateCVRPreview` is not deployed in this feature. The later recovery-branch implementation must receive separate contract tests and review before adoption.

## Storage contract

- Bucket: private `narration-audio`.
- Object prefix: `narrations/{packageVersionId}/{jobId}.{format}`.
- Writes occur through trusted Edge credentials.
- Runtime reads require authorized/signed access and do not make the bucket public.
- Rollback preserves objects until package/database restore verification completes.
