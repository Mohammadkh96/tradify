# Tradify Signals brand compatibility handoff

**Scope:** Tradify Signals only  
**Status:** Signals' navy/gold/teal palette remains its product identity. The Journal project has supplied a parent-brand proposal and coordination handoff; only parent/product naming and separation boundaries are approved for coordination. Proposed values and Signals-specific UI changes are not implementation approvals.

## Current Signals identity

Signals currently uses a dark navy, gold, and teal identity with a `tradify / signals` lockup and chart-inspired mark. The color source and current web entry screen agree on navy surfaces and gold accents. The system is product-specific and must not be treated as the final parent Tradify palette.

| Token area | Current Signals values |
| --- | --- |
| Base surfaces | Background `#191F29`; surface `#1F2732`; raised/muted `#28313E` |
| Foreground and borders | Text `#EEEAE2`; muted text `#9DA4AF`; border `#36404E`; input `#28313E` |
| Brand accents | Gold `#EBB22D`; teal `#55B490`; secondary foreground `#CAE7DC` |
| Functional states | Error `#EB7369`; warning `#E4B16E`; reference `#8C9BB0` |
| Typography | Inter with regular, medium, semibold, bold and strong weights |
| Spacing | Platform-neutral scale: 1px hairline, 2/4/6px compact steps, 8/10/12/14/16px content steps, 18px screen inset, 22px shell spacing, and 24px spacious step |
| Radii | 8px card, 12px control, 14px input, 15px button, 24px shell, 28px sheet; pill radius for status badges |
| Controls | 44px minimum touch target; 48px control/input height; 52px primary button height |
| Appearance | Customer app is dark-only today; both system appearance settings resolve to the same palette |

Spacing and radius values are platform-neutral app tokens; the same numeric value may be applied through different native and web layout primitives.

## Product-specific behavior that shared branding must not override

- LIVE, REFERENCE, STALE, and UNAVAILABLE states use explicit text, icon, and line/border treatments as well as semantic colors. Brand colors must not make fallback or stale data appear live.
- Long/short trade direction, entry/target context, risk, and feed authority have distinct chart semantics. A shared accent color must not collapse those distinctions.
- The existing customer app remains dark-only unless separately approved. A parent-brand palette comparison does not itself authorize light-mode work.
- Preserve the existing app icon, Signals product name, Expo/PWA presentation, mobile navigation, and staff-only Admin boundary until the parent specification is reviewed.
- Do not change membership, RevenueCat, session, API, MT5, notification, or strategy behavior as part of brand alignment.

## Current documentation mismatch and evidence

- `constants/colors.ts` is the current palette source; `useColors.ts` consumes it for both appearance settings.
- The former rollout note and saved captures described a forest/lime palette. They are now marked as historical because they do not match the running web entry screen verified on 2026-10-14.
- The verification captured the unauthenticated Expo web sign-in screen only. Authenticated Profile/Settings and native iOS/Android appearance remain unverified.
- No design-system artifact is registered in this workspace. The supplied review draft and coordination handoff do not include a canonical parent logo asset or final, Signals-approved shared token package.

## Journal handoff received and reconciled

The supplied `Proposed Tradify Brand System` is labeled a review draft. Its companion `Tradify Journal → Tradify Signals Brand Handoff` is a coordination draft: it approves the parent/product direction for coordination, while values labeled Proposed or Not specified are not approved Signals implementation requirements.

| Element | Reconciliation for Signals |
| --- | --- |
| Parent/product identity | Use Tradify as the parent name and Signals as the clear product descriptor. The prototype header already follows the existing Signals product-local lockup; preserve its mark and spelling. Do not create a combined Journal + Signals mark. |
| Signals colors and assets | Preserve the current Signals navy/gold/teal values and assets. Do not apply Journal emerald, proposed Journal/shared neutral HEX values, or prototype amber/teal references to Signals. No cyan accent is proposed. |
| Typography | Preserve Signals' established Inter typography and hierarchy; no new font dependency or shared heading scale is approved. |
| Spacing and controls | Keep the existing Signals spacing, radii, and touch-target conventions. The parent proposal does not define a shared numeric scale. |
| Product status and navigation | Keep the Journal row informational and noninteractive until its public destination is verified customer-ready. Show pending status in text, not color alone; retain separate-application and separate-sign-in wording. |
| Authentication and ownership | Keep Journal and Signals accounts, sessions, data, billing, subscriptions, deployment, and release decisions product-local. Tradigo is not shown as available. |
| Responsive and native behavior | Keep the Signals mobile navigation and responsive structure. The Journal handoff defines no new breakpoints, React Native components, or Expo architecture. |

### Isolated Profile prototype update

The original Profile prototype is retained as the before reference. The handoff preview preserves the Signals mark, palette, Inter styling, layout scale, and five-item navigation. It uses the shared parent/product naming direction, describes Journal as a separate trading-journal application, removes the external-link glyph from its noninteractive row, keeps the separate-sign-in statement, and displays `Destination pending confirmation`.

This is a web-only mockup update. No Expo/native source, customer route, login flow, brand token, or live product behavior changed. The visual treatment was inspected at 320px, 402px, and 768px widths; the canvas shows 402px and 768px previews. The proposed changes are product-label casing and copy plus removal of a decorative external-link glyph, so they map to existing React Native `Text`/`View` patterns without new platform dependencies. The preview's CSS safe-area, viewport, and reduced-motion rules are web-only and must not be copied into native code. Existing Signals `TradifyBrand`, `brandPalette`, Inter setup, navigation, and controls remain the native source of truth; physical iOS/Android rendering was not retested because no native source changed.

### Status of supplied values

- The Journal references `#0A0F1E`, `#111827`, `#0F172A`, `#F8FAFC`, `#94A3B8`, and `#1F2937` are not replacements for Signals' existing surface/text/border tokens.
- Journal emerald `#10B981` remains Journal-specific.
- Prototype amber `#F59E0B` and teal `#14B8A6` are not Signals' canonical gold/teal. Signals remains `#EBB22D` gold and `#55B490` teal.
- The handoff's suggested labels “Sign in to Tradify Journal” and “Sign in to Tradify Signals” remain proposed. This prototype preserves the already-approved separate-sign-in message without changing either app's auth routes.
- The public Journal destination remains unverified. No clickable link is approved in the prototype or production app.

## Remaining confirmations before broader adoption

The supplied handoff is sufficient for this isolated prototype reconciliation. Before broader cross-product or production changes:

1. Obtain the canonical approved parent-brand specification and any parent/logo assets before proposing a new Signals lockup. Keep the existing Signals mark until separately approved.
2. Record explicit Signals-owner approval before adopting any shared colors, typography packages, fixed spacing scales, or product-specific UI treatments beyond the coordination direction listed above.
3. Verify the public Journal destination is customer-ready before enabling any customer-facing link. The previously supplied `https://tradifyapp.com` could not be verified as reachable from this environment; keep it disabled until verified.

## Future implementation boundary

The current work changes only the isolated mockup and this report. Any later production implementation requires separate approval, a reviewed token mapping, PWA and native-device regression checks, and a verified Journal URL. Journal source, deployments, databases, DNS, credentials, and billing remain outside this repository and unchanged.
