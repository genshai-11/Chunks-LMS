# Design: 7-Color Probe Flow, Dynamic CPD Matrix, Sample Expansion, and API Caching Layer

## Architecture Overview

### 1. 7-Color Palette & Domain Representation
```typescript
export type ResultColor =
  | 'red'     // Đỏ (Warm / Struggle, x = 0.0 default)
  | 'orange'  // Cam (Warm / Struggle, x = 0.167 default)
  | 'yellow'  // Vàng (Warm / Struggle, Fail in probe, x = 0.333 default)
  | 'green'   // Lục / Xanh lá (Cool / Achievement, Probe trigger, x = 0.5 default)
  | 'blue'    // Lam (Cool / Achievement, Continue in probe, x = 0.667 default)
  | 'indigo'  // Chàm (Cool / Achievement, Done in probe, x = 0.833 default)
  | 'purple'  // Tím (Cool / Achievement, Exceptional, x = 1.0 default)

export const WARM_COLORS: readonly ResultColor[] = ['red', 'orange', 'yellow']
export const COOL_COLORS: readonly ResultColor[] = ['green', 'blue', 'indigo', 'purple']
```

### 2. Result Lifecycle State Machine & Probe Sequence
When an assessment attempt is processed:
- **Direct Recording**:
  - `record_provisional(color: 'red' | 'orange' | 'purple')` -> `status: 'finalized'`, `recordedColors: [color]`, `effectiveColor: color`.
- **Probe Initiation**:
  - `record_provisional(color: 'green')` -> `status: 'probe_open'`, `recordedColors: ['green']`, `probeCount: 0`.
- **Probe Resolution**:
  - `resolve_probe('continue')` -> records `'blue'` into `recordedColors` (e.g. `['green', 'blue']`), increments `probeCount`, retains `status: 'probe_open'`.
  - `resolve_probe('fail')` -> records `'yellow'` into `recordedColors` (e.g. `['green', 'blue', 'yellow']`), sets `effectiveColor: 'yellow'`, `status: 'finalized'`.
  - `resolve_probe('done')` -> records `'indigo'` into `recordedColors` (e.g. `['green', 'blue', 'indigo']`), sets `effectiveColor: 'indigo'`, `status: 'finalized'`.

### 3. Expanded Sample & RFC/RAC Formulas
For a set of finalized attempts:
- Flatten all recorded colors:
  $$C_{\text{all}} = \bigcup_{a \in \text{finalized}} a.\text{recordedColors}$$
- Total sample size:
  $$N_{\text{total}} = |C_{\text{all}}|$$
- Struggle Rate (RFC):
  $$\text{RFC} = \frac{|\{c \in C_{\text{all}} \mid c \in \text{WARM\_COLORS}\}|}{N_{\text{total}}}$$
- Achievement Rate (RAC):
  $$\text{RAC} = 1 - \text{RFC} = \frac{|\{c \in C_{\text{all}} \mid c \in \text{COOL\_COLORS}\}|}{N_{\text{total}}}$$

### 4. Dynamic CPD Engine
Color weight vector $W = (x_{\text{red}}, x_{\text{orange}}, x_{\text{yellow}}, x_{\text{green}}, x_{\text{blue}}, x_{\text{indigo}}, x_{\text{purple}}) \in [0, 1]^7$.
- Default linear weights: `[0, 1/6, 2/6, 3/6, 4/6, 5/6, 1.0]`.
- For each question attempt $a$ with Test Item metadata $(\text{CVR}_a, \text{CCI}_a)$:
  $$\text{Base CPD}_a = \text{CVR}_a \times \text{CCI}_a$$
  $$\text{Question CPD}_a = \frac{1}{|a.\text{recordedColors}|} \sum_{c \in a.\text{recordedColors}} (\text{Base CPD}_a \times W[c])$$
- Aggregated Learner/Session CPD:
  $$\text{Learner CPD} = \frac{1}{|\text{finalized}|} \sum_{a \in \text{finalized}} \text{Question CPD}_a$$

### 5. In-Memory SWR API Cache Layer
- Provide `createAppCache()` with key-based TTL, in-flight request deduplication, and stale-while-revalidate invalidation.
- Wrap Supabase sync queries (`getTeacherClasses`, `getLearnerRoster`, `getMetricSettings`, `getLearningSessions`) so navigating between tabs does not trigger full re-fetching or UI blanking.
