---
name: Authenticated browser validation
description: Prevent false blank screenshots and misleading failures in authenticated Chromium checks.
---

For authenticated browser checks, wait for a route-specific visible element after sign-in; document readiness or root-container size does not prove that the page has rendered. Coerce CDP readiness expressions to booleans. Exclude long-lived event streams from network-idle checks, and verify mutations with both their HTTP response and the resulting UI/API state before closing the browser.

**Why:** A slow authenticated route can look blank when captured too early, while expected auth/empty-state responses and a browser teardown cancellation can be mistaken for application defects. Custom React Native Web checkboxes may expose `role="checkbox"` without a native `.checked` property, causing false negatives if tested like HTML inputs.

**How to apply:** Use this for signed-in screenshots and CRUD flows. Classify anonymous 401s and intentional empty-state 404s separately from unexpected errors; confirm server status and persisted state when browser tooling reports an abort. For custom checkbox widgets, inspect accessible state or the enabled submit control and verify the resulting server response instead of relying on `.checked`.
