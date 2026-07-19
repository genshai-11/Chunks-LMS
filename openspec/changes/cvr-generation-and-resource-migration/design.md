## Design Decisions

### 1. Source Mapping to V2 Schema
*   **Original Vocab = TC:** English and Vietnamese vocabulary columns act as TC. Mapped to color Pink (3 Ohms base).
*   **Target CVR Ohm = `Unit (Ohm)`:** The target CVR values are drawn directly from the `Unit (Ohm)` column (values: 3, 5, 7, 9, 11, 13, 15, 17) rather than the computed `CVR` sheet column.
*   **Sequential Migration:** Imported sentences are stored in the V2 schema tables (`test_packages`, `test_package_versions`, `test_sections`, `test_items`, `section_measurement_snapshots`) via a database migration script.

### 2. `/generate-CVR` Algorithm
*   **Parameters:** `target_cvr` (desired Ohm value), `topic` (source Day/Session), and `count` (number of sentences).
*   **Constraint Matching:**
    *   Pull target vocabulary terms from database for the specified topic (each Pink term is worth 3 Ohms).
    *   Synthesize sentences containing these terms.
    *   If `target_cvr` is higher than 3 (e.g., 10 Ohm), the system combines the target vocab term with other structural elements (like Blue frames or Green discourse markers) and adjusts Length Complexity (LC) and Topic Level (TL) factors such that:
        $$\text{Target CVR} = \text{TC} \times \text{LC} \times \text{TL}$$
    *   This is enforced via LLM system instructions and output validation.
