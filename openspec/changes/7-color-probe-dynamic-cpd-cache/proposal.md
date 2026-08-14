# Proposal: 7-Color Probe Flow, Dynamic CPD Matrix, Sample Expansion, and API Caching Layer

## Why

1. **Measurement Accuracy & Spectrum Fidelity**: The current 4-color model (Red, Yellow/Orange, Green, Purple) flattens probe nuances. Expanding the assessment spectrum to 7 rainbow colors (Red, Orange, Yellow, Green, Blue, Indigo, Purple) with dedicated probe action mappings (Fail = Yellow, Continue = Blue, Done = Indigo) captures exact learning steps without losing probe history.
2. **True Observation Sample Size**: In multi-step probing ($n$), each probe action represents an active observation opportunity. Calculating the denominator $N_{\text{total}}$ as initial questions plus all probe steps reflects real observation volume and enables accurate Struggle Rate (RFC: Red+Orange+Yellow) and Achievement Rate (RAC: Green+Blue+Indigo+Purple).
3. **Dynamic Cognitive Processing Demand (CPD)**: Replacing fixed $\{0,1,2,3\}$ multipliers with configurable weight matrix $x \in [0, 1]$ across the 7 colors allows flexible CPD calculation with per-question averaging across probe steps.
4. **Navigation Performance & Egress Reduction**: Screen transitions currently trigger redundant network calls and unmount/mount re-fetches. An in-memory SWR cache layer prevents page flashes and cuts unnecessary API egress.

## What Changes

- **7-Color Result Lifecycle**: Expand `ResultColor` domain type to `'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple'`.
- **Probe Action Color Mapping**: Green opens probe; Fail records Yellow and finalizes; Continue records Blue and increments depth; Done records Indigo and finalizes. Store full `recordedColors: ResultColor[]`.
- **Expanded Sample Size & Metrics**: Total sample $N_{\text{total}} = \text{Questions} + \sum n_{\text{probe}}$. RFC = $\text{Warm colors} / N_{\text{total}}$. RAC = $1 - \text{RFC}$.
- **Dynamic CPD Engine & Admin Setup**: Admin UI for selecting weight presets (Linear $0 \dots 1$, Custom $0.0 \dots 1.0$) and question-level CPD averaging: $\text{Question CPD} = \frac{1}{|C|} \sum (\text{CVR} \times \text{CCI} \times x_c)$.
- **In-Memory SWR API Cache**: Lightweight cache with deduplication and stale-while-revalidate for fast transitions between Teacher Observe, Classes, and Admin pages.

## Capabilities

### Modified Capabilities
- `result-lifecycle`: 7-color lifecycle, multi-color probe sequence recording, and warm/cool color categorization.
- `assessment-capture`: 4-button primary dock (Red, Orange, Green, Purple) + 3-color probe dock (Yellow Fail, Blue Continue, Indigo Done).
- `metric-templates`: Dynamic color weights $x \in [0, 1]$, question-averaged CPD derivation, and expanded sample metrics.
- `progress-reporting`: Updated RFC/RAC, color distribution charts, and CPD summaries supporting 7 colors.

## Non-goals
- No destructive modification of historical finalized sessions (legacy 4-color records cleanly map into the 7-color system).
- No organization membership expansion beyond V1 scope.
