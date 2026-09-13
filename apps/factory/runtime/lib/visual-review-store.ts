import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { get, put } from "@vercel/blob";
import type { BrowserFrame, BrowserObservation } from "./review-browser.ts";
import type { VisualReviewApp, VisualReviewArtifact, VisualReviewFrame } from "./visual-review.ts";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const artifactIdPattern = /^[a-f0-9]{32}$/;
const phasePattern = /^(before|after)$/;

interface StoredFrame {
  path: string;
  sha256: string;
  mediaType: VisualReviewFrame["mediaType"];
}

interface VisualArtifactManifest {
  version: 1;
  artifactId: string;
  tokenHash: string;
  frames: Partial<Record<"before" | "after", StoredFrame>>;
}

function artifactId(input: { sessionId: string; headSha: string; app: VisualReviewApp; route: string }) {
  return createHash("sha256").update(JSON.stringify([input.sessionId, input.headSha, input.app, input.route])).digest("hex").slice(0, 32);
}

// Frames live in private Blob (BLOB_READ_WRITE_TOKEN must be available to the
// factory service). Set FACTORY_PUBLIC_URL when PR frame links need a stable
// public origin instead of the per-deployment VERCEL_URL.
function origin() {
  const configured = process.env.FACTORY_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
}

function pathFor(id: string) {
  if (!artifactIdPattern.test(id)) throw new Error("Invalid visual artifact ID.");
  return `factory/review-artifacts/${id}`;
}

function manifestPath(id: string) {
  return `${pathFor(id)}/manifest.json`;
}

function framePath(id: string, phase: "before" | "after", mediaType: VisualReviewFrame["mediaType"]) {
  const extension = mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : "png";
  return `${pathFor(id)}/${phase}.${extension}`;
}

function parseImage(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=_-]+)$/.exec(dataUrl);
  if (!match) throw new Error("Visual frame is not a supported base64 image.");
  const mediaType = match[1] as VisualReviewFrame["mediaType"];
  const content = Buffer.from(match[2]!, "base64");
  if (!content.length || content.length > MAX_IMAGE_BYTES) throw new Error("Visual frame exceeds the 4 MB limit.");
  return { mediaType, content, sha256: createHash("sha256").update(content).digest("hex") };
}

function frameUrl(id: string, token: string, phase: "before" | "after") {
  return `${origin()}/factory/review-artifacts/${id}/${token}?phase=${phase}`;
}

async function readManifest(id: string): Promise<VisualArtifactManifest | undefined> {
  const response = await get(manifestPath(id), { access: "private", useCache: false, headers: { "accept-encoding": "identity" } });
  if (!response?.stream || response.statusCode !== 200) return undefined;
  const value = await new Response(response.stream).json();
  if (!value || value.version !== 1 || value.artifactId !== id || typeof value.tokenHash !== "string" || !value.frames) return undefined;
  return value as VisualArtifactManifest;
}

export async function storeVisualArtifact(input: {
  app: VisualReviewApp;
  origin: string;
  route: string;
  baseSha: string;
  headSha: string;
  targetBranch: string;
  sessionId: string;
  capturedAt: string;
  frames: Partial<Record<"before" | "after", BrowserFrame>>;
}): Promise<VisualReviewArtifact> {
  const id = artifactId(input);
  const token = randomBytes(32).toString("base64url");
  const stored: Partial<Record<"before" | "after", StoredFrame>> = {};
  const output: Partial<Record<"before" | "after", VisualReviewFrame>> = {};
  for (const phase of ["before", "after"] as const) {
    const frame = input.frames[phase];
    if (!frame) continue;
    if (frame.route !== input.route) throw new Error("Visual frames must use the same route.");
    const expectedSource = phase === "before" ? "base" : "head";
    const expectedSourceSha = phase === "before" ? input.baseSha : input.headSha;
    if (frame.source && frame.source !== expectedSource) throw new Error(`The ${phase} visual frame is bound to the wrong source.`);
    if (frame.sourceSha && frame.sourceSha !== expectedSourceSha) throw new Error(`The ${phase} visual frame is bound to the wrong revision.`);
    const image = parseImage(frame.dataUrl);
    const path = framePath(id, phase, image.mediaType);
    await put(path, image.content, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: image.mediaType });
    stored[phase] = { path, sha256: image.sha256, mediaType: image.mediaType };
    output[phase] = { phase, source: frame.source || expectedSource, sourceSha: frame.sourceSha || expectedSourceSha, url: frameUrl(id, token, phase), sha256: image.sha256, mediaType: image.mediaType };
  }
  await put(manifestPath(id), JSON.stringify({ version: 1, artifactId: id, tokenHash: createHash("sha256").update(token).digest("hex"), frames: stored } satisfies VisualArtifactManifest), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  return { id, app: input.app, origin: input.origin, route: input.route, baseSha: input.baseSha, headSha: input.headSha, targetBranch: input.targetBranch, capturedAt: input.capturedAt, ...output };
}

export async function storeBrowserComparison(input: {
  app: VisualReviewApp;
  beforeObservation?: BrowserObservation;
  afterObservation?: BrowserObservation;
  baseSha: string;
  headSha: string;
  targetBranch: string;
}): Promise<VisualReviewArtifact | undefined> {
  const before = input.beforeObservation?.frames?.before;
  const after = input.afterObservation?.frames?.after;
  if (!before && !after) return undefined;
  if (input.beforeObservation && input.beforeObservation.headSha !== input.baseSha) throw new Error("The base visual observation is bound to a different revision.");
  if (input.afterObservation && input.afterObservation.headSha !== input.headSha) throw new Error("The candidate visual observation is bound to a different revision.");
  if (input.beforeObservation && input.afterObservation && input.beforeObservation.sessionId !== input.afterObservation.sessionId) throw new Error("Visual observations must use the same reviewer session.");
  const route = before?.route || after?.route;
  if (!route) return undefined;
  if (before && after && before.route !== after.route) throw new Error("Visual frames must use the same route.");
  return storeVisualArtifact({ app: input.app, origin: input.afterObservation?.origin || input.beforeObservation!.origin, route, baseSha: input.baseSha, headSha: input.headSha, targetBranch: input.targetBranch, sessionId: input.afterObservation?.sessionId || input.beforeObservation!.sessionId, capturedAt: new Date().toISOString(), frames: { before, after } });
}

export async function storeBrowserObservation(input: {
  app: VisualReviewApp;
  observation: BrowserObservation;
  baseSha: string;
  targetBranch: string;
}): Promise<VisualReviewArtifact | undefined> {
  return storeBrowserComparison({ app: input.app, afterObservation: input.observation, baseSha: input.baseSha, headSha: input.observation.headSha, targetBranch: input.targetBranch });
}

export async function readVisualFrame(id: string, token: string, phase: string) {
  if (!artifactIdPattern.test(id) || !token || !phasePattern.test(phase)) return undefined;
  const manifest = await readManifest(id);
  if (!manifest) return undefined;
  const expected = Buffer.from(manifest.tokenHash, "hex");
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;
  const frame = manifest.frames[phase as "before" | "after"];
  if (!frame) return undefined;
  const response = await get(frame.path, { access: "private", useCache: false, headers: { "accept-encoding": "identity" } });
  if (!response?.stream || response.statusCode !== 200) return undefined;
  return { stream: response.stream, mediaType: frame.mediaType, sha256: frame.sha256 };
}
