# Live-test resources and derived CPD

Chunks-LMS will add Live Test as a resource-driven extension of existing live observation capture. Current live lesson behavior remains the default and unchanged. Live-test resources provide fixed prompt input, language-specific audio, and CVR/CCI metadata, while the assessment lifecycle still records resource-agnostic Session Questions, Assessment Attempts, immutable events, and finalized snapshots.

A Learning Session now separates **session kind** (`regular`, `pretest`, `posttest`) from **session format** (`lesson`, `test`). Test sessions also carry a prompt language (`vi` or `en`) that selects either Vietnamese or English complete sentences for display and audio. This prompt language does not create a separate Test Item identity.

Test Resource metadata remains outside the assessment identity. A Test Item links to a Session Question only through `session_questions.external_ref` using the stable shape `live-test-item:<id>`. This preserves the accepted resource-agnostic Session Question model and lets reports join finalized results to resource metadata when needed.

Each Test Item stores CVR and CCI source measurement values and labels. CPD is derived from those values as:

```text
CPD = CVR × CCI
```

The system must not require CPD to be manually authored. Storing CVR and CCI separately keeps CPD reproducible from records and supports future changes to display precision, banding, or charting without erasing source measurements.
