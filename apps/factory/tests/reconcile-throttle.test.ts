import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileCanReuse, RECONCILE_REUSE_MS } from "../runtime/lib/delivery-state.ts";

const publication = { number: 7, headSha: "a".repeat(40) } as any;
const github = (observedAt: string) => ({ number: 7, headSha: "a".repeat(40), observedAt }) as any;

test("reconcile reuses a fresh GitHub observation for the same PR head and skips finished deliveries", () => {
  const now = Date.parse("2026-09-15T00:00:30.000Z");
  assert.equal(reconcileCanReuse({ phase: "human_review", publication, github: github("2026-09-15T00:00:10.000Z") } as any, now), true);
  assert.equal(reconcileCanReuse({ phase: "human_review", publication, github: github("2026-09-14T23:59:00.000Z") } as any, now), false);
  assert.equal(reconcileCanReuse({ phase: "human_review", publication, github: { ...github("2026-09-15T00:00:10.000Z"), headSha: "b".repeat(40) } } as any, now), false);
  assert.equal(reconcileCanReuse({ phase: "human_review", publication, github: undefined } as any, now), false);
  assert.equal(reconcileCanReuse({ phase: "merged", publication, github: undefined } as any, now), true);
  assert.equal(RECONCILE_REUSE_MS, 30_000);
});
