import test from "node:test";
import assert from "node:assert/strict";
import {
  dragDropTargets,
  moveIssue,
  moveTargets,
  type BoardIssue,
} from "../app/utils/boardMove.ts";

const seed: BoardIssue[] = [
  { key: "ADEO-1", title: "One", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
  { key: "ADEO-2", title: "Two", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "demo" },
];

const COLUMNS = ["To Do", "In Progress", "In Review", "Done"];

/** Shape of a Nuxt FetchError carrying the server demoOnly 409 copy. */
function demoOnly409(from: string, to: string, allowed: string) {
  const error = new Error("Request failed with status code 409");
  (error as unknown as { data: { message: string; demoOnly: boolean; allowedFrom: string[] } }).data = {
    message:
      `Demo-only transition rejected: "${from}" -> "${to}" is not in the demo matrix. ` +
      `Allowed demo target(s) from "${from}": ${allowed}. ` +
      `Nothing was saved. This is a teaching guard, not verified Jira workflow parity.`,
    demoOnly: true,
    allowedFrom: [allowed],
  };
  return error;
}

test("drag targets keep every column droppable while keyboard targets stay narrowed", () => {
  // The board intent: every observed column stays a drop target so an
  // illegal drop travels the same PATCH save path and surfaces the 409
  // teaching error instead of being hidden.
  assert.deepEqual(dragDropTargets(COLUMNS), COLUMNS);
  assert.deepEqual(dragDropTargets([...COLUMNS, "Archived"]), COLUMNS);
  // Keyboard/select controls keep the narrowed legal-next-step behavior.
  assert.deepEqual(moveTargets(COLUMNS, "To Do"), ["In Progress"]);
  assert.deepEqual(moveTargets(COLUMNS, "In Review"), ["Done"]);
});

test("legal drag move persists through the same PATCH save path", async () => {
  const saved: BoardIssue = { ...seed[0]!, status: "In Progress" };
  const result = await moveIssue(seed, "ADEO-1", "In Progress", async () => saved);
  assert.equal(result.ok, true);
  assert.equal(
    result.issues.find((issue) => issue.key === "ADEO-1")?.status,
    "In Progress",
  );
});

test("illegal drag move surfaces the demoOnly 409 copy and writes nothing", async () => {
  const before = seed.map((issue) => ({ ...issue }));
  const result = await moveIssue(seed, "ADEO-1", "Done", async () => {
    throw demoOnly409("To Do", "Done", "In Progress");
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /Demo-only transition rejected/);
  assert.match(result.error, /Nothing was saved/);
  // No false success: the card stays in its original column with the
  // original list intact, so selection/draft state is preserved.
  assert.deepEqual(result.issues, before);
  assert.equal(
    result.issues.find((issue) => issue.key === "ADEO-1")?.status,
    "To Do",
  );
});

test("deterministic drag failure writes nothing and never shows false success", async () => {
  const before = seed.map((issue) => ({ ...issue }));
  const result = await moveIssue(seed, "ADEO-1", "In Progress", async () => {
    throw new Error("Demo-only save failure (deterministic test path).");
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, before);
});

test("drag dropped back onto its own column is a no-op without saving", async () => {
  let saves = 0;
  const result = await moveIssue(seed, "ADEO-1", "To Do", async () => {
    saves += 1;
    return { ...seed[0]! };
  });
  assert.equal(result.ok, true);
  assert.equal(saves, 0);
  assert.deepEqual(result.issues, seed);
});
