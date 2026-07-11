# Hybrid assessment events and snapshots

Chunks-LMS will use a Postgres-centered modular monolith with immutable events for assessment, probe, finalization, and correction history, plus current-state snapshots for realtime UX and reporting. This preserves auditability and future metric reproducibility without imposing full event sourcing on ordinary roster, scheduling, and course administration.
