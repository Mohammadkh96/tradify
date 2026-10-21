# PayPal sandbox release verification

**Executed:** 2026-08-25 11:56 UTC  
**Environment:** PayPal Sandbox  
**Scope:** Manual buyer approval followed by authorization, authorization expiry retention, authorization release, and partial capture.
**Security:** No client secret, access token, payer data, or approval URL is recorded here. Provider references are redacted.

## Credential check

The existing sandbox credential test authenticated successfully against the PayPal OAuth endpoint.

## Authorized cancellation / void

A new USD 1.00 `AUTHORIZE` order was created and manually approved by the sandbox buyer.

| Step | Provider result |
| --- | --- |
| Order lookup | `APPROVED` |
| Order authorization | HTTP `201`; order `COMPLETED`; authorization `CREATED` |
| Authorization lookup before release | HTTP `200`; authorization `CREATED` |
| Void request | HTTP `204` |
| Authorization lookup after release | HTTP `200`; authorization `VOIDED` |

The authorization reference was `1XA5…804S`. This confirms that an approved sandbox authorization can be released with PayPal's void endpoint and reaches the terminal `VOIDED` state.

## Partial capture and remaining-authorization release

A separate USD 2.00 `AUTHORIZE` order was manually approved by the sandbox buyer. A partial USD 1.00 capture was then requested with `final_capture: false`.

| Step | Provider result |
| --- | --- |
| Order lookup | `APPROVED` |
| Order authorization | HTTP `201`; order `COMPLETED`; authorization `CREATED` for USD 2.00 |
| Partial capture | HTTP `201`; capture `COMPLETED` for USD 1.00 |
| Authorization lookup after capture | HTTP `200`; authorization `PARTIALLY_CAPTURED` |
| Void remaining authorization | HTTP `204` |
| Final authorization lookup | HTTP `200`; authorization `VOIDED` |

The authorization reference was `7C11…644L` and the capture reference was `9ST2…7411`.

This confirms the expected provider lifecycle: `APPROVED` order → `CREATED` authorization → `PARTIALLY_CAPTURED` after a non-final partial capture → `VOIDED` after the remaining authorization is released.

## Expiry handling

When PayPal returns `expiration_time` and authorization `status`, Tradigo stores both on the scheduled session. The participant session view shows the expiry and a next action when the hold has less than 24 hours remaining. Moderators can review the same sessions from **Authorization hold health**.

Completion checks the retained expiry before requesting capture. An expired authorization returns `PAYPAL_AUTHORIZATION_EXPIRED` and remains unsettled rather than silently proceeding. The operator must contact both participants to renew payment before capture.

## Notes

- An earlier USD 2.00 approval did not appear immediately to the payer, but later provider lookups returned `APPROVED`; the final verification used that confirmed state.
- The additional USD 1.00 retry order was not needed after the USD 2.00 order reached `APPROVED`.
- All remaining authorized balance in the partial-capture scenario was explicitly voided. No credential material is stored in this report.