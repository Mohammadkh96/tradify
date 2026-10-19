---
name: Development HTTPS origin checks
description: Observed CSRF/origin validation behavior for Journal account-linking POSTs through the isolated Replit HTTPS origin.
---

An authenticated session and successful CSRF-token fetch do not by themselves prove a browser mutation will pass same-origin validation through the Replit HTTPS proxy. The isolated Journal authorization POST returned the generic `CSRF_ORIGIN_FAILED` response despite sending the public HTTPS origin and fetched session token; no authorization was created. The error intentionally does not distinguish origin mismatch from token mismatch.

**Why:** Retrying with alternate origins or weakening the guard could turn a proxy diagnosis into a CSRF bypass.

**How to apply:** Verify with the normal same-origin browser flow or inspect trusted proxy protocol/host handling without logging cookies or tokens. Do not guess an alternate `Origin`, disable CSRF, or claim an authorization was created unless the route returns success and the disposable database confirms it.
