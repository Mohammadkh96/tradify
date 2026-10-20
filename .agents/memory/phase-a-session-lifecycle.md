---
name: Phase A session lifecycle
description: Lifecycle and cleanup behavior for temporary Journal account-linking test sessions.
---

Treat each Phase A signer and disposable database as a single short-lived session. A workflow can remain configured to a temporary `/tmp` launcher after that launcher or its database artifacts have disappeared, so its configured command is not evidence that a signer is active. Confirm workflow state, listener ports, and the temporary database root before any handoff. After expiry, require a fresh signer and `kid`; never infer that an earlier key remains usable.

**Why:** After an approved 180-minute test window expired, the workflow was stopped, local database ports were closed, and the temporary root and launcher were absent. Reusing the prior workflow configuration would have failed closed, not resumed the signer.

**How to apply:** Before every new test window, verify the expired runtime is gone, then create a fresh in-memory signer and loopback-only PostgreSQL instance. Keep Phase B and account-linking routes disabled until the current peer key is received and explicitly loaded.
