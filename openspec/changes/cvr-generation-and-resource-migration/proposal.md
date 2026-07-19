## Why

Admins need to migrate the original vocabulary words (pink terms, representing 3 Ohms) and import predefined test sentences mapped to specific target CVR values (matching the `Unit (Ohm)` column from the source spreadsheet, rather than the naively computed sheet CVR). Additionally, the system needs a configurable `/generate-CVR` engine to generate sentences using selected vocabulary topics while dynamically tuning Length Complexity (LC) and Topic Level (TL) to meet target Ohm goals.

---

## What Changes

*   **Original Vocab & Sentences Migration:** Parse and import raw vocabulary terms and pre-created sentences from `Chunks-resource - CVR_new.csv` where the target CVR matches the `Unit (Ohm)` column.
*   **CVR Database Seed:** Seed both legacy and V2 test tables (`test_packages`, `test_package_versions`, `test_sections`, `test_items`, `section_measurement_snapshots`) with the complete 8-session set of 80 items.
*   **Target CVR Mappings:** Map target CVR exactly to the `Unit (Ohm)` column values (3, 5, 7, 9, 11, 13, 15, 17) for the imported items.
*   **`/generate-CVR` Engine:** Implement a sentence generation service that accepts a topic (e.g., Day 10) and a target CVR (Ohm limit), selects vocabulary terms from that topic (3 Ohms each), and automatically adjusts LC and TL to match the target complexity.

---

## Capabilities

### Modified Capabilities
*   `session-scheduling`: Map test sections and sessions to imported target CVR Ohms.
*   `live-test-generation`: Extend prompt synthesis to target specific Ohm requirements using target vocabulary.

---

## Non-goals and product boundary
*   No modification to the immutable capture history.
*   Only finalized test items and vocabulary feed operational progress metrics.
