import { resolveAppActor } from "../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../utils/passportIdentity";
import {
  OAUTH_BOUNDARY,
  OAUTH_ISSUER_PATH,
  oauthBeginGrant,
  resolveOAuthIssuer,
} from "../../utils/jiraOAuth";

/**
 * Demo-only authorization entry: GET /api/oauth/authorize?... starts an
 * authorization-code grant with mandatory PKCE S256.
 *
 * Identity is server-derived only: the platform-injected Passport header
 * (or the non-production `PASSPORT_DEV_USER` stand-in) resolves through
 * the shared account authority; the labelled `x-demo-user` fallback keeps
 * the local workshop running. Any caller-supplied user id in the query is
 * ignored: the grant ticket binds the resolved account.
 *
 * Two response shapes share this entry, chosen by content negotiation:
 * - Browsers (`Accept: text/html`, no `format=json` query parameter) get a
 *   clearly labelled demo-only consent page tied to the server-derived
 *   account and the requested scopes. Its approve/deny form posts to the
 *   browser decision path, which redirects (never JSON) to the registered
 *   redirect_uri with the one-time code (approval) or an OAuth error
 *   (denial). There is no auto-approval: the grant ticket alone authorizes
 *   nothing until the form is submitted.
 * - Machine clients (`format=json`, `Accept: application/json`, or any
 *   other non-HTML accept) get the JSON grant ticket plus the browser
 *   consent path, as before. The JSON consent POST stays machine-readable.
 */
export default defineEventHandler((event) => {
  const issuer = resolveOAuthIssuer({
    envIssuer: process.env.JIRA_OAUTH_ISSUER,
    proto: getHeader(event, "x-forwarded-proto") ?? undefined,
    host: getHeader(event, "x-forwarded-host") ?? getHeader(event, "host"),
  });
  const resolved = resolveAppActor({
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  });
  if (!resolved.ok) {
    throw createError({
      statusCode: resolved.statusCode,
      message: resolved.error,
      data: { demoOnly: true, roleMatrix: DEMO_ROLE_MATRIX_LABEL, boundary: OAUTH_BOUNDARY },
    });
  }
  const query = getQuery(event) as Record<string, unknown>;
  let result: ReturnType<typeof oauthBeginGrant>;
  try {
    result = oauthBeginGrant(query, resolved.account, issuer);
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Demo-only OAuth authorization is unavailable.",
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  if (!result.ok) {
    const redirectUri =
      typeof query["redirect_uri"] === "string" && query["redirect_uri"] !== ""
        ? query["redirect_uri"]
        : null;
    throw createError({
      statusCode: result.statusCode,
      message: `${result.error}: ${result.errorDescription}`,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: OAUTH_BOUNDARY,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      },
    });
  }
  const wantsHtml = oauthWantsBrowserPage(event, query);
  if (wantsHtml) {
    return oauthConsentPage(event, result.ticket);
  }
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "no-store");
  return {
    ...result.ticket,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    boundary: OAUTH_BOUNDARY,
  };
});

/**
 * Browsers get the consent page; machine clients keep the JSON ticket.
 * An explicit `format=json` query parameter always forces JSON (so scripts
 * behind a browser user-agent stay machine-readable); otherwise an
 * `Accept: text/html` header selects the consent page.
 */
function oauthWantsBrowserPage(
  event: Parameters<Parameters<typeof defineEventHandler>[0]>[0],
  query: Record<string, unknown>,
): boolean {
  if (query["format"] === "json") {
    return false;
  }
  const accept = getHeader(event, "accept") ?? "";
  return accept.toLowerCase().includes("text/html");
}

/** Escape one value for the labelled consent HTML below. Pure. */
function oauthEscapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render the clearly labelled demo-only browser consent page for a valid
 * grant ticket. The page names the requesting client, the server-derived
 * account (never a caller-supplied id) and the requested scopes; the
 * approve/deny form posts only the one-time grant ticket plus the decision
 * to the browser decision path. No secret, token or code appears in the
 * HTML: the ticket is the only credential and it authorizes nothing until
 * the form is submitted.
 */
function oauthConsentPage(
  event: Parameters<Parameters<typeof defineEventHandler>[0]>[0],
  ticket: {
    grant_ticket: string;
    client_id: string;
    client_name: string;
    redirect_uri: string;
    scope: string;
    state: string | null;
    resource: string | null;
    expires_in: number;
    consent_path: string;
    account: { accountId: string; label: string; role: string; identitySource: string };
  },
): string {
  const decisionPath = `${OAUTH_ISSUER_PATH}/consent/decision`;
  const text = oauthEscapeHtml;
  const accountLine = `${ticket.account.label} (${ticket.account.role})`;
  const identityLine =
    ticket.account.identitySource === "passport"
      ? "Verified platform (Passport) identity, resolved server-side."
      : "Local demo stand-in identity (x-demo-user fallback), resolved server-side.";
  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  setHeader(event, "Cache-Control", "no-store");
  setHeader(event, "X-Content-Type-Options", "nosniff");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Demo-only OAuth consent · ADEO Jira demo</title>
</head>
<body>
<main>
<h1>Demo-only OAuth consent · ADEO Jira demo</h1>
<p><strong>This is a non-production demo authorization page.</strong> ${text(OAUTH_BOUNDARY)}</p>
<section aria-label="Authorization request">
<h2>Authorization request</h2>
<dl>
<dt>Requesting application</dt><dd>${text(ticket.client_name)} (${text(ticket.client_id)})</dd>
<dt>Acting demo account (server-derived)</dt><dd>${text(accountLine)}</dd>
<dt>Identity source (server-derived)</dt><dd>${text(identityLine)}</dd>
<dt>Requested demo scopes</dt><dd>${text(ticket.scope)}</dd>
<dt>Redirect target (exactly registered)</dt><dd>${text(ticket.redirect_uri)}</dd>
${ticket.state === null ? "" : `<dt>Client state</dt><dd>${text(ticket.state)}</dd>`}
${ticket.resource === null ? "" : `<dt>Protected resource</dt><dd>${text(ticket.resource)}</dd>`}
</dl>
<p>No user id from the request was used: the grant binds the server-derived account above.</p>
</section>
<section aria-label="Consent decision">
<h2>Consent decision</h2>
<form method="post" action="${text(decisionPath)}">
<input type="hidden" name="grant_ticket" value="${text(ticket.grant_ticket)}" />
<button type="submit" name="decision" value="approve">Allow access</button>
<button type="submit" name="decision" value="deny">Deny access</button>
</form>
<p>Allowing redirects to the registered application with a one-time code; denying redirects with an OAuth error. The ticket expires in ${text(String(ticket.expires_in))} seconds and is single-use.</p>
</section>
<p>Demo role matrix: ${text(DEMO_ROLE_MATRIX_LABEL)}</p>
</main>
</body>
</html>`;
}
