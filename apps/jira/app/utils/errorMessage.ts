function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Prefer a server-provided message over the generic transport error. */
export function serverMessage(error: unknown, fallback: string): string {
  if (isRecord(error) && isRecord(error.data)) {
    const message = error.data.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
