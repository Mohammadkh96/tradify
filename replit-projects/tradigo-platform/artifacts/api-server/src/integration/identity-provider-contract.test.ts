import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import app from "../app";
import { pool } from "@workspace/db";

type ResponseBody = Record<string, any>;
type ContractCapture = {
  provider: string;
  contract: {
    signatureHeader: string;
    timestampHeader: string;
    signaturePrefix: string;
    signatureEncoding: string;
    timestampUnit: string;
    signedBytes: string;
    decisionField: string;
  };
  deliveries: Array<{
    name: string;
    providerStatus: string;
    expectedDecision: string;
    providerReference: string;
    reasonCodes: string[];
    checks: Record<string, string>;
    headers: Record<string, string>;
    body: Record<string, any>;
  }>;
};

const capture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "./fixtures/paypal-identity-sandbox-capture.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as ContractCapture;
const PINNED_PAYPAL_CONTRACT = {
  provider: "PAYPAL",
  signatureHeader: "x-paypal-identity-signature",
  timestampHeader: "x-paypal-identity-timestamp",
  signaturePrefix: "sha256=",
  signatureEncoding: "lowercase-hex",
  timestampUnit: "unix-seconds",
  signedBytes: "utf8(`${timestamp}.${rawBody}`)",
  decisionField: "resource.verification_status",
  decisions: {
    approved: "VERIFIED",
    declined: "DECLINED",
    pending: "PENDING",
  },
} as const;
const SENSITIVE_FIELD_NAMES =
  /^(documents?|image|image_base64|personal_data|home_address|tax_id)$/i;
const applicationIds: string[] = [];
let server: Server;
let baseUrl: string;

function contractFailure(deliveryName: string, message: string): string {
  return `PayPal identity callback contract drift (${deliveryName}): ${message}`;
}

function assertContract(
  condition: unknown,
  deliveryName: string,
  message: string,
): asserts condition {
  assert.ok(condition, contractFailure(deliveryName, message));
}

function replaceCapturePlaceholders(
  value: unknown,
  replacements: Record<string, unknown>,
): unknown {
  if (Array.isArray(value))
    return value.map((item) => replaceCapturePlaceholders(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceCapturePlaceholders(item, replacements),
      ]),
    );
  }
  if (typeof value === "string" && value in replacements)
    return replacements[value];
  return value;
}

function assertNoSensitiveFields(value: unknown, path = "capture"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSensitiveFields(item, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      SENSITIVE_FIELD_NAMES.test(key),
      false,
      `PayPal identity sandbox capture must be redacted; found sensitive field ${path}.${key}`,
    );
    assertNoSensitiveFields(child, `${path}.${key}`);
  }
}

function signPayPalCapture(
  rawBody: Buffer,
  timestamp: string,
  secret: string,
): string {
  return `sha256=${createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]))
    .digest("hex")}`;
}

async function createApplication(): Promise<string> {
  const applicationId = randomUUID();
  applicationIds.push(applicationId);
  await pool.query(
    `INSERT INTO tradigo_coach_applications
      (id, applicant_id, applicant_name, applicant_email, status, verification)
     VALUES ($1,$2,$3,$4,'UNDER_REVIEW',$5::jsonb)`,
    [
      applicationId,
      `sandbox-applicant-${applicationId}`,
      "Redacted Sandbox Applicant",
      "redacted@example.invalid",
      JSON.stringify({ provider: "PAYPAL" }),
    ],
  );
  return applicationId;
}

async function cleanupApplications(): Promise<void> {
  if (!applicationIds.length) return;
  const ids = [...applicationIds];
  await pool.query(
    "DELETE FROM tradigo_identity_webhook_events WHERE application_id = ANY($1)",
    [ids],
  );
  await pool.query(
    "DELETE FROM tradigo_application_audit WHERE application_id = ANY($1)",
    [ids],
  );
  await pool.query(
    "DELETE FROM tradigo_coach_applications WHERE id = ANY($1)",
    [ids],
  );
  applicationIds.splice(0, ids.length);
}

before(async () => {
  process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET =
    "identity-webhook-contract-test-secret";
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await cleanupApplications();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe(
  "PayPal identity provider sandbox contract",
  { concurrency: false },
  () => {
    it("replays the redacted approved, declined, and pending capture", async () => {
      const secret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
      assert.ok(secret);
      assertNoSensitiveFields(capture);
      assert.deepEqual(
        capture.provider,
        PINNED_PAYPAL_CONTRACT.provider,
        "PayPal identity callback contract drift: provider changed.",
      );
      assert.deepEqual(
        capture.contract,
        {
          signatureHeader: PINNED_PAYPAL_CONTRACT.signatureHeader,
          timestampHeader: PINNED_PAYPAL_CONTRACT.timestampHeader,
          signaturePrefix: PINNED_PAYPAL_CONTRACT.signaturePrefix,
          signatureEncoding: PINNED_PAYPAL_CONTRACT.signatureEncoding,
          timestampUnit: PINNED_PAYPAL_CONTRACT.timestampUnit,
          signedBytes: PINNED_PAYPAL_CONTRACT.signedBytes,
          decisionField: PINNED_PAYPAL_CONTRACT.decisionField,
        },
        "PayPal identity callback contract drift: capture metadata no longer matches the pinned contract.",
      );
      assert.equal(
        capture.deliveries.length,
        3,
        "PayPal identity callback contract drift: expected approved, declined, and pending deliveries.",
      );

      for (const delivery of capture.deliveries) {
        const expectedDecision =
          PINNED_PAYPAL_CONTRACT.decisions[
            delivery.providerStatus as keyof typeof PINNED_PAYPAL_CONTRACT.decisions
          ];
        assertContract(
          expectedDecision === delivery.expectedDecision,
          delivery.name,
          `decision mapping for ${delivery.providerStatus} is ${delivery.expectedDecision}, expected ${expectedDecision}.`,
        );
        assertContract(
          Object.keys(delivery.headers).sort().join(",") ===
            [
              "x-identity-provider",
              PINNED_PAYPAL_CONTRACT.signatureHeader,
              PINNED_PAYPAL_CONTRACT.timestampHeader,
            ]
              .sort()
              .join(","),
          delivery.name,
          "signature and timestamp headers changed; update the provider adapter and capture together.",
        );
        assertContract(
          delivery.headers[PINNED_PAYPAL_CONTRACT.timestampHeader] ===
            "{{UNIX_SECONDS}}",
          delivery.name,
          "timestamp header no longer uses the pinned Unix-seconds capture placeholder.",
        );
        assertContract(
          delivery.headers[PINNED_PAYPAL_CONTRACT.signatureHeader] ===
            "sha256={{SIGNATURE}}",
          delivery.name,
          "signature header no longer uses the pinned sha256 hex capture placeholder.",
        );
        assertContract(
          delivery.body.resource?.verification_status ===
            delivery.providerStatus,
          delivery.name,
          `resource.verification_status does not contain ${delivery.providerStatus}.`,
        );
        assertContract(
          delivery.body.resource?.custom_id === "{{APPLICATION_ID}}",
          delivery.name,
          "application reference moved away from resource.custom_id.",
        );
        assertContract(
          delivery.body.resource?.id === "{{PROVIDER_REFERENCE}}",
          delivery.name,
          "provider reference moved away from resource.id.",
        );

        const applicationId = await createApplication();
        const eventId = `paypal-identity-contract-${delivery.name}-${randomUUID()}`;
        const timestamp = String(Math.floor(Date.now() / 1000));
        assertContract(
          /^\d{10}$/.test(timestamp),
          delivery.name,
          "replay timestamp is not Unix seconds.",
        );
        const body = replaceCapturePlaceholders(delivery.body, {
          "{{EVENT_ID}}": eventId,
          "{{APPLICATION_ID}}": applicationId,
          "{{PROVIDER_REFERENCE}}": delivery.providerReference,
          "{{CHECKS}}": delivery.checks,
          "{{REASON_CODES}}": delivery.reasonCodes,
        }) as Record<string, any>;
        const rawBody = Buffer.from(JSON.stringify(body), "utf8");
        const signature = signPayPalCapture(rawBody, timestamp, secret);
        assertContract(
          /^sha256=[0-9a-f]{64}$/.test(signature),
          delivery.name,
          "signature is not sha256= followed by lowercase hexadecimal.",
        );
        const headers = {
          "content-type": "application/json",
          [PINNED_PAYPAL_CONTRACT.signatureHeader]: signature,
          [PINNED_PAYPAL_CONTRACT.timestampHeader]: timestamp,
          "x-identity-provider": capture.provider,
        };
        const response = await fetch(
          `${baseUrl}/api/webhooks/provider-identity`,
          {
            method: "POST",
            headers,
            body: rawBody,
          },
        );
        const responseBody = (await response.json()) as ResponseBody;
        assert.equal(
          response.status,
          200,
          contractFailure(
            delivery.name,
            `replay was rejected (${response.status}): ${responseBody.error?.message ?? "unknown provider callback error"}`,
          ),
        );
        assert.equal(
          responseBody.status,
          "PROCESSED",
          contractFailure(delivery.name, "replay did not process."),
        );
        assert.equal(
          responseBody.decision,
          delivery.expectedDecision,
          contractFailure(
            delivery.name,
            `decision mapped to ${responseBody.decision}, expected ${delivery.expectedDecision}.`,
          ),
        );

        const application = await pool.query(
          "SELECT verification FROM tradigo_coach_applications WHERE id=$1",
          [applicationId],
        );
        const verification = application.rows[0].verification as Record<
          string,
          any
        >;
        assert.equal(
          verification.identity,
          delivery.expectedDecision,
          contractFailure(
            delivery.name,
            "application decision mapping changed.",
          ),
        );
        assert.equal(
          verification.providerReference,
          delivery.providerReference,
          contractFailure(delivery.name, "provider reference mapping changed."),
        );
        assert.equal(
          verification.identityDecision.providerEventId,
          eventId,
          contractFailure(delivery.name, "event ID mapping changed."),
        );
        assert.deepEqual(
          verification.identityDecision.reasonCodes,
          delivery.reasonCodes,
          contractFailure(delivery.name, "reason-code mapping changed."),
        );

        const history = await pool.query(
          "SELECT details FROM tradigo_application_audit WHERE application_id=$1 AND action='IDENTITY_VERIFICATION_DECISION'",
          [applicationId],
        );
        const details = history.rows[0].details as Record<string, any>;
        assert.equal(details.decision, delivery.expectedDecision);
        assert.equal(details.providerEventId, eventId);
        assertNoSensitiveFields({
          verification,
          details,
          event: (
            await pool.query(
              "SELECT payload_hash FROM tradigo_identity_webhook_events WHERE event_id=$1",
              [eventId],
            )
          ).rows[0],
        });
      }
    });

    it("rejects a capture that uses non-canonical timestamp, encoding, or signed bytes", async () => {
      const delivery = capture.deliveries[0];
      const eventId = `paypal-identity-contract-invalid-${randomUUID()}`;
      const body = {
        id: eventId,
        event_type: "IDENTITY.REVIEW.UPDATED",
        resource: {
          verification_status: delivery.providerStatus,
        },
      };
      const rawBody = Buffer.from(JSON.stringify(body), "utf8");
      const millisecondsTimestamp = String(Date.now());
      const bodyOnlyDigest = createHmac(
        "sha256",
        process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET!,
      )
        .update(rawBody)
        .digest("hex");
      const response = await fetch(
        `${baseUrl}/api/webhooks/provider-identity`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-identity-provider": capture.provider,
            [PINNED_PAYPAL_CONTRACT.timestampHeader]: millisecondsTimestamp,
            [PINNED_PAYPAL_CONTRACT.signatureHeader]: `${PINNED_PAYPAL_CONTRACT.signaturePrefix}${bodyOnlyDigest}`,
          },
          body: rawBody,
        },
      );
      const responseBody = (await response.json()) as ResponseBody;
      assert.equal(
        response.status,
        401,
        contractFailure(
          delivery.name,
          `non-canonical replay was accepted (${response.status}); timestamp, encoding, and signed bytes must remain pinned.`,
        ),
      );
      assert.match(
        String(responseBody.error?.message),
        /signature verification failed/i,
      );
    });
  },
);