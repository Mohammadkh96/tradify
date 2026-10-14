# Proposed Tradify Brand System

**Status:** Review draft for the Tradify Journal development prototype and a handoff to the separate Signals project. This document does not authorize a production release or changes to Signals.

## 1. Brand architecture

- **Tradify** is the parent brand.
- **Tradify Journal** is the trading journal product. Preserve its existing dark surfaces, emerald accent, and recognizable mark.
- **Tradify Signals** is a separate product. Preserve its existing navy/gold/teal identity and assets.
- **Tradigo** is reserved for future integration and must not be shown as an available product.
- Shared branding does not imply shared authentication, customer data, payments, subscriptions, deployment, or release ownership.

## 2. Logo usage

- Use **Tradify** for the parent brand and add the product name as a clear descriptor when a specific product is being presented.
- On Journal marketing pages, keep the existing Journal mark and emerald treatment; the prototype uses a `Tradify` wordmark with a small `Journal` descriptor.
- On Signals pages, use the Signals project's existing logo and navy/gold/teal colors. Do not redraw, recolor, or replace its mark from this Journal project.
- Keep each product's mark intact and legible. Do not combine two product marks into a new lockup without approval.
- Do not change the domain, auth identity, or product naming as part of logo presentation.

## 3. Typography hierarchy

- Continue using the current system sans-serif stack; no font dependency is proposed.
- Use a clear hierarchy: large, bold page title; medium section headings; readable sentence-case body copy; small uppercase labels only for navigation, status, and metadata.
- As a starting scale, use page titles around 40–56 px on desktop and 30–36 px on mobile, section headings around 24–36 px, and body copy at 16 px or larger where space permits.
- Reserve extra-wide letter spacing and all-caps text for short labels; do not use it for long descriptions.
- Preserve the typography already established by each product rather than forcing identical heading treatments across both products.

## 4. Dark surfaces

The Journal development prototype uses these existing Journal-oriented reference values:

| Semantic token | Reference value | Use |
| --- | --- | --- |
| `--tradify-ink` | `#0A0F1E` | Main dark page background |
| `--tradify-surface` | `#111827` | Cards and raised surfaces |
| `--tradify-surface-muted` | `#0F172A` | Secondary panels |
| `--tradify-text` | `#F8FAFC` | Primary text |
| `--tradify-muted` | `#94A3B8` | Supporting text |
| `--tradify-border` | `#1F2937` | Dividers and card outlines |

These are references for Journal/shared neutral surfaces, not a replacement for the Signals project's existing navy tokens.

## 5. Semantic color roles

| Role | Journal | Signals |
| --- | --- | --- |
| Primary product accent | Existing emerald, reference `#10B981` | Existing gold; keep the Signals source value |
| Secondary product accent | Existing Journal neutrals | Existing teal; keep the Signals source value |
| Surface/background | Current Journal dark system | Current Signals navy system |
| Status and validation | Use semantic success, warning, error, and neutral states | Keep semantic states distinct from the product's gold/teal brand accents |

For the Journal-hosted development prototype only, the Signals card uses amber and teal utility-color families as visual references (amber-500 `#F59E0B`, teal-500 `#14B8A6`). Verify exact gold/teal values against the Signals audit or source before adopting them across products. **No cyan accent is proposed.**

Do not communicate a status by color alone. Pair each color with a text label or icon, and check contrast on the actual surface.

## 6. Buttons and interaction states

- Keep primary actions product-specific: Journal actions retain the emerald style; Signals actions retain the Signals project's existing style.
- Use outline or quiet-surface styling for secondary actions.
- Include clear hover, keyboard-focus, pressed, loading, and disabled states.
- If no Signals destination is ready, show a noninteractive **Launch Pending** or **Coming Soon** status; do not present it as an active link or checkout.
- Do not add bundle checkout, subscription entitlements, or new promotional popups in this prototype.

## 7. Navigation

- Add a **Products** menu to Journal marketing navigation with **Tradify Journal** and **Tradify Signals**.
- The Journal item keeps the current Journal destinations. The Signals item goes only to the local product description/status until its public destination is confirmed ready.
- Do not link customers to `signals.tradifyapp.com` while it displays the Expo Go preview.
- Keep login/signup routes and their existing header treatment unchanged. Keep authenticated navigation and dashboards product-local.
- Do not list Tradigo as an available product.

## 8. Product cards

- Show the product name, a concise description, product-specific accent, availability state, and an appropriate action or explicit pending state.
- Journal's card uses its emerald identity and existing signup/features destinations.
- Signals' card uses a navy/dark surface with gold and teal accents and a visible launch-pending state.
- Keep card spacing, border treatment, and typography consistent with the Journal site without copying the Signals product UI into this repository.
- The pricing overview is informational: retain the existing Journal Free/Pro/Elite/Coach grid and checkout. Show Signals-only and Tradify Complete as unavailable/proposal states, with no invented prices or purchase controls.

## 9. Responsive behavior

- Stack product and pricing cards in one column on narrow screens; expand to two or three columns only when there is room.
- Keep the existing mobile navigation pattern, with a keyboard-accessible Products disclosure and a scrollable menu when it exceeds the viewport.
- Preserve existing page content and login/signup entry points; do not add modal or popup promotion.
- Verify the product section, navigation, and pricing overview at both mobile and desktop widths.

## 10. Accessibility

- Meet WCAG 2.2 AA contrast targets where applicable: 4.5:1 for normal text and 3:1 for large text and meaningful UI graphics.
- Keep all navigation and controls operable by keyboard, expose expanded/collapsed state, and provide a visible focus indicator.
- Use semantic headings, links, buttons, and status text. Do not use a disabled button as a substitute for a real destination.
- Keep touch targets comfortably sized, preserve text zoom/reflow, and respect reduced-motion preferences.
- Ensure status meaning is conveyed in text, not color alone.

## 11. Translation and ownership boundaries

- Use the existing i18next `common` namespace and `en` fallback for new Journal prototype copy. Keep product names consistent in all locales.
- Signals owns its brand assets, exact color values, UI, data, authentication, billing, and release decisions. This Journal repository may present a safe product status, but must not change the Signals project.
- Share this proposal with the Signals Agent for review. Resolve exact Signals asset/color values against its separate audit/source before adopting any shared token there.
- Preserve the existing Journal production database, payment flows, MT5 functionality, and background-job boundaries. Do not publish or change DNS without the user's separate approval.
