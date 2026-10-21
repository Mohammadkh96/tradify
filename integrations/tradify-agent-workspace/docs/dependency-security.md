# Dependency security remediation

## Patched upstream releases

| Package | Resolved version | Advisory |
| --- | --- | --- |
| source-map-js | 1.2.2 | GHSA-68fv-2mgg-jv7q |
| http-cache-semantics | 4.3.0 | GHSA-ch52-4w7c-c8xp |
| shell-quote | 1.12.0 | GHSA-pqg4-j6r4-53mv |
| compression | 1.8.2 | GHSA-vc2v-76pw-4v95 |
| fast-copy | 4.1.2 | GHSA-jggr-w7fw-pc2j |
| postcss-selector-parser | 7.1.6 | GHSA-rj75-hqrm-r3gf |

The selector parser override is version-qualified because the latest
`@tailwindcss/typography` still pins 6.0.10. Its existing selector operations
are covered by the regression suite and the Admin production build.
Expo CLI and pino-pretty were updated within their existing major versions;
expo-constants was aligned with the updated CLI's peer requirement.

## Local security patches

As of 2026-10-09, the registry has no fixed upstream release for the three
packages below. Keep their `pnpm.patchedDependencies` entries and checked-in
patch files until upstream replacements are verified. The lockfile records
patch hashes so a frozen install applies the same fixes on every machine.

| Package | Advisory | Local fix |
| --- | --- | --- |
| node-forge 1.4.0 | GHSA-86w9-cpqp-85rv | Validate the nested DigestAlgorithm element count, in addition to the outer DigestInfo sequence. |
| braces 3.0.3 | GHSA-vfj7-8cjw-p6xm | Bound parsed brace/parenthesis nesting to 128, and recursive AST walkers to 129 (including the root/leaf level). |
| sprintf-js 1.0.3 | GHSA-hp3w-g68c-fv3c | Saturate floating precision to ECMAScript's valid range before numeric formatting. |

The Forge fix follows the validation change proposed in
https://github.com/digitalbazaar/forge/pull/1152.
Regression tests check valid RSA signatures with public exponent 3 and reject
extra NULL/OCTET STRING elements inside DigestAlgorithm, with or without the
optional parameters.

Braces rejects excessive nesting with an intentional `SyntaxError` rather
than exhausting the native call stack. The guard also covers direct AST input
and cyclic child nodes. Ordinary expansion, compilation, escaping, quoted
delimiters, and supported nesting retain their behavior.

The sprintf fix preserves valid floating precision and ordinary argument
formatting. Out-of-range precision becomes 100, and precision 0 for `%g`
becomes 1. It does not throw a native precision `RangeError`. String truncation
precision is unchanged. This patches the Node entry point used by argparse
in the Babel/Jest configuration loader, not an unused browser distribution.

### Audit interpretation

`pnpm audit` still reports node-forge, braces, and sprintf-js (two high, one
moderate): its advisory matching uses upstream names/versions and cannot
recognize these local source patches. **Do not suppress or ignore those
advisories, rename packages to hide them, or claim the audit is clean.**
The other six advisories are absent from the resolved lockfile and audit.

Run the behavioral regression suite after installation:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/scripts run test:dependency-security
```

This suite resolves modules through their actual workspace consumers. A
patch hash alone does not prove installed source is patched: if a cached
installation fails the regression suite after patch changes, use
`pnpm install --force --frozen-lockfile` and rerun it.

When a fixed upstream release becomes available, update its consumer or use a
compatible version-qualified override, remove the corresponding local patch,
and update the regression assertions and this document. Keep the exploit
regressions, run the audit again, and verify workspace typechecks, builds,
and mobile tests before considering the warning resolved upstream.
