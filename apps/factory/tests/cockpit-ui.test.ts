import test from "node:test";
import assert from "node:assert/strict";
import { cockpitFailureKind, cockpitFailureMessage, cockpitStatus } from "../app/utils/cockpit-errors.ts";

test("classifies shared cockpit conflicts separately from outages", () => {
  assert.equal(cockpitStatus({ statusCode: 409 }), 409);
  assert.equal(cockpitFailureKind({ statusCode: 409 }), "conflict");
  assert.equal(cockpitFailureKind({ response: { status: 503 } }), "unavailable");
  assert.equal(cockpitFailureKind({ data: { error: { code: "unavailable" } } }), "unavailable");
});

test("failure copy tells the user what is retained and what to do next", () => {
  assert.match(cockpitFailureMessage({ statusCode: 409 }, "This draft"), /Refresh/);
  assert.match(cockpitFailureMessage({ statusCode: 503 }, "Shared drafts"), /Keep your work/);
});
