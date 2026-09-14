import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("review verification compares a pristine base test total and keeps decreases host-enforced", async () => {
  const prepare = await source("runtime/stations/reviewer/tools/prepare_review.ts");
  const verify = await source("runtime/stations/reviewer/tools/verify_review.ts");
  const record = await source("runtime/stations/reviewer/tools/record_review.ts");

  assert.match(prepare, /path:`base\/\$\{entry\.file\}`/);
  assert.match(prepare, /cd \/workspace\/base; node --version; pnpm --version; pnpm install --frozen-lockfile/);
  assert.match(verify, /cd \/workspace\/base; pnpm test/);
  assert.match(verify, /testCountFromOutput\(\`\$\{baseResult\.stdout\}/);
  assert.match(verify, /testCountFromOutput\(\`\$\{result\.stdout\}/);
  assert.match(verify, /severity:"blocking"/);
  assert.match(record, /state\.verificationFindings/);
});
