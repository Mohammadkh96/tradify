import assert from "node:assert/strict";
import test from "node:test";
import { SymbolMapper } from "./SymbolMapper";

test("maps the broker's XAUUSD.s symbol to canonical XAUUSD", () => {
  const resolved = SymbolMapper.toCanonical("XAUUSD.s");

  assert.equal(resolved.canonical, "XAUUSD");
  assert.equal(resolved.isUnmapped, false);

  if (!resolved.canonical) return;
  SymbolMapper.registerBrokerMapping(resolved.canonical, "XAUUSD.s");
  assert.equal(SymbolMapper.toBroker("XAUUSD"), "XAUUSD.s");
  SymbolMapper.clearBrokerMappings();
});
