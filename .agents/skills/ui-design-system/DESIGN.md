# Supermemory Console

## Mission
Create implementation-ready, token-driven UI guidance for Supermemory Console that is optimized for consistency, accessibility, and fast delivery across dashboard web app.

## Brand
- Product/brand: Supermemory Console
- URL: https://console.supermemory.ai/graph
- Audience: authenticated users and operators
- Product surface: dashboard web app

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=Inter`, `font.family.stack=Inter, ui-sans-serif, system-ui, sans-serif`, `font.size.base=16px`, `font.weight.base=400`, `font.lineHeight.base=24px`
- Typography scale: `font.size.xs=12px`, `font.size.sm=14px`, `font.size.md=16px`
- Color palette: `color.text.primary=#0a0a0a`, `color.text.secondary=#525252`, `color.text.tertiary=#a3a3a3`, `color.surface.base=#000000`, `color.surface.muted=#ffffff`, `color.surface.raised=#faf9f4`, `color.surface.strong=#e8e5e0`, `color.border.default=#e3e0db`, `color.border.strong=#f0ede8`
- Spacing scale: `space.1=4px`, `space.2=8px`, `space.3=12px`, `space.4=16px`, `space.5=24px`
- Radius/shadow/motion tokens: `radius.xs=4px`, `radius.sm=6px`, `radius.md=9999px` | `shadow.1=rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` | `motion.duration.instant=150ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: buttons (18), links (15), inputs (7), navigation (1).


## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
