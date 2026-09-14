import test from "node:test";
import assert from "node:assert/strict";
import { cockpitActionMessage, cockpitFailureKind, cockpitFailureMessage, cockpitStatus } from "../app/utils/cockpit-errors.ts";

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

test("action errors preserve a safe server explanation when one is available", () => {
  assert.equal(cockpitActionMessage({ data: { error: { message: "The shared record is unavailable." } } }, "Retry"), "The shared record is unavailable.");
  assert.equal(cockpitActionMessage({ data: { error: { message: "line one\nline two" } } }, "Retry"), "line one line two");
  assert.equal(cockpitActionMessage({ statusCode: 503 }, "Retry"), "Retry");
});
