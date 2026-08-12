# SagotKa — Design System

Locked via the Hallmark design process. This file is the source of truth for
SagotKa's visual identity. New pages/components must reference these tokens —
never inline raw colours or ad-hoc fonts.

## Genre & theme

- **Genre:** modern-minimal (Stripe-not-Linear register). Confident sans, warm-grey
  paper, generous whitespace, pill CTAs, monochrome-with-single-accent.
- **Theme:** Coral. Warm-grey paper, one restrained coral accent used as a *mark,
  not a flood*. Geist-class display + body (single-family). Geist Mono for labels,
  IDs, and mono accents.
- **Aesthetic stance:** composed, not kinetic. Motion is 150–200 ms, no bounce.
  No glassmorphism, no gradient text, no re-drawn browser chrome, no italic headers.

## Tokens

Defined once in `web/src/styles/tokens.css` under `:root` (light) and `.dark`
(dark). All utilities reference the tokens by name.

| Token | Light | Dark |
| --- | --- | --- |
| `--paper` | oklch(96.5% 0.005 50) | oklch(18% 0.01 50) |
| `--paper-2` | oklch(94% 0.006 50) | oklch(22% 0.01 50) |
| `--paper-3` | oklch(91% 0.008 50) | oklch(27% 0.012 50) |
| `--rule` | oklch(86% 0.008 50) | oklch(32% 0.012 50) |
| `--rule-2` | oklch(72% 0.01 50) | oklch(45% 0.012 50) |
| `--muted` | oklch(52% 0.012 50) | oklch(68% 0.012 50) |
| `--neutral` | oklch(38% 0.012 45) | oklch(78% 0.012 45) |
| `--ink-2` | oklch(26% 0.012 40) | oklch(88% 0.012 40) |
| `--ink` | oklch(20% 0.01 35) | oklch(94% 0.01 35) |
| `--accent` | oklch(64% 0.165 28) | oklch(70% 0.15 28) |
| `--accent-2` | oklch(58% 0.15 28) | oklch(76% 0.14 28) |
| `--accent-3` | oklch(90% 0.055 40) | oklch(28% 0.05 35) |
| `--accent-ink` | oklch(98% 0.005 50) | oklch(15% 0.02 50) |
| `--danger` | oklch(52% 0.2 25) | oklch(66% 0.18 25) |
| `--success` | oklch(48% 0.14 150) | oklch(66% 0.14 150) |
| `--focus` | = accent | = accent |

**Fonts:** `--font-body`/`--font-display` = `ui-sans-serif, system-ui, -apple-system,
"Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif`;
`--font-label`/`--font-mono` = `ui-monospace, "SF Mono", SFMono-Regular, Menlo,
Consolas, monospace`. Display weight 600, tracking `-0.025em` for large headings.

**Radii:** card 8px · input 6px · pill 999px.

## Voice

Warm, declarative, specific. Copy names concrete things ("Ask. Collect. Answer.")
and never fabricates metrics. Primary actions are coral pills with `--accent-ink`
text; secondary actions are outline/ghost on paper.

## Interaction states

Every interactive element ships: default · hover · focus-visible (2px accent ring,
offset) · active · disabled · loading · error · success.

## Page structures

- **Dashboard** — index-first card grid: title-led cards, mono date + response
  counts, open/closed badge, search.
- **Editor** — workbench register: functional not flashy. Question stack with drag
  reorder, add-field rail, per-field panels, top bar with autosave + publish.
  Live preview split.
- **Fill** — chrome-free single column, warm paper card, progress rail, per-question
  validation, success screen with confirmation + edit link.
- **Responses** — summary with animated coral bars + tabular response list.

## Motion

Autosave pulse, focus transitions, card hover lift (translateY −1px), animated
summary bars. All 150–200 ms `cubic-bezier(0.2, 0.8, 0.2, 1)`, honour
`prefers-reduced-motion`.

## Responsive floor

Verified at 320 / 375 / 414 / 768 px. No horizontal scroll; `overflow-x: clip` on
html/body. Section heads collapse to one column. No two-line clickable text.
