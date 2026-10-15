import { drainProductLinkOutboxOnce } from "../server/product-linking-outbox";

try {
  const result = await drainProductLinkOutboxOnce();
  console.log(
    `Product-link revocation pass complete: ${result.claimed} claimed, ` +
      `${result.delivered} acknowledged, ${result.retried} scheduled for retry.`,
  );
} catch {
  console.error("Product-link revocation pass stopped; no sensitive details were logged.");
  process.exitCode = 1;
}
