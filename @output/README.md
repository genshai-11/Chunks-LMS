# Chunks LMS • eCommerce Mini Test Suite (7x3 Architecture)

Generated from **Improv Set 05: E-commerce & Retail (Market Dynamics & Shopping Reflex)**.

---

## 1. Mini Test Architecture (7 Sessions × 3 Questions = 21 Questions)

Both Green and Red tests follow the high-efficiency **7x3 mini test structure**:
- **7 sessions per test package**
- **3 questions per session**
- **Total: 21 questions**
- Structured across 3 pedagogical parts:
  - **Part 1:** Sessions 1–2 (Foundation & core consumer reaction)
  - **Part 2:** Sessions 3–4 (Compound logic & retail chain connectors)
  - **Part 3:** Sessions 5–7 (Advanced metaphors, high cognitive resistance & peak fluency)

---

## 2. Mathematical & Physics Model

| Metric | Symbol | Unit | Definition | Green Test Value | Red Test Value |
|---|---|---|---|---|---|
| **Term Complexity** | $TC$ | Count | Number of chunks / semantic elements | $1$ (sentence core) | $2 - 4$ hints |
| **Lexical Complexity** | $LC$ | Factor | Domain lexical density & syllable clash | $1.0$ (standard) | $1.15$ (compound eCommerce) |
| **Time Latency** | $TL$ | Factor | Pacing & cognitive hesitation allowance | $1.0$ (continuous) | $2.0 - 3.0$ (with 650ms pauses) |
| **Cognitive Voltage Resistance** | $CVR$ | $\Omega$ | $CVR = TC \times LC \times TL$ | $2.0 - 6.0\ \Omega$ | $4.6 - 13.8\ \Omega$ |
| **Cognitive Current Index** | $CCI$ | $\text{A}$ | Cognitive processing rate | $2\text{A} - 6\text{A}$ | $4\text{A} - 12\text{A}$ |
| **Cognitive Power Dissipation** | $CPD$ | $\text{V}$ | $CPD = CVR \times CCI$ | **$12\text{V}$** (Focus Target) | **$56\text{V}$** (Awareness Target) |

---

## 3. Package Inventory & Comparison

| Package Code | Test Type | CPD Target | Hint Count Progression | CVR Curve ($\Omega$) | CCI Curve (A) | Session Languages |
|---|---|---|---|---|---|---|
| **`G01-21Q-Ecommerce-1`** | GREEN (Focus) | 12V | Single complete sentence | `[2.0, 2.0, 3.0, 3.0, 4.0, 4.0, 6.0]` | `[6, 6, 4, 4, 3, 3, 2]` | EN-EN-EN-VI-VI-VI-EN |
| **`G02-21Q-Ecommerce-2`** | GREEN (Focus) | 12V | Single complete sentence | `[2.0, 2.0, 3.0, 3.0, 4.0, 4.0, 6.0]` | `[6, 6, 4, 4, 3, 3, 2]` | EN-EN-EN-VI-VI-VI-EN |
| **`R01-21Q-Ecommerce-56V-1`** | RED (Awareness) | 56V | `[2, 3, 4, 2, 3, 4, 4]` | `[4.6, 7.6, 10.6, 5.8, 9.3, 12.9, 13.8]` | `[12, 7, 5, 10, 6, 4, 4]` | VI-VI-VI-EN-EN-EN-EN |
| **`R02-21Q-Ecommerce-56V-2`** | RED (Awareness) | 56V | `[2, 3, 4, 2, 3, 4, 4]` | `[4.6, 7.6, 10.6, 5.8, 9.3, 12.9, 13.8]` | `[12, 7, 5, 10, 6, 4, 4]` | VI-VI-VI-EN-EN-EN-EN |

---

## 4. Per-Session TTS Audio Configuration & Neural2 Voices

### Green Test Preset: `['en', 'en', 'en', 'vi', 'vi', 'vi', 'en']`
- **Sessions 1–3 (Part 1 + S3):** English (`en-US-Neural2-F`)
- **Sessions 4–6 (Part 2 + S6):** Vietnamese (`vi-VN-Neural2-A`)
- **Session 7 (Part 3 Peak):** English (`en-US-Neural2-F`)

### Red Test Preset: `['vi', 'vi', 'vi', 'en', 'en', 'en', 'en']`
- **Sessions 1–3 (Part 1 + S3):** Vietnamese (`vi-VN-Neural2-A`)
- **Sessions 4–7 (Part 2 & Part 3):** English (`en-US-Neural2-F`)

### SSML Semantic Gap Specification (Red Tests)
Every Red test question injects exact 650ms semantic pauses between hints to measure learner cognitive recovery:
```xml
<speak><s>Ngành thương mại điện tử</s> <break time="650ms"/> <s>cạnh tranh khốc liệt</s></speak>
```
All SSML requests automatically route to Google Cloud **Neural2** voices to ensure natural prosody across pauses.

---

## 5. Verification Checklist

- [x] Exactly 21 questions per package (7 sessions × 3 items).
- [x] Red tests follow exact hint sequence: `[2, 3, 4, 2, 3, 4, 4]`.
- [x] Green tests maintain $TL=1.0$ continuous complete sentence structure with 12V CPD target.
- [x] Red tests compute $CVR = TC \times LC \times TL$ ($LC=1.15$, $TL \in [2.0, 3.0]$) with 56V CPD target.
- [x] Audio Studio supports language presets and per-session voice toggle.
