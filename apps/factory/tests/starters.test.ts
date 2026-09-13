import test from "node:test";
import assert from "node:assert/strict";
import { starterRequests } from "@jira-clone/context";
import { describeStarter, starterDraft } from "../app/utils/starters.ts";

test("the shipped starters are labelled shipped with a truthful handoff", () => {
  assert.equal(starterRequests.length, 3);
  for (const starter of starterRequests) {
    const card = describeStarter(starter);
    assert.equal(card.meta.state, "shipped");
    assert.match(card.meta.badge, /Shipped/);
    assert.ok(card.meta.note.length > 20);
    assert.match(card.meta.next, /rather than proposing/);
  }
});

test("list, board and accounts notes stay distinct", () => {
  const notes = starterRequests.map((starter) => describeStarter(starter).meta.note);
  assert.equal(new Set(notes).size, notes.length);
});

test("unknown starters remain open without a shipped badge", () => {
  const card = describeStarter({ title: "OAuth-era prompt", body: "Try the OAuth demo flow." });
  assert.equal(card.meta.state, "open");
  assert.equal(card.meta.badge, "Open");
  assert.match(card.meta.next, /save the draft/i);
});

test("starter matching ignores case and surrounding whitespace", () => {
  const card = describeStarter({ title: "  AN ADEO ISSUE LIST  ", body: "Duplicate invitation." });
  assert.equal(card.meta.state, "shipped");
});

test("shipped Use action drafts an extension carrying the displayed next step", () => {
  for (const starter of starterRequests) {
    const card = describeStarter(starter);
    const draft = starterDraft(card);
    assert.notEqual(draft.body, starter.body);
    assert.ok(draft.body.includes(card.meta.note));
    assert.ok(draft.body.includes(card.meta.next));
    assert.match(draft.body, /do not propose the shipped work again/i);
  }
});

test("open starters keep their original body in the draft", () => {
  const card = describeStarter({ title: "OAuth-era prompt", body: "Try the OAuth demo flow." });
  const draft = starterDraft(card);
  assert.equal(draft.title, "OAuth-era prompt");
  assert.equal(draft.body, "Try the OAuth demo flow.");
});
