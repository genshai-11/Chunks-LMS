---
status: accepted
supersedes: 0005-live-test-resources-and-derived-cpd
---

# Flexible immutable Live Test packages

Chunks-LMS V2 will model Live Test input as flexible Test Packages with immutable published versions, flexible sections/items, section-level `target_cvr_ohm`, CCI Profile snapshots, item-level `measured_cvr = TC × LC × TL` validation, and CPD derived as `target_cvr_ohm × CCI`. This supersedes the fixed 8×10 Live Test Resource model for future implementation while preserving existing hosted data through compatibility migration; the trade-off is a deeper package/version catalog and migration matrix in exchange for history-safe package evolution, reproducible CPD, and independent intro/item narration.
