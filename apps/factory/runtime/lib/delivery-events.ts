import { z } from 'zod';

export const MAX_OBSERVATION_EVENTS = 30_000;
export const OBSERVATION_IDLE_TIMEOUT_MS = 10_000;

export type DeliveryFailureKind = 'observation' | 'provider' | 'auth' | 'input' | 'target' | 'conflict' | 'unknown';

export interface ClassifiedDeliveryError {
  code: string;
  kind: DeliveryFailureKind;
  message: string;
  status: number;
  retryable: boolean;
  preservePhase: boolean;
}

function boundedMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || fallback);
  return (message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() || fallback).slice(0, 700);
}

export class DeliveryObservationError extends Error {
  readonly code: 'observation_timeout' | 'observation_partial' | 'observation_limit';

  constructor(code: DeliveryObservationError['code'], message: string) {
    super(message);
    this.name = 'DeliveryObservationError';
    this.code = code;
  }
}

export class DeliveryProviderError extends Error {
  readonly code: 'provider_unavailable' | 'provider_auth';
  readonly status?: number;

  constructor(error: unknown) {
    super(boundedMessage(error, 'The Eve session provider could not be reached.'));
    this.name = 'DeliveryProviderError';
    const status = errorStatus(error);
    this.status = status;
    this.code = status === 401 || status === 403 ? 'provider_auth' : 'provider_unavailable';
  }
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

function errorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
}

export function classifyDeliveryError(error: unknown): ClassifiedDeliveryError {
  if (error instanceof DeliveryObservationError) {
    return { code: error.code, kind: 'observation', message: boundedMessage(error, 'The Eve session could not be observed completely.'), status: 503, retryable: true, preservePhase: true };
  }

  const code = errorCode(error);
  const status = errorStatus(error);
  const message = boundedMessage(error, 'Delivery failed.');
  if (code === 'invalid_request' || error instanceof z.ZodError) return { code: 'invalid_request', kind: 'input', message, status: 400, retryable: false, preservePhase: false };
  if (code === 'target_closed' || code === 'blocked' || /pull request (?:was )?closed|retargeted/i.test(message)) return { code: 'target_closed', kind: 'target', message, status: 409, retryable: false, preservePhase: false };
  if (code === 'needs_revision' || code === 'stale_head' || code === 'target_advanced') return { code, kind: 'conflict', message, status: 409, retryable: false, preservePhase: false };
  if (code === 'provider_auth' || code === 'unauthorized' || code === 'forbidden' || status === 401 || status === 403) return { code: 'provider_auth', kind: 'auth', message, status: status === 403 ? 403 : 401, retryable: false, preservePhase: true };
  if (code === 'provider_unavailable' || status === 408 || status === 429 || (status !== undefined && status >= 500) || error instanceof TypeError) return { code: 'provider_unavailable', kind: 'provider', message, status: status === 429 ? 429 : 502, retryable: true, preservePhase: true };
  return { code: code || 'delivery_failed', kind: 'unknown', message, status: 500, retryable: false, preservePhase: true };
}

type EventSession = {
  getStreamTailIndex(): Promise<number>;
  getEventStream(options: { startIndex: number }): Promise<ReadableStream<unknown>>;
};

type ObservationOptions = { idleTimeoutMs?: number; maxEvents?: number };

async function cancelReader(reader: ReadableStreamDefaultReader<unknown>) {
  await reader.cancel().catch(() => undefined);
}

async function readWithIdleTimeout(reader: ReadableStreamDefaultReader<unknown>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DeliveryObservationError('observation_timeout', 'Session observation exceeded its idle deadline; no partial result accepted.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function snapshotEvents(session: EventSession, options: ObservationOptions = {}) {
  const maxEvents = options.maxEvents ?? MAX_OBSERVATION_EVENTS;
  const idleTimeoutMs = options.idleTimeoutMs ?? OBSERVATION_IDLE_TIMEOUT_MS;
  let tail: number;
  try {
    tail = await session.getStreamTailIndex();
  } catch (error) {
    throw new DeliveryProviderError(error);
  }
  if (!Number.isInteger(tail) || tail < -1) throw new DeliveryObservationError('observation_partial', 'Eve returned an invalid stream tail; no partial result accepted.');
  if (tail + 1 > maxEvents) throw new DeliveryObservationError('observation_limit', `Session history exceeds the ${maxEvents}-event delivery observation limit; no partial result accepted.`);

  let stream: ReadableStream<unknown>;
  try {
    stream = await session.getEventStream({ startIndex: 0 });
  } catch (error) {
    throw new DeliveryProviderError(error);
  }
  const reader = stream.getReader();
  const events: unknown[] = [];
  try {
    for (let index = 0; index <= tail; index += 1) {
      let item: ReadableStreamReadResult<unknown>;
      try {
        item = await readWithIdleTimeout(reader, idleTimeoutMs);
      } catch (error) {
        await cancelReader(reader);
        if (error instanceof DeliveryObservationError) throw error;
        throw new DeliveryProviderError(error);
      }
      if (item.done) throw new DeliveryObservationError('observation_partial', 'Session observation ended before the captured Eve stream tail; no partial result accepted.');
      events.push(item.value);
    }
    return events;
  } finally {
    await cancelReader(reader);
  }
}

export const resultEvent = z.object({
  type: z.literal('action.result'),
  data: z.object({
    status: z.literal('completed'),
    result: z.object({ kind: z.literal('tool-result'), toolName: z.string(), isError: z.literal(false).optional(), output: z.unknown() }),
  }),
});

export function childIn(events: unknown[]) {
  for (const event of [...events].reverse()) {
    const parsed = z.object({ type: z.literal('subagent.called'), data: z.object({ childSessionId: z.string() }) }).safeParse(event);
    if (parsed.success) return parsed.data.data.childSessionId;
  }
}

export function hostResult(events: unknown[], tool: string, sessionId: string, operationId?: string) {
  for (const event of [...events].reverse()) {
    const parsed = resultEvent.safeParse(event);
    if (!parsed.success) continue;
    const envelope = parsed.data.data.result;
    let value = envelope.output;
    if (envelope.toolName !== tool) {
      if (tool !== 'publish_work' || envelope.toolName !== 'prepare_work') continue;
      const cached = z.object({ phase: z.literal('Already published'), result: z.unknown() }).safeParse(value);
      if (!cached.success) continue;
      value = cached.data.result;
    }
    const output = z.object({ sessionId: z.literal(sessionId), operationId: z.string().optional() }).passthrough().safeParse(value);
    if (output.success && (!operationId || output.data.operationId === operationId)) return output.data;
  }
}

export function stoppedWithoutResult(events: unknown[]) {
  for (const event of [...events].reverse()) {
    const parsed = z.object({ type: z.string() }).safeParse(event);
    if (!parsed.success) continue;
    if (['turn.cancelled', 'turn.failed', 'session.failed', 'turn.completed'].includes(parsed.data.type)) return parsed.data.type;
    if (['turn.started', 'message.received'].includes(parsed.data.type)) return null;
  }
  return null;
}

export function eventsForDelivery(events: unknown[], deliveryId: string) {
  return events.filter(event => z.object({ meta: z.object({ deliveryIds: z.array(z.string()) }) }).safeParse(event).data?.meta.deliveryIds.includes(deliveryId));
}

export function resumeMessage(operationId: string) {
  return `Factory recovery ${operationId}. Continue your original authenticated task in the existing workspace. Preserve all pending changes and original scope. If repository checks were blocked by factory context, use refresh_target to incorporate the current target without losing your work, then run verify_work and publish_work. Do not bypass checks or create a replacement owner.`;
}

export function resumeReceipt(events: unknown[], operationId: string) {
  for (const event of events) {
    const parsed = z.object({ type: z.literal('message.received'), data: z.object({ message: z.literal(resumeMessage(operationId)) }), meta: z.object({ deliveryIds: z.array(z.string()).min(1) }) }).safeParse(event);
    if (parsed.success) return parsed.data.meta.deliveryIds[0];
  }
}
