# Tradify Journal ↔ Signals Account Linking V1

**Status:** Customer-facing copy and isolated-development scope approved by the Signals product owner on 2026-10-19. Journal-side acceptance, key exchange, and end-to-end verification remain pending.

## Approved scope

This approval is limited to isolated development and synthetic test accounts. It does not authorize production linking, deployment, paid infrastructure, or access to real customer data.

The products retain separate authentication, account records, subscriptions, entitlements, and permissions. Neither product may query the other's database or receive customer passwords, email addresses, trading records, or unrelated personal information.

## Customer account-pair review

Before consent, show both temporary randomized pairing labels:

- Journal pairing label
- Signals pairing label

The labels must match `JRN-[A-Z2-7]{12}` and `SIG-[A-Z2-7]{12}` respectively. Do not display email addresses, internal database IDs, passwords, or sensitive account information. Do not allow consent unless both labels are valid and the original authorization deadline is still in the future.

Show the original expiry time. Journal's authorization deadline is at most five minutes from request creation and must not be extended or reset by preview, consent, retry, or status refresh. An expired authorization must be rejected; the customer must start a new request in Journal.

## Approved Signals consent copy

> By connecting these accounts, you authorize Journal and Signals to share only the temporary pairing labels, your consent record, link status, authorization deadline, and disconnect or revocation status needed to establish and manage this connection. You will continue signing in to each product separately, and subscriptions remain separate. This does not share passwords, email addresses, trading records, subscriptions, entitlements, or permissions. You can disconnect from either product; while disconnection is pending, the link is unusable until both products confirm revocation. This authorization expires at {authorization deadline}; if it expires, start again in Journal.

The explicit checkbox confirmation is:

> I reviewed both pairing labels above and authorize connecting this account pair under these terms.

The action label is **Connect accounts**. Do not show draft or pending-approval language for this copy.

## Verification requirements before enabling linking

- Both products validate each other's development public verification key, immutable `kid`, issuer, audience, and HTTPS API transport.
- Private signing keys stay isolated from Shared and Production secrets.
- The Journal development database is verified as isolated from its production database.
- Cross-service tests use synthetic accounts and isolated development data.
- Consent and authorization expiry checks are enforced server-side; UI visibility is not a substitute for server enforcement.
- Account-pair labels remain randomized and must not encode email addresses, internal IDs, passwords, or sensitive account data.

## Product-owner approval record

On 2026-10-19, the Signals product owner approved the V1 consent and account-pair review wording above for isolated development. Approval covers both consent screens, the account-pair confirmation, separate authentication and subscriptions, limited account-linking metadata, disconnect/revocation explanation, and the five-minute authorization deadline. It does not waive the technical verification requirements or authorize production use.
