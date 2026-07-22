# Ubiquitous Language

## Session and capture modes

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Live Observation Session** | The current live mode where a Teacher creates measurement opportunities on the fly and records finalized observation results. | Live mode, lesson mode when used ambiguously |
| **Live Test Session** | A test-focused extension of live capture where a Teacher selects a predefined Test Resource and the system drives fixed Test Items, prompts, audio, and test-specific analysis. | Test mode, resource mode, content mode |
| **Session Kind** | The purpose label on a Learning Session: `regular`, `pretest`, or `posttest`. | Mode, label when it implies behavior |
| **Capture Mode** | The UI navigation style over the same Assessment Attempts, currently question-first or learner-first. | Session mode |
| **Session Label** | The reporting/category label distinguishing a Lesson from a Test for filtering and charts. | Session kind if it is not one of regular/pretest/posttest |

## Test resources

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Test Resource** | A predefined live-test package containing a test name, ordered session blocks, ordered test items, optional audio prompts, and target complexity metadata. | Resource library, lesson content |
| **Test Session Block** | One ordered block inside a Test Resource, e.g. Session 1 through Session 8, each containing ten Test Items. | Learning Session, class session |
| **Test Item** | One ordered bilingual complete-sentence prompt in a Test Section with source identity and approved narration references. | Session Question, resource, sentence |
| **Standalone Test Assignment** | One active Learner assigned directly to a published Test Package Version without a Class or Enrollment. | Class test, hidden enrollment |
| **Standalone Test Run** | One Learner's attempt at one Test Section with frozen measurement, language, voice, audio, items, and immutable result history. | Live Test Session, Learning Session |
| **Prompt Language** | The live-test setting that chooses whether item audio/display uses the Vietnamese complete sentence or the English complete sentence. | UI language, translation mode |
| **Audio Prompt** | A stored or generated audio asset played at the beginning of each Test Session Block and/or for each Test Item in the selected Prompt Language. | Reaction audio, color audio |
| **External Reference** | The stable reference linking a Session Question to its originating Test Item without making the Session Question itself content-owned. | Question ID if it implies global assessment identity |

## Assessment and metrics

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Session Question** | An ordered measurement opportunity inside a Learning Session, optionally linked to an External Reference. | Test Item, sentence, resource |
| **Assessment Attempt** | One Teacher observation for one Learner and one Session Question. | Response, answer |
| **Final Result** | The effective finalized color result eligible for progress metrics. | Score, grade |
| **RFC** | The share of finalized Assessment Attempts ending Red or Yellow in a Report Window. | Failure score |
| **RAC** | The share of finalized Assessment Attempts ending Green or Purple in a Report Window. | Success score |
| **CVR** | Semantic Complexity Value Rating for Vietnamese text: Estimated TC × LC × TL. | Generic difficulty |
| **CCI** | The named current/intensity value for a Test Section, sourced from workbook `CCI.Ampe (A)` with CCI ID and Name, and used with session CVR to derive CPD. | CVR, ad-hoc complexity |
| **CPD** | The derived Test Section demand value calculated as session CVR × CCI Ampe. | Manually entered score |

## Relationships

- A **Standalone Test Run** is not a **Learning Session** and never creates a Class or Enrollment.
- Legacy **Live Test Session** history remains separate and is not the runtime model for new standalone tests.
- A **Test Resource** contains exactly eight **Test Session Blocks** for the requested first version.
- Each **Test Session Block** contains exactly ten ordered **Test Items** for the requested first version.
- A **Test Item** may produce a **Session Question** by storing the Test Item ID as the **External Reference**.
- A **Live Test Session** has one selected **Prompt Language**: Vietnamese uses `Complete Sentence (Vie)`, English uses `Complete Sentence (Eng)`.
- Only **Final Results** feed **RFC**, **RAC**, and observation-result reporting metrics.
- **CVR**, **CCI**, and **CPD** belong to test-item/resource metadata and can be joined to observation results for analysis.
- **CPD** is derived, not entered: **CPD = CVR × CCI**.

## Example dialogue

> **Dev:** “When a Teacher starts a **Live Test Session**, do we create a separate capture engine?”
>
> **Domain expert:** “No. Reuse the live capture lifecycle. The difference is that the Teacher selects a **Test Resource**, then the system drives ordered **Test Items** and **Audio Prompts**.”
>
> **Dev:** “So a **Test Item** becomes a **Session Question**?”
>
> **Domain expert:** “It links to one through an **External Reference**. The **Session Question** remains the measurement opportunity; the **Test Item** is the prompt content.”
>
> **Dev:** “Can we calculate **CPD** now?”
>
> **Domain expert:** “Yes. Seed **CCI** from the resource data, store **CVR** from the generated sentence measurement, then derive **CPD = CVR × CCI**.”

## Flagged ambiguities

- “mode” is overloaded: use **Session Kind** for `regular/pretest/posttest`, **Capture Mode** for question-first/learner-first UI, and **Live Test Session** for the test-driven extension.
- “resource” is risky because the existing domain intentionally keeps **Session Questions** resource-agnostic; use **Test Resource** only for live-test prompt packages.
- **CCI** uses the canonical workbook `CCI` sheet: `Ampe (A)` is the numeric value and `CCI Name` is retained; legacy `Unit (Ohm)` mapping must not be reused.
- **CPD** is now defined as `CVR × CCI`; decide display precision and whether to store it as a generated DB column or compute it in views.
- **CVR** is defined in [chunks-resourcce/cvr-formula-and-generation-guide.md](chunks-resourcce/cvr-formula-and-generation-guide.md); missing CVR rows for Sessions 5–8 need generation before complete seed/import.
- **Prompt Language** is separate from app locale: live-test can speak Vietnamese or English while keeping the same Test Item identity and metrics.
