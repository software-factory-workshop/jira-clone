import { defineOAuthHandler } from "../../utils/oauthPersistence";
import { resolveAppActor } from "../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../utils/passportIdentity";
import {
  OAUTH_BOUNDARY,
  oauthBeginGrant,
  oauthTokenClientById,
  resolveOAuthIssuer,
} from "../../utils/jiraOAuth";
import { prefersHtml, renderConsentPage } from "../../utils/oauthConsentPage";

/**
 * Demo-only authorization entry: GET /api/oauth/authorize?... starts an
 * authorization-code grant with mandatory PKCE S256.
 *
 * Identity is server-derived only: the platform-injected Passport header
 * (or the non-production `PASSPORT_DEV_USER` stand-in) resolves through
 * the shared account authority; the labelled `x-demo-user` fallback keeps
 * the local workshop running. Any caller-supplied user id in the query is
 * ignored: the grant ticket binds the resolved account. Returns a JSON
 * grant ticket plus the browser consent path (the consent decision itself
 * is a JSON POST, so the browser UI path stays separate from the machine
 * token routes). A browser that prefers HTML gets the consent page
 * instead, which performs that same POST and forwards to the client.
 */
export default defineOAuthHandler((event) => {
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
  setHeader(event, "Cache-Control", "no-store");
  if (prefersHtml(getHeader(event, "accept"))) {
    const ticket = result.ticket;
    const client = oauthTokenClientById(ticket.client_id);
    setHeader(event, "Content-Type", "text/html; charset=utf-8");
    return renderConsentPage({
      grantTicket: ticket.grant_ticket,
      clientId: ticket.client_id,
      clientName: client.ok ? client.client.clientName : null,
      redirectUri: ticket.redirect_uri,
      scopes: ticket.scope.split(" ").filter(Boolean),
      state: ticket.state,
      account: { label: ticket.account.label, role: ticket.account.role },
      consentPath: ticket.consent_path,
      expiresInSeconds: ticket.expires_in,
    });
  }
  setHeader(event, "Content-Type", "application/json");
  return {
    ...result.ticket,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    boundary: OAUTH_BOUNDARY,
  };
});
