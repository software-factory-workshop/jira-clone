/**
 * Dependency-free, framework-agnostic Vercel Passport identity helper.
 *
 * Reads only the trusted `x-vercel-oidc-passport-token` request header that
 * the platform injects (Vercel strips spoofed Passport headers). The token
 * is treated as already verified by the platform: this helper only decodes
 * the payload segment, requires a stable `external_sub`, and exposes
 * nullable `email`/`displayName` plus the raw claims. It never verifies
 * signatures itself, never returns or logs the raw token, and never keys an
 * account by email.
 *
 * Fails closed: a present-but-undecodable token, a non-object payload, or a
 * missing/blank `external_sub` is an error, never a fallback identity.
 *
 * Local development stand-in: `PASSPORT_DEV_USER` is honoured only when the
 * environment is non-production (see `readPassportIdentity`). It accepts a
 * JSON object string with `external_sub` (or `sub`) plus optional
 * `email`/`name`/`groups`/`role`, or a bare subject string. It is ignored in
 * production.
 *
 * Deployment prerequisite (external): Vercel Passport deployment protection
 * is managed outside this demo and is not enabled by this code. Without that
 * platform protection there is no trusted Passport header to read.
 */

export const PASSPORT_TOKEN_HEADER = "x-vercel-oidc-passport-token";

export const PASSPORT_DEV_USER_ENV = "PASSPORT_DEV_USER";

export const PASSPORT_DEPLOYMENT_NOTE =
  "Vercel Passport deployment protection is an external prerequisite managed outside this demo; " +
  "this code only reads the platform-injected verified token header and never enables Passport on a Vercel project.";

export type PassportClaims = Record<string, unknown>;

export type PassportIdentity = {
  /** Stable platform subject. The only key an account may be derived from. */
  externalSub: string;
  email: string | null;
  displayName: string | null;
  claims: PassportClaims;
  /** True only for the non-production PASSPORT_DEV_USER stand-in. */
  dev: boolean;
};

export type PassportRead =
  | { present: false }
  | { present: true; ok: true; identity: PassportIdentity }
  | { present: true; ok: false; statusCode: 401; error: string };

export function isProductionEnv(nodeEnv: unknown): boolean {
  return nodeEnv === "production";
}

function base64UrlDecodeToString(segment: string): string {
  let normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  if (remainder === 2) {
    normalized += "==";
  } else if (remainder === 3) {
    normalized += "=";
  } else if (remainder !== 0) {
    throw new Error("Invalid base64url length.");
  }
  const scope = globalThis as {
    Buffer?: {
      from(input: string, encoding: string): { toString(encoding: string): string };
    };
    atob?: (input: string) => string;
  };
  if (scope.Buffer) {
    return scope.Buffer.from(normalized, "base64").toString("utf8");
  }
  if (typeof scope.atob === "function") {
    const binary = scope.atob(normalized);
    let encoded = "";
    for (let i = 0; i < binary.length; i += 1) {
      encoded += `%${binary.charCodeAt(i).toString(16).padStart(2, "0")}`;
    }
    return decodeURIComponent(encoded);
  }
  throw new Error("No base64 decoder available.");
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function claimsToIdentity(claims: PassportClaims, dev: boolean): PassportRead {
  const externalSub = nonEmptyString(claims["external_sub"]);
  if (!externalSub) {
    return {
      present: true,
      ok: false,
      statusCode: 401,
      error:
        "Invalid Passport identity: the verified token payload has no stable external_sub. " +
        "No account was derived and nothing was written.",
    };
  }
  return {
    present: true,
    ok: true,
    identity: {
      externalSub,
      email: nonEmptyString(claims["email"]),
      displayName:
        nonEmptyString(claims["name"]) ??
        nonEmptyString(claims["preferred_username"]),
      claims,
      dev,
    },
  };
}

function decodeTokenPayload(token: string): PassportRead {
  const parts = token.split(".");
  if (parts.length < 2 || parts.length > 3 || (parts[1] ?? "") === "") {
    return {
      present: true,
      ok: false,
      statusCode: 401,
      error:
        "Invalid Passport identity: the platform token is not a decodable signed-looking JWT payload. " +
        "No account was derived and nothing was written.",
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecodeToString(parts[1]!));
  } catch {
    return {
      present: true,
      ok: false,
      statusCode: 401,
      error:
        "Invalid Passport identity: the platform token payload could not be decoded as JSON. " +
        "No account was derived and nothing was written.",
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      present: true,
      ok: false,
      statusCode: 401,
      error:
        "Invalid Passport identity: the platform token payload is not a claims object. " +
        "No account was derived and nothing was written.",
    };
  }
  return claimsToIdentity(parsed as PassportClaims, false);
}

type DevUserParsed = PassportClaims | { error: string } | null;
/**
 * Parse the non-production PASSPORT_DEV_USER stand-in. Returns `null` when
 * the value is absent/blank (caller treats it as no identity), a claims
 * object for a usable stand-in, or an error object for a malformed value.
 */
function parseDevUser(devUser: unknown): DevUserParsed {
  if (devUser === undefined || devUser === null) {
    return null;
  }
  if (typeof devUser !== "string" || devUser.trim() === "") {
    return null;
  }
  const trimmed = devUser.trim();
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        error:
          "Invalid PASSPORT_DEV_USER: expected a JSON object with external_sub (or sub). " +
          "No account was derived and nothing was written.",
      };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        error:
          "Invalid PASSPORT_DEV_USER: expected a JSON object with external_sub (or sub). " +
          "No account was derived and nothing was written.",
      };
    }
    const record = parsed as Record<string, unknown>;
    const subject =
      nonEmptyString(record["external_sub"]) ?? nonEmptyString(record["sub"]);
    if (!subject) {
      return {
        error:
          "Invalid PASSPORT_DEV_USER: the object has no stable external_sub (or sub). " +
          "No account was derived and nothing was written.",
      };
    }
    return { ...record, external_sub: subject };
  }
  return { external_sub: trimmed };
}

export type PassportReadInput = {
  /** Raw `x-vercel-oidc-passport-token` header value. */
  token?: unknown;
  /** Raw `PASSPORT_DEV_USER` value; honoured only outside production. */
  devUser?: unknown;
  /** `process.env.NODE_ENV` from the caller; tests pass this explicitly. */
  nodeEnv?: unknown;
};

/**
 * Read the Passport identity for one request. The trusted header wins; the
 * dev stand-in applies only when no header is present and the environment is
 * non-production. Absence is `{ present: false }`; any present-but-invalid
 * identity fails closed with a 401 that carries no token material.
 */
export function readPassportIdentity(input: PassportReadInput): PassportRead {
  const { token, devUser, nodeEnv } = input;
  if (token === undefined || token === null) {
    if (isProductionEnv(nodeEnv)) {
      return { present: false };
    }
    const dev = parseDevUser(devUser);
    if (dev === null) {
      return { present: false };
    }
    if (typeof dev === "object" && "error" in (dev as Record<string, unknown>)) {
      return {
        present: true,
        ok: false,
        statusCode: 401,
        error: (dev as { error: string }).error,
      };
    }
    return claimsToIdentity(dev as PassportClaims, true);
  }
  if (typeof token !== "string" || token.trim() === "") {
    if (typeof token === "string") {
      return { present: false };
    }
    return {
      present: true,
      ok: false,
      statusCode: 401,
      error:
        "Invalid Passport identity: the platform token header is malformed. " +
        "No account was derived and nothing was written.",
    };
  }
  return decodeTokenPayload(token);
}
