---
name: Revocation retry protocol
description: Signals/Journal development contract requirements for durable revocation delivery and the acceptance gate.
---

Every logical revocation keeps one permanent event ID and one immutable payload canonicalized with RFC 8785 JCS. Persist its SHA-256 payload hash in the outbox and inbox. Each delivery attempt uses a fresh RS256 assertion with a unique `jti` and 120-second validity. Idempotency is keyed by event ID plus payload hash, not JWT `jti` or signature. A changed payload under an existing event ID returns 409 and creates a security audit record. Acknowledgements must match the event ID and payload hash; the local link stays unusable and `revocation_pending` until that acknowledgement is verified.

**Why:** A fresh short-lived assertion lets a durable outbox retry after an earlier token expires without changing the revocation event.

**How to apply:** Before Journal/Signals interoperation, verify these requirements across migration fields, canonicalization, outbox delivery, inbox idempotency, conflict auditing, and acknowledgement handling. Production retry settings remain a separate approval.
