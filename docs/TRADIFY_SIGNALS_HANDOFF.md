# Tradify Journal → Tradify Signals Brand Handoff

**Status:** Coordination draft for the separate Tradify Signals project. Based on [`TRADIFY_BRAND_SYSTEM.md`](TRADIFY_BRAND_SYSTEM.md). The parent/product direction is approved for coordination; values labeled **Proposed** or **Not specified** are not approved as Signals implementation requirements. This handoff does not authorize changes to Signals code, assets, authentication, billing, data, or release state.

## 1. Shared identity and product boundaries

- **Tradify** is the parent brand.
- **Tradify Journal** is the trading-journal product. Preserve its existing dark surfaces, emerald accent, and mark.
- **Tradify Signals** is an independent algorithmic-signals product. Preserve its existing navy/gold/teal identity and existing assets.
- **Tradigo** is reserved for possible future integration. Do not present it as available.
- Shared parent branding does not imply shared login, customer data, subscriptions, payments, deployment, or product ownership. Keep Journal and Signals product-local.
- The Journal prototype's Signals state is **Launch Pending**. It is a noninteractive status, not a product destination, sign-up, or checkout.

## 2. Logo and asset guidance

### Coordination-approved direction

- Use **Tradify** as the parent name and identify a specific product with its product name.
- Keep the Journal and Signals marks intact, legible, and separate.
- Keep using the current Journal public-navigation mark/wordmark for Journal. The prototype's `Tradify` wordmark plus `Journal` descriptor is a Journal-side presentation, not a replacement Signals logo.
- On Signals pages, use the Signals project's own existing logo and assets. Do not redraw, recolor, replace, or copy them from the Journal project.
- No combined Journal + Signals lockup has been approved.

### Asset references

- Parent specification: `docs/TRADIFY_BRAND_SYSTEM.md` in the Journal project.
- Journal mark reference: the existing Journal public navigation in `client/src/components/PublicNavbar.tsx`; this is a source reference, not a new shared asset.
- Journal prototype reference image: `generated-artifacts/tradify-phase1/product-showcase.jpg`. It illustrates the two-product presentation only; it is not a Signals logo or approved production artwork.
- Signals logo, icons, and other visual assets remain owned by the Signals project. No Signals asset file is included in this handoff.
- A new parent logo, combined lockup, or replacement product mark would require separate approval.

## 3. Color references and semantic tokens

The values below are copied from the parent brand-system proposal. Their scope matters: the Journal/shared neutral values are references, not an instruction to replace Signals' existing navy palette.

| Token / role | Exact HEX | Intended use in the source proposal | Status for Signals |
| --- | --- | --- | --- |
| `--tradify-ink` | `#0A0F1E` | Journal main dark background | Proposed Journal/shared neutral reference; do not replace Signals navy |
| `--tradify-surface` | `#111827` | Journal cards and raised surfaces | Proposed Journal/shared neutral reference; Signals surface unchanged |
| `--tradify-surface-muted` | `#0F172A` | Journal secondary panels | Proposed Journal/shared neutral reference; Signals surface unchanged |
| `--tradify-text` | `#F8FAFC` | Journal primary text | Proposed Journal/shared neutral reference |
| `--tradify-muted` | `#94A3B8` | Journal supporting text | Proposed Journal/shared neutral reference |
| `--tradify-border` | `#1F2937` | Journal dividers and card outlines | Proposed Journal/shared neutral reference |
| Journal emerald accent | `#10B981` | Journal primary product accent | Existing Journal reference; do not apply it as a Signals accent |
| Prototype amber reference (`amber-500`) | `#F59E0B` | Signals card in the Journal-hosted prototype | Prototype-only reference; **not** a confirmed Signals gold value |
| Prototype teal reference (`teal-500`) | `#14B8A6` | Signals card in the Journal-hosted prototype | Prototype-only reference; **not** a confirmed Signals teal value |

### Signals canonical values: not supplied here

- Preserve the Signals project's current **navy, gold, and teal** values.
- The Journal source specification and handoff do not identify the canonical Signals HEX values. Do not treat `#F59E0B` or `#14B8A6` as those values. Read the Signals project's current theme/assets or its own approved brand source before documenting or changing them.
- The source proposal specifies semantic roles—success, warning, error, and neutral—but does not assign HEX values to those states. Keep status colors distinguishable from product brand accents; do not invent a shared status palette.
- **No cyan accent is proposed.**
- Do not communicate a status by color alone; pair it with a text label or icon and check contrast against the actual product surface.

## 4. Typography

- The parent proposal calls for each product to retain its current system sans-serif stack; it does not name a font family or propose a new font dependency.
- Suggested hierarchy: large, bold page title; medium section headings; readable sentence-case body copy; small uppercase labels only for navigation, status, and metadata.
- Reference sizes: page titles around 40–56 px desktop and 30–36 px mobile; section headings around 24–36 px; body text at 16 px or larger where space permits.
- Keep all-caps and wide letter spacing for short labels, not long copy.
- Treat these sizes as proposed starting references, not a requirement to replace Signals typography.

## 5. Spacing, buttons, cards, and navigation

### Spacing

- The parent proposal does not define a numeric spacing scale or shared spacing tokens.
- Preserve each product's established spacing. Keep card rhythm and alignment coherent when presenting products together, but do not introduce a new global spacing scale without approval.

### Buttons and states

- Keep primary actions product-specific: Journal retains emerald styling; Signals retains its current Signals styling.
- Use outline or quiet-surface treatment for secondary actions.
- Provide clear hover, keyboard-focus, pressed, loading, and disabled states as appropriate to the platform.
- A pending product must be represented by noninteractive status text, not a fake or disabled destination button.
- Do not add bundle checkout, subscription entitlements, or promotional popups as part of this brand handoff.

### Product cards

- Include a product name, concise description, product-specific accent, availability state, and a valid action or explicit pending status.
- Journal may use its current emerald identity and existing Journal destinations.
- Signals should retain its existing navy surface and gold/teal identity; its public web destination remains pending until confirmed ready.
- Keep the Journal-hosted pricing overview informational. Do not invent Signals pricing or enable a Journal + Signals purchase.

### Cross-product navigation

- The Journal marketing-site Products menu may identify **Tradify Journal** and **Tradify Signals**.
- Journal links retain Journal destinations.
- Until the Signals public web destination is confirmed ready, link only to a safe local description/status; do not send customers to `signals.tradifyapp.com` while it displays Expo Go.
- Do not list Tradigo as an available product.

## 6. Responsive web and mobile behavior

- Stack product and pricing cards in one column on narrow screens; use two or three columns only when the available width supports them.
- Keep the mobile Products disclosure keyboard-accessible and scrollable if it exceeds the viewport.
- Preserve each product's established navigation and page structure. Do not add modal or popup promotion.
- Verify the product section, navigation, and pricing presentation at desktop and mobile widths before adoption.
- These are layout behaviors, not new fixed breakpoints; no breakpoint values are specified by the source proposal.

## 7. Expo / React Native compatibility considerations

The source specification is web-oriented and does not prescribe an Expo or React Native implementation. The following are handoff considerations, not new approved Signals architecture or design tokens:

- Treat the HEX values above as reference data only. If an approved value is adopted, represent it through the Signals project's existing theme mechanism rather than assuming Journal CSS custom properties or web classes can be reused directly.
- Preserve the existing Expo/React Native navigation, component library, font setup, and product styling unless the Signals owner separately approves a change.
- Map interaction states to platform-appropriate behavior: web hover/focus and mobile pressed/focused states should remain understandable and accessible.
- Test narrow phone layouts and larger screens using the Signals app's existing supported device targets. This handoff does not define new breakpoints, screen sizes, navigation libraries, or native components.
- The Journal project has not modified or tested the Signals app.

## 8. Separate-login wording

- Keep authentication product-local. Do not imply one Tradify account, shared session, or single sign-on between Journal and Signals.
- **Proposed labels, pending Signals copy approval:** “Sign in to Tradify Journal” and “Sign in to Tradify Signals.”
- Link each label only to that product's verified existing login destination. This handoff does not establish or change either route, domain, auth provider, or login flow.
- Keep Journal login/signup routes and their existing header treatment unchanged.

## 9. Accessibility requirements

- Target WCAG 2.2 AA contrast where applicable: at least 4.5:1 for normal text and 3:1 for large text and meaningful UI graphics.
- Ensure navigation and controls work by keyboard and expose a visible focus indicator.
- Expose expanded/collapsed state for disclosure menus.
- Use semantic headings, links, buttons, and status text. Do not use a disabled button as a substitute for a destination.
- Keep touch targets comfortably sized, support text zoom/reflow, and respect reduced-motion preferences.
- Convey status meaning in text, not by color alone.
- Recheck contrast with Signals' actual navy/gold/teal values and actual surfaces before adopting any prototype reference.

## 10. Decision register

### Approved for coordination; not production authorization

- Tradify is the parent brand.
- Journal keeps its dark/emerald identity.
- Signals keeps its existing navy/gold/teal identity and assets.
- Tradigo remains reserved and unavailable.
- No cyan brand accent is proposed.
- Signals is shown as Launch Pending while its public web destination is unfinished.
- Product identity does not merge authentication, data, billing, subscriptions, deployment, or release ownership.

### Proposed or awaiting product-owner approval

- The Journal/shared neutral HEX values in Section 3 are references, not global Signals tokens.
- The prototype amber/teal references are not confirmed Signals gold/teal values.
- Any shared tokens beyond the parent/product naming and the values explicitly documented above.
- Any new shared logo, combined lockup, typography package, fixed spacing scale, or Signals-specific UI changes.
- The proposed separate-login labels and any destination links.
- Any adoption of the prototype colors or card/navigation treatment inside the Signals application.

## 11. Ownership and release boundaries

- Signals owns its brand assets, canonical color values, UI, data, authentication, billing, and release decisions.
- Journal may describe Signals with a safe pending state; it must not change the Signals project.
- Do not publish, modify DNS, change production databases, or enable background jobs as part of this documentation handoff.
- Resolve any proposed Signals values against the Signals project's own approved source before implementation.
