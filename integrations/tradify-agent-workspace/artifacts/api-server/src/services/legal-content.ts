const LEGAL_EFFECTIVE_DATE = "[EFFECTIVE DATE]";
const SUPPORT_EMAIL = "[SUPPORT EMAIL — REPLACE BEFORE LAUNCH]";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function legalPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Tradify Signals</title>
    <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0b1117; color: #e8f0f2; }
    body { margin: 0; background: #0b1117; }
    main { max-width: 760px; margin: 0 auto; padding: 48px 22px 64px; }
    h1 { font-size: clamp(30px, 7vw, 48px); line-height: 1.05; margin: 0 0 10px; letter-spacing: -0.04em; }
    h2 { font-size: 20px; margin: 34px 0 10px; }
    p, li { color: #aebdc2; font-size: 16px; line-height: 1.65; }
    a { color: #69d8b5; }
    .brand { color: #69d8b5; font-weight: 800; letter-spacing: .12em; font-size: 12px; }
    .meta { color: #7f949b; font-size: 13px; }
    .notice { border: 1px solid #926f36; background: #2a2114; border-radius: 14px; padding: 14px 16px; margin: 24px 0; color: #f2d49a; }
    form { display: grid; gap: 12px; max-width: 520px; margin-top: 22px; }
    label { color: #e8f0f2; font-weight: 700; }
    input, button { font: inherit; border-radius: 10px; padding: 13px 14px; }
    input { color: #e8f0f2; background: #121c24; border: 1px solid #344953; }
    button { color: #07100f; background: #69d8b5; border: 0; font-weight: 800; cursor: pointer; }
    nav { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 40px; }
  </style>
</head>
<body><main>
  <div class="brand">TRADIFY SIGNALS</div>
  <div class="notice"><strong>TEMPLATE — LAWYER REVIEW REQUIRED BEFORE LAUNCH.</strong> This is not legal advice. Replace all bracketed placeholders and confirm the terms, privacy practices, retention periods, applicable law, and operator details with qualified counsel.</div>
  ${body}
  <nav><a href="/api/legal/privacy">Privacy Policy</a><a href="/api/legal/terms">Terms of Service</a><a href="/api/legal/support">Support</a><a href="/api/legal/account-deletion">Account deletion</a></nav>
</main></body></html>`;
}

export function privacyPolicyPage(): string {
  return legalPage(
    "Privacy Policy",
    `
    <h1>Privacy Policy — TEMPLATE</h1>
    <p class="meta">Effective date: ${LEGAL_EFFECTIVE_DATE}</p>
    <p>Service operator: [LEGAL BUSINESS NAME]. Contact address: [BUSINESS ADDRESS]. Privacy contact: ${SUPPORT_EMAIL}.</p>
    <h2>Information Tradify receives</h2>
    <p>Tradify receives the account information you provide, including your email address, display name, risk preferences, watchlists, alerts, notifications, trade-tracking records, membership state, and subscription-related identifiers needed to provide the service.</p>
    <h2>Market and subscription providers</h2>
    <p>Tradify uses an authoritative market-data bridge to provide live market information and uses RevenueCat, Apple, and Google Play to process and validate in-app subscriptions. Provider and broker diagnostics are restricted to operational administration and are not presented as customer data in ordinary customer responses. Confirm and list the actual processors, hosting locations, and any international transfers before launch.</p>
    <h2>How information is used</h2>
    <p>Information is used to authenticate your account, persist your Tradify workspace, provide membership access, maintain billing integrity, operate alerts and trade tracking, secure the service, and investigate reliability or abuse.</p>
    <h2>Retention and deletion</h2>
    <p>You can export account data from Profile → Export my data and initiate deletion inside the app or use the public request page. Account and customer-state data are anonymized or cleared through the server-owned deletion lifecycle. Billing, security, fraud-prevention, and audit records may require limited retention; specify the actual retention periods and lawful bases before launch.</p>
    <h2>Contact and changes</h2>
    <p>For access, correction, export, or deletion requests, contact ${SUPPORT_EMAIL} or use the in-app data export and deletion controls. Add the applicable privacy rights, response times, legal bases, and regulator contact details after legal review.</p>
  `,
  );
}

export function termsPage(): string {
  return legalPage(
    "Terms & Conditions",
    `
    <h1>Terms of Service — TEMPLATE</h1>
    <p class="meta">Effective date: ${LEGAL_EFFECTIVE_DATE}</p>
    <p>Service operator: [LEGAL BUSINESS NAME]. Registered address: [BUSINESS ADDRESS].</p>
    <h2>Decision-support service</h2>
    <p>Tradify Signals provides market information, opportunity references, alerts, charts, and decision-support commentary. It is not financial advice, an instruction to trade, brokerage, execution, custody, or a guarantee of results.</p>
    <h2>Trading Risk Disclaimer</h2>
    <p><strong>Trading involves substantial risk.</strong> Trading foreign exchange, contracts for difference, cryptoassets, and other leveraged or volatile products can result in rapid losses, including the loss of all funds allocated to trading. Leverage magnifies both gains and losses. You should trade only with money you can afford to lose.</p>
    <p><strong>Information, not personal advice.</strong> Tradify Signals provides market information, automated analysis, educational material, and decision-support tools. Nothing in the service is a recommendation, solicitation, or personal investment, legal, tax, or financial advice. The service does not assess your objectives, experience, or financial circumstances.</p>
    <p><strong>Signals and data may be wrong or delayed.</strong> Quotes, charts, calculations, alerts, and signals may be delayed, incomplete, inaccurate, or unavailable. Market conditions, spreads, liquidity, slippage, outages, and execution prices can change quickly. Displayed entries, stops, targets, and risk calculations are illustrative and are not guarantees of execution or results.</p>
    <p><strong>Your decisions remain your responsibility.</strong> Independently verify information and assess whether any transaction is suitable for you before acting. Do not rely on a signal as the sole basis for a trading decision. Consider seeking advice from an appropriately qualified independent professional. Past performance does not predict or guarantee future results.</p>
    <p><strong>No waiver of legal rights.</strong> This notice explains material risks; it does not remove or limit any liability where doing so is prohibited by law, waive any non-waivable rights, or replace any regulatory disclosure or obligation that may apply to Tradify or a user in a particular jurisdiction.</p>
    <p class="meta">Disclaimer version: 2026-10-13-v1</p>
    <h2>Accounts and subscriptions</h2>
    <p>You are responsible for securing your account and providing accurate registration information. Paid memberships are purchased and managed through Apple App Store or Google Play. Cancellation and store billing are governed by the applicable store rules; deleting a Tradify account does not itself cancel a store subscription.</p>
    <h2>Availability and data quality</h2>
    <p>Live data, alerts, commentary, and membership verification may be unavailable or delayed. Tradify fails closed for trusted opportunities when authoritative data does not meet its validation requirements.</p>
    <h2>Account deletion</h2>
    <p>You can request deletion from inside the app or through the public account-deletion page. Deletion may clear customer workspace data while limited security, billing, fraud-prevention, or audit records are retained where required. Retention details require founder and legal approval.</p>
    <h2>Governing law and disputes</h2>
    <p>[INSERT COUNSEL-APPROVED GOVERNING LAW, VENUE, AND DISPUTE TERMS.] Do not launch with this placeholder.</p>
    <h2>Contact</h2>
    <p>Questions: ${SUPPORT_EMAIL}</p>
  `,
  );
}

export function supportPage(): string {
  return legalPage(
    "Contact and support",
    `
    <h1>Contact and support</h1>
    <p class="meta">Tradify Signals · Support</p>
    <h2>Get help</h2>
    <p>For account, privacy, or subscription support, contact <strong>${SUPPORT_EMAIL}</strong>. Replace this placeholder with a monitored support address before launch.</p>
    <p>Include the email associated with your account and a brief description of the issue. Never send your password, payment-card details, authentication codes, or API credentials.</p>
    <h2>Privacy requests</h2>
    <p>You can export your account data in Profile → Export my data, delete your account in Profile → Delete account, or use the <a href="/api/legal/account-deletion">public account-deletion request page</a>.</p>
  `,
  );
}

export function deletionRequestPage(message?: string): string {
  return legalPage(
    "Account deletion",
    `
    <h1>Request account deletion</h1>
    <p class="meta">Tradify Signals · ${LEGAL_EFFECTIVE_DATE}</p>
    <p>Customers can permanently delete their account from inside the app under Profile → Account deletion. This web form is also available for Google Play customers who need to request deletion of their account and associated customer data.</p>
    <div class="notice">Submitting this form creates a pending request for review. We do not delete an account based on an email address alone. The in-app authenticated flow is the fastest way to complete deletion.</div>
    ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ""}
    <form method="post" action="/api/legal/account-deletion/request">
      <label for="email">Account email</label>
      <input id="email" name="email" type="email" autocomplete="email" required maxlength="320">
      <button type="submit">Submit deletion request</button>
    </form>
    <h2>What the in-app flow removes</h2>
    <p>The authenticated flow clears the profile, watchlists, alerts, notifications, trades, preferences, membership access, and active sessions. The account identifier is anonymized. Security, billing, fraud-prevention, and audit records may be retained where required; the applicable retention questions require founder and legal approval before store submission.</p>
    <h2>Subscriptions</h2>
    <p>Deleting a Tradify account does not cancel an Apple App Store or Google Play subscription. Cancel the store subscription separately in the relevant store account settings.</p>
  `,
  );
}
