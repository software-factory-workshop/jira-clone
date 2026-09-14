export type CockpitFailureKind = "conflict" | "unavailable" | "unknown";

interface FetchLikeError {
  status?: unknown;
  statusCode?: unknown;
  response?: { status?: unknown };
  data?: { error?: { code?: unknown; message?: unknown } };
}

function asFetchLikeError(value: unknown): FetchLikeError {
  return typeof value === "object" && value !== null ? value as FetchLikeError : {};
}

export function cockpitStatus(value: unknown): number | undefined {
  const error = asFetchLikeError(value);
  const candidates = [error.statusCode, error.status, error.response?.status];
  const status = candidates.find((candidate): candidate is number => typeof candidate === "number");
  return status;
}

export function cockpitFailureKind(value: unknown): CockpitFailureKind {
  const error = asFetchLikeError(value);
  if (cockpitStatus(value) === 409 || error.data?.error?.code === "conflict") return "conflict";
  if ((cockpitStatus(value) ?? 0) >= 500 || error.data?.error?.code === "unavailable") return "unavailable";
  return "unknown";
}

function responseMessage(value: unknown): string | undefined {
  const message = asFetchLikeError(value).data?.error?.message;
  if (typeof message !== "string") return undefined;
  const clean = message.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 500) : undefined;
}

export function cockpitActionMessage(value: unknown, fallback: string): string {
  return responseMessage(value) || fallback;
}

export function cockpitFailureMessage(value: unknown, subject: string): string {
  const message = responseMessage(value);
  switch (cockpitFailureKind(value)) {
    case "conflict":
      return `${subject} changed elsewhere. Refresh the latest shared version before retrying; your text is retained.`;
    case "unavailable":
      return `${subject} is temporarily unavailable. Keep your work and retry when storage recovers.`;
    default:
      return message
        ? `${subject}: ${message}`
        : `Could not update ${subject.toLowerCase()}. Your work is retained; retry when ready.`;
  }
}
