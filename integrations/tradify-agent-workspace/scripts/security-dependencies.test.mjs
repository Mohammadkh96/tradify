import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

// Resolve through real consumers, not direct test-only package installations.
const admin = createRequire(new URL("../artifacts/tradify-admin/package.json", import.meta.url));
const mobile = createRequire(new URL("../artifacts/tradify-signals/package.json", import.meta.url));
const api = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const sandbox = createRequire(new URL("../artifacts/mockup-sandbox/package.json", import.meta.url));
const consumer = (require, name) => createRequire(require.resolve(name));
const cli = consumer(mobile, "@expo/cli");
const certificates = consumer(cli, "@expo/code-signing-certificates");
const micromatch = consumer(consumer(sandbox, "fast-glob"), "micromatch");
const braces = micromatch("braces");
const forge = cli("node-forge");

test("all six upgraded dependency versions remain outside advisory ranges", () => {
  const lock = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");
  const resolutions = lock.slice(lock.indexOf("\npackages:\n"));
  const vulnerable = [
    "source-map-js@1.2.1",
    "http-cache-semantics@4.2.0",
    "shell-quote@1.10.0",
    "compression@1.8.1",
    "fast-copy@4.0.4",
    "postcss-selector-parser@6.0.10",
  ];
  for (const version of vulnerable) {
    // Match package/snapshot entries; an override selector is not a resolution.
    assert.ok(!resolutions.includes(`\n  ${version}:`), `Vulnerable resolution: ${version}`);
  }
  assert.equal(consumer(admin, "@tailwindcss/typography")("postcss-selector-parser/package.json").version, "7.1.6");
  assert.equal(cli("compression/package.json").version, "1.8.2");
  assert.equal(consumer(api, "pino-pretty")("fast-copy/package.json").version, "4.1.2");
});

test("pnpm records required local patches rather than suppressing audit findings", () => {
  const root = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lock = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");
  for (const name of ["node-forge@1.4.0", "braces@3.0.3", "sprintf-js@1.0.3"]) {
    const path = root.pnpm.patchedDependencies[name];
    assert.ok(path, `Missing patch for ${name}`);
    assert.ok(readFileSync(new URL(`../${path}`, import.meta.url), "utf8").includes("diff --git"));
    assert.ok(lock.includes(`${name}(patch_hash=`), `Missing installed patch hash for ${name}`);
  }
});

test("node-forge accepts legitimate signatures and rejects nested DigestAlgorithm padding", () => {
  assert.equal(certificates("node-forge"), forge, "Both Expo consumers must use the patched module");
  const pair = generateKeyPairSync("rsa", { modulusLength: 1024, publicExponent: 3 });
  const privateKey = forge.pki.privateKeyFromPem(pair.privateKey.export({ type: "pkcs1", format: "pem" }));
  const publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ type: "pkcs1", format: "pem" }));
  const digest = forge.md.sha256.create().update("dependency security regression");
  const hash = digest.digest().getBytes();
  assert.equal(publicKey.verify(hash, privateKey.sign(digest)), true);

  const { asn1 } = forge;
  const node = (type, constructed, value) => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
  const oid = () => node(asn1.Type.OID, false, asn1.oidToDer(forge.pki.oids.sha256).getBytes());
  const nullNode = () => node(asn1.Type.NULL, false, "");
  for (const parameters of [[], [nullNode()]]) {
    const validAlgorithm = node(asn1.Type.SEQUENCE, true, [oid(), ...parameters]);
    const validInfo = node(asn1.Type.SEQUENCE, true, [validAlgorithm, node(asn1.Type.OCTETSTRING, false, hash)]);
    const signInfo = (info) => forge.pki.rsa.encrypt(asn1.toDer(info).getBytes(), privateKey, 0x01);
    assert.equal(publicKey.verify(hash, signInfo(validInfo)), true);
    for (const extra of [nullNode(), node(asn1.Type.OCTETSTRING, false, "padding")]) {
      const algorithm = node(asn1.Type.SEQUENCE, true, [oid(), ...parameters, extra]);
      // One NULL after the OID is valid; all other extra elements must fail.
      if (parameters.length === 0 && extra.type === asn1.Type.NULL) continue;
      const malformed = node(asn1.Type.SEQUENCE, true, [algorithm, node(asn1.Type.OCTETSTRING, false, hash)]);
      assert.throws(() => publicKey.verify(hash, signInfo(malformed)), /valid RSASSA-PKCS1-v1_5 DigestInfo/);
    }
  }
});

test("braces bounds balanced, unbalanced, and parentheses nesting before recursive traversal", () => {
  assert.deepEqual(braces.expand("src/{a,b}/{1..3}.ts"), [
    "src/a/1.ts", "src/a/2.ts", "src/a/3.ts", "src/b/1.ts", "src/b/2.ts", "src/b/3.ts",
  ]);
  assert.equal(braces.compile("{a,b}"), "(a|b)");
  assert.equal(braces.stringify(braces.parse("{a,b}")), "{a,b}");
  assert.doesNotThrow(() => braces.compile("{".repeat(128) + "x" + "}".repeat(128)));
  for (const pattern of [
    "{".repeat(4000) + "x" + "}".repeat(4000),
    "{".repeat(4000),
    "(".repeat(4000) + "x" + ")".repeat(4000),
    "{(".repeat(1000) + "x" + ")}".repeat(1000),
  ]) {
    for (const method of ["parse", "compile", "expand", "stringify"]) {
      assert.throws(() => braces[method](pattern), { name: "SyntaxError", message: /maximum depth/ });
    }
  }
  // Escaped/quoted delimiters remain literal; options cannot remove the safety cap.
  assert.doesNotThrow(() => braces.compile("\\{".repeat(1000)));
  assert.doesNotThrow(() => braces.compile('"' + "{".repeat(1000) + '"'));
  assert.throws(() => braces.compile("{".repeat(1000), { maxDepth: Infinity }), /maximum depth/);
});

test("braces protects callers passing an AST directly, including cyclic children", () => {
  let ast = { type: "text", value: "x", nodes: [] };
  for (let i = 0; i < 10000; i++) ast = { type: "root", nodes: [ast] };
  for (const method of ["compile", "expand", "stringify"]) {
    assert.throws(() => braces[method](ast), { name: "SyntaxError", message: /maximum depth/ });
  }
  const cyclic = { type: "root", nodes: [] };
  cyclic.nodes.push(cyclic);
  for (const method of ["compile", "expand", "stringify"]) {
    assert.throws(() => braces[method](cyclic), { name: "SyntaxError", message: /maximum depth/ });
  }
});

test("sprintf bounds floating precision without native RangeErrors and preserves ordinary formats", () => {
  // Resolve the formatter through the Babel/Jest config loader that uses argparse.
  const babelJest = consumer(mobile, "@react-native/jest-preset");
  const transform = consumer(consumer(babelJest, "babel-jest"), "babel-plugin-istanbul");
  const yaml = consumer(consumer(transform, "@istanbuljs/load-nyc-config"), "js-yaml");
  const formatter = consumer(yaml, "argparse")("sprintf-js");
  assert.equal(formatter.sprintf("%.2f", 1.234), "1.23");
  assert.equal(formatter.sprintf("%.2e", 1.234), "1.23e+0");
  assert.equal(formatter.sprintf("%.3g", 1.234), "1.23");
  assert.equal(formatter.vsprintf("%s %d", ["ok", 42]), "ok 42");
  for (const type of ["e", "f", "g"]) {
    for (const precision of ["101", "999999", "9".repeat(400)]) {
      const result = formatter.sprintf(`%.${precision}${type}`, 1.234);
      assert.equal(result, formatter.sprintf(`%.100${type}`, 1.234));
      assert.ok(result.length <= 110, "Output must be bounded");
    }
  }
  assert.equal(formatter.sprintf("%.0g", 1.234), "1");
});

test("shell-quote rejects newline injection after a comment token", () => {
  const shellQuote = consumer(consumer(mobile, "react-native"), "react-devtools-core")("shell-quote");
  for (const newline of ["\n", "\r", "\u2028", "\u2029"]) {
    assert.throws(() => shellQuote.quote(["echo", "ok", { comment: "x" }, `a${newline}id;#`]), TypeError);
  }
  assert.equal(shellQuote.quote(["echo", "hello world"]), "echo 'hello world'");
});

test("patched selector parser handles large flat selectors and ordinary typography selectors", () => {
  const parser = consumer(admin, "@tailwindcss/typography")("postcss-selector-parser");
  const selector = ".a".repeat(20000);
  assert.equal(parser().processSync(selector), selector);
  const normal = ':where(.prose) :not(:where([class~="not-prose"], [class~="not-prose"] *))';
  assert.equal(parser().processSync(normal), normal);
});
