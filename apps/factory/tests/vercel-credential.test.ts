import { test } from "node:test";
import assert from "node:assert/strict";
import { vercelCredentialExpiryGap, vercelMachineCredentialExpiresAt } from "../runtime/lib/vercel-context.ts";

test("machine credential expiry surfaces as a context gap, never silently", () => {
  const expiry = Date.parse(vercelMachineCredentialExpiresAt);
  assert.equal(vercelCredentialExpiryGap(new Date(expiry - 30 * 86_400_000)), null);
  assert.match(vercelCredentialExpiryGap(new Date(expiry - 3 * 86_400_000)) ?? "", /expires on/);
  assert.match(vercelCredentialExpiryGap(new Date(expiry + 86_400_000)) ?? "", /expired on/);
});
