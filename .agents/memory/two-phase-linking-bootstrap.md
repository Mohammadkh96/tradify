---
name: Two-phase account-linking test bootstrap
description: Safety constraints for coordinated Journal/Signals development trust sessions.
---

For isolated Journal/Signals tests, each service generates its own fresh RSA signing key in an in-memory supervisor and retains it there through the key exchange. Exchange only public keys, immutable kids, issuer/audience, and expiry before either account-linking API starts. Pin the peer key through a local-only control channel; never expose a network endpoint that accepts trusted keys. Each valid session keeps its original expiry; both services stop at the earlier of the two expirations. Use a disposable loopback database with production/Neon URL overrides removed.

**Why:** The project owner required this bootstrap to avoid invalidating active test signers and to prevent arbitrary callers from injecting trusted public keys.

**How to apply:** For every coordinated development session, hold Phase A signers in the same process that will start Phase B, validate both expirations and contract identity, enforce the minimum expiry on each service, and wait for both services to confirm readiness before sending cross-service requests.
