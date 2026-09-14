import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, prefersHtml, renderConsentPage } from "../server/utils/oauthConsentPage.ts";

test("consent page: only browser-style Accept headers get HTML", () => {
  assert.equal(prefersHtml(undefined), false);
  assert.equal(prefersHtml("application/json"), false);
  assert.equal(prefersHtml("text/html,application/xhtml+xml,*/*;q=0.8"), true);
  assert.equal(prefersHtml("application/json, text/html"), false);
});

test("consent page: renders escaped ticket data, both decisions and the consent POST", () => {
  const html = renderConsentPage({
    grantTicket: "demo_grant_1",
    clientId: "demo_client_<x>",
    clientName: 'Connect "demo"',
    redirectUri: "https://connect.vercel.com/callback",
    scopes: ["read"],
    state: "abc</script>",
    account: { label: "Workshop Instructor", role: "viewer" },
    consentPath: "/api/oauth/consent",
    expiresInSeconds: 300,
  });
  assert.match(html, /demo_client_&lt;x&gt;/);
  assert.match(html, /Connect &quot;demo&quot;/);
  assert.doesNotMatch(html, /abc<\/script>/);
  assert.match(html, /\\u003c\/script>/);
  assert.match(html, /id="approve"/);
  assert.match(html, /id="deny"/);
  assert.match(html, /access_denied/);
  assert.match(html, /https:\/\/connect\.vercel\.com/);
  assert.equal(escapeHtml("<a href='x'>&</a>"), "&lt;a href=&#39;x&#39;&gt;&amp;&lt;/a&gt;");
});
