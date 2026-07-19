# Canonical standalone test workbook

`Chunks Resource.xlsx` is the source of truth for the standalone learner test package.

- SHA-256: `1022fd3d09fc17e8b07be3e48b67bb6bae5eaac01d2c1498d5933f258a3185d6`
- Required sheets:
  - `Chunks-resource - CVR_new`
  - `Package-test`
  - `CCI`
- Expected shape: one package, eight sessions, ten items per session, 80 items total.
- Session CVR source: `CVR-id`.
- Session CCI source: `CCI.Ampe (A)` plus `CCI Name`.
- Known warning: Session 1 / Item 10 carries `cci-002` while Session 1 maps to `cci-001`; preserve both as provenance.

Run the importer in dry-run mode before generating or applying any SQL. Never place access tokens, database credentials, or generated provider secrets in this directory.
