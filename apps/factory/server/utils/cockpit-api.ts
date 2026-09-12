import { randomUUID } from "node:crypto";
import {
  references,
  repository,
  stages,
  starterRequests,
  type Draft,
} from "@jira-clone/context";
import { createError, getHeader, type H3Event } from "h3";
import { z } from "zod";

export const COCKPIT_API_VERSION = "1";
export const MAX_DRAFTS = 30;

const draftIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, "must contain only letters, numbers, underscores or hyphens");
const dateSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: "must be a valid date",
});

const storedDraftSchema = z
  .object({
    id: draftIdSchema,
    title: z.string().trim().min(1).max(240),
    request: z.string().trim().min(1).max(10_000),
    updatedAt: dateSchema,
  })
  .strict();

const draftInputSchema = z
  .object({
    id: draftIdSchema.optional(),
    title: z.string().trim().min(1).max(240),
    request: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const saveDraftBodySchema = z
  .object({
    draft: draftInputSchema,
    drafts: z.unknown().optional(),
  })
  .strict();

export const restoreDraftsBodySchema = z
  .object({ drafts: z.unknown() })
  .strict();

export const issueLinkBodySchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    request: z.string().trim().min(1).max(10_000),
  })
  .strict();

export type SaveDraftBody = z.infer<typeof saveDraftBodySchema>;
export type RestoreDraftsBody = z.infer<typeof restoreDraftsBodySchema>;
export type IssueLinkBody = z.infer<typeof issueLinkBodySchema>;

export type DraftClock = {
  nextId: () => string;
  now: () => string;
};

const defaultDraftClock: DraftClock = {
  nextId: () => randomUUID(),
  now: () => new Date().toISOString(),
};

export type DraftCollection = {
  drafts: Draft[];
};

export type SavedDraft = DraftCollection & {
  draft: Draft;
};

export function normalizeDrafts(value: unknown): Draft[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((entry) => {
      const parsed = storedDraftSchema.safeParse(entry);
      if (!parsed.success) return [];
      return [
        {
          ...parsed.data,
          id: parsed.data.id.trim(),
          title: parsed.data.title.trim(),
          request: parsed.data.request.trim(),
        },
      ];
    })
    .slice(0, MAX_DRAFTS);
}

export function saveDraft(
  body: SaveDraftBody,
  clock: DraftClock = defaultDraftClock,
): SavedDraft {
  const draft: Draft = {
    id: body.draft.id ?? clock.nextId(),
    title: body.draft.title.trim(),
    request: body.draft.request.trim(),
    updatedAt: clock.now(),
  };
  const drafts = [
    draft,
    ...normalizeDrafts(body.drafts).filter((entry) => entry.id !== draft.id),
  ].slice(0, MAX_DRAFTS);

  return { draft, drafts };
}

export function removeDraft(id: string, value: unknown): DraftCollection {
  return { drafts: normalizeDrafts(value).filter((draft) => draft.id !== id) };
}

export function composeIssueLink(body: IssueLinkBody): {
  url: string;
  repository: string;
  title: string;
  request: string;
} {
  const url = new URL("/issues/new", repository.url);
  url.searchParams.set("title", body.title);
  url.searchParams.set("body", body.request);

  return {
    url: url.toString(),
    repository: repository.name,
    title: body.title,
    request: body.request,
  };
}

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ApiOperation = {
  method: ApiMethod;
  path: string;
  description: string;
};

export type CockpitSection = "mining" | "work" | "knowledge" | "growth";

export type CockpitManifest = {
  apiVersion: typeof COCKPIT_API_VERSION;
  name: string;
  repository: typeof repository;
  currentStage: (typeof stages)[number] | null;
  sections: ReadonlyArray<{
    id: CockpitSection;
    label: string;
    description: string;
  }>;
  context: {
    references: typeof references;
    stages: typeof stages;
    starters: typeof starterRequests;
  };
  resources: {
    context: ApiOperation;
    github: ApiOperation;
    drafts: {
      storage: "caller-owned";
      operations: ReadonlyArray<ApiOperation>;
      note: string;
    };
    issueReview: ApiOperation;
    investigations: {
      apiBase: string;
      operations: ReadonlyArray<ApiOperation>;
      note: string;
    };
  };
  links: {
    repository: string;
    jira: string;
  };
};

export function buildManifest(): CockpitManifest {
  const currentStage = stages.find((stage) => stage.number === repository.stage) ?? null;

  return {
    apiVersion: COCKPIT_API_VERSION,
    name: "ADEO factory cockpit",
    repository,
    currentStage,
    sections: [
      {
        id: "mining",
        label: "Task mining",
        description: "Start, resume and review a durable Eve investigation.",
      },
      {
        id: "work",
        label: "Work",
        description: "Compose and save a request for human review.",
      },
      {
        id: "knowledge",
        label: "Project knowledge",
        description: "Read the brief, design guidance and dated observations.",
      },
      {
        id: "growth",
        label: "Factory growth",
        description: "Inspect the factory stages and their current status.",
      },
    ],
    context: { references, stages, starters: starterRequests },
    resources: {
      context: {
        method: "GET",
        path: "/api/cockpit",
        description: "Return the cockpit manifest and all read-only context used by the UI.",
      },
      github: {
        method: "GET",
        path: "/api/github",
        description: "Read fixed-repository metadata through the installed GitHub Connect connection.",
      },
      drafts: {
        storage: "caller-owned",
        operations: [
          {
            method: "POST",
            path: "/api/cockpit/drafts",
            description: "Validate and save one draft into the caller's draft collection.",
          },
          {
            method: "PUT",
            path: "/api/cockpit/drafts",
            description: "Validate and normalize a caller-owned draft collection.",
          },
          {
            method: "DELETE",
            path: "/api/cockpit/drafts/{id}",
            description: "Remove one draft from a caller-owned draft collection.",
          },
        ],
        note: "The current product keeps draft contents in the browser. These endpoints return the next collection; they do not pretend to provide shared persistence.",
      },
      issueReview: {
        method: "POST",
        path: "/api/cockpit/issue-link",
        description: "Create a prefilled GitHub issue URL for the fixed workshop repository.",
      },
      investigations: {
        apiBase: "/eve/v1",
        operations: [
          {
            method: "GET",
            path: "/eve/v1/health",
            description: "Check the Eve service.",
          },
          {
            method: "GET",
            path: "/eve/v1/info",
            description: "Inspect the configured agent.",
          },
          {
            method: "POST",
            path: "/eve/v1/session",
            description: "Start an investigation with a message.",
          },
          {
            method: "POST",
            path: "/eve/v1/session/{sessionId}",
            description: "Send a follow-up message or answer a pending request.",
          },
          {
            method: "GET",
            path: "/eve/v1/session/{sessionId}/stream",
            description: "Stream progress and the durable investigation result.",
          },
          {
            method: "POST",
            path: "/eve/v1/session/{sessionId}/cancel",
            description: "Request cooperative cancellation of the active turn.",
          },
          {
            method: "POST",
            path: "/eve/v1/session/{sessionId}/reset",
            description: "Retire a session before starting a new investigation.",
          },
        ],
        note: "These routes are Eve's authenticated durable session API. The cockpit does not wrap or weaken their auth and streaming contract.",
      },
    },
    links: {
      repository: repository.url,
      jira: "https://adeo-jira-clone.vercel.app",
    },
  };
}

export function requireJsonBody(event: H3Event): void {
  const contentType = getHeader(event, "content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw createError({
      statusCode: 415,
      statusMessage: "Content-Type must be application/json",
      data: { code: "unsupported_media_type" },
    });
  }
}

export function invalidRequest(error: z.ZodError): never {
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid request body",
    data: {
      code: "invalid_request",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

export function invalidDraftId(): never {
  throw createError({
    statusCode: 400,
    statusMessage: "A valid draft ID is required",
    data: { code: "invalid_draft_id" },
  });
}

export function isValidDraftId(id: string | undefined): id is string {
  return id !== undefined && draftIdSchema.safeParse(id).success;
}
