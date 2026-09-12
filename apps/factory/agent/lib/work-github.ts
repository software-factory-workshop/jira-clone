import { createHash } from "node:crypto";
import { z } from "zod";
import { includeSource, repository } from "./github.mjs";

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const object = z.record(z.string(), z.unknown());
const treeItem = z.object({ path: z.string(), mode: z.string(), type: z.string(), sha, size: z.number().optional() });
export const MAX_WORK_CHANGES = 30;
export const MAX_WORK_FILE_BYTES = 500_000;
export const MAX_WORK_BYTES = 2_000_000;
export interface WorkEntry { file: string; content: Buffer; mode: "100644" | "100755" }
export interface WorkSnapshot { revision: string; treeSha: string; entries: WorkEntry[]; excludedPaths: string[] }
export interface WorkChange { path: string; content: string | null }
export interface PublishWorkInput { sessionId: string; baseSha: string; title: string; body: string; changes: WorkChange[] }
class GitHubError extends Error { readonly status: number; constructor(status: number) { super(`Factory GitHub request failed: HTTP ${status}.`); this.status = status; } }
function safePath(path: string) { return path.length > 0 && path.length <= 300 && !path.startsWith("/") && !/[\\\x00-\x1f\x7f]/.test(path) && path.split("/").every(part => part !== "" && part !== "." && part !== ".."); }
export function allowedWorkPath(path: string): boolean {
  if (!safePath(path) || !includeSource(path)) return false;
  if (!["apps/factory/app/", "apps/factory/tests/", "apps/jira/app/", "apps/jira/tests/", "docs/"].some(prefix => path.startsWith(prefix))) return false;
  const name = path.split("/").at(-1)!;
  if (["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json"].includes(name) || /^tsconfig(?:[.-].*)?\.json$/.test(name) || /\.config\.[cm]?[jt]s$/.test(name)) return false;
  if (path.split("/").some(part => ["server", "middleware", "modules"].includes(part))) return false;
  if (path.split("/").some(part => ["AGENTS.md", "CLAUDE.md", "SKILL.md", ".npmrc", ".output", ".nuxt", "dist", "coverage"].includes(part))) return false;
  return ![".agents/", ".github/", "factory/", "apps/factory/agent/", "apps/factory/scripts/", "vendor/"].some(prefix => path.startsWith(prefix));
}
async function request(token: string, path: string, signal?: AbortSignal, body?: unknown) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    method: body === undefined ? "GET" : "POST", redirect: "error",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(20000)]),
  });
  if (!response.ok) throw new GitHubError(response.status);
  return { data: await response.json(), next: response.headers.get("link")?.includes('rel="next"') || false };
}
async function commitTree(token: string, revision: string, signal?: AbortSignal) {
  if (revision !== "main") sha.parse(revision);
  const commit = z.object({ sha, commit: z.object({ tree: z.object({ sha }) }) }).parse((await request(token, `commits/${revision}`, signal)).data);
  if (revision !== "main" && commit.sha !== revision) throw new Error("GitHub returned a different commit.");
  const tree = z.object({ truncated: z.boolean(), tree: z.array(treeItem) }).parse((await request(token, `git/trees/${commit.commit.tree.sha}?recursive=1`, signal)).data);
  if (tree.truncated || tree.tree.length > 5000) throw new Error("Repository tree is incomplete or exceeds the station limit.");
  return { revision: commit.sha, treeSha: commit.commit.tree.sha, tree: tree.tree };
}
export async function loadWorkSnapshot(token: string, revision: string = "main", signal?: AbortSignal): Promise<WorkSnapshot> {
  const source = await commitTree(token, revision, signal);
  const selected = source.tree.filter(item => item.type === "blob" && ["100644", "100755"].includes(item.mode) && safePath(item.path) && includeSource(item.path));
  if (selected.length > 1500 || selected.reduce((sum, item) => sum + (item.size || 0), 0) > 50_000_000) throw new Error("Source snapshot exceeds the station limit.");
  const entries: WorkEntry[] = [];
  for (let offset = 0; offset < selected.length; offset += 8) entries.push(...await Promise.all(selected.slice(offset, offset + 8).map(async item => {
    const blob = z.object({ encoding: z.literal("base64"), content: z.string() }).parse((await request(token, `git/blobs/${item.sha}`, signal)).data);
    const content = Buffer.from(blob.content, "base64");
    if (content.length > 50_000_000) throw new Error("Source blob exceeds station limit.");
    return { file: item.path, content, mode: item.mode as WorkEntry["mode"] };
  })));
  return { revision: source.revision, treeSha: source.treeSha, entries, excludedPaths: source.tree.filter(item => item.type !== "tree" && !selected.includes(item)).map(item => item.path) };
}
const pullSchema = z.object({ number: z.number().int().positive(), html_url: z.string().url(), title: z.string(), body: z.string().nullable(), state: z.string(), draft: z.boolean().optional(), head: z.object({ sha, ref: z.string(), repo: z.object({ full_name: z.literal(repository) }) }), base: z.object({ sha, ref: z.literal("main"), repo: z.object({ full_name: z.literal(repository) }) }) });
async function readPull(token: string, number: number, signal?: AbortSignal) {
  z.number().int().positive().parse(number);
  const pr = pullSchema.parse((await request(token, `pulls/${number}`, signal)).data);
  if (pr.number !== number) throw new Error("GitHub returned a different pull request.");
  return pr;
}
export async function verifyPullRequestHead(token: string, number: number, headSha: string, signal?: AbortSignal, baseSha?: string) {
  sha.parse(headSha);
  if (baseSha) sha.parse(baseSha);
  const pr = await readPull(token, number, signal);
  if (pr.state !== "open" || pr.head.sha !== headSha || (baseSha && pr.base.sha !== baseSha)) throw new Error("Pull request changed or closed; start a fresh review.");
  return true;
}
export async function loadPullRequest(token: string, number: number, signal?: AbortSignal) {
  const pr = await readPull(token, number, signal);
  if (pr.state !== "open") throw new Error("Review requires an open pull request.");
  const files: Array<{ filename: string; status: string; patch?: string; previous_filename?: string }> = [];
  for (let page = 1; page <= 5; page++) {
    const response = await request(token, `pulls/${number}/files?per_page=100&page=${page}`, signal);
    files.push(...z.array(z.object({ filename: z.string(), status: z.string(), patch: z.string().optional(), previous_filename: z.string().optional() })).parse(response.data));
    if (!response.next) break;
    if (page === 5) throw new Error("Pull request file inventory exceeds the bounded review limit.");
  }
  const [snapshot, baseSnapshot] = await Promise.all([loadWorkSnapshot(token, pr.head.sha, signal), loadWorkSnapshot(token, pr.base.sha, signal)]);
  await verifyPullRequestHead(token, number, pr.head.sha, signal, pr.base.sha);
  const availableHead = new Set(snapshot.entries.map(entry => entry.file));
  const availableBase = new Set(baseSnapshot.entries.map(entry => entry.file));
  const contextGaps = files.filter(file => (file.status !== "removed" && !availableHead.has(file.filename)) || (file.status !== "added" && !availableBase.has(file.previous_filename || file.filename))).map(file => `Full review content unavailable for ${file.filename}; excluded, symlink or unsupported source.`);
  return { contextGaps, number: pr.number, url: pr.html_url, title: pr.title, body: pr.body || "", baseSha: pr.base.sha, headSha: pr.head.sha, headRef: pr.head.ref, files, snapshot, baseSnapshot };
}
export function workBranch(sessionId: string) {
  z.string().min(1).max(200).parse(sessionId);
  return `factory/work-${createHash("sha256").update(sessionId).digest("hex").slice(0, 24)}`;
}
export async function publishWork(token: string, input: PublishWorkInput, signal?: AbortSignal) {
  sha.parse(input.baseSha);
  z.string().trim().min(1).max(200).parse(input.title);
  z.string().max(50000).parse(input.body);
  if (!input.changes.length || input.changes.length > MAX_WORK_CHANGES) throw new Error("Publish requires 1–30 changed files.");
  let bytes = 0;
  const paths = new Set<string>();
  for (const change of input.changes) {
    if (!allowedWorkPath(change.path) || paths.has(change.path)) throw new Error(`Disallowed or duplicate work path: ${change.path}`);
    paths.add(change.path);
    if (change.content !== null) {
      if (typeof change.content !== "string" || change.content.includes("\0")) throw new Error("Publication supports text files only.");
      const size = Buffer.byteLength(change.content); bytes += size;
      if (size > MAX_WORK_FILE_BYTES || bytes > MAX_WORK_BYTES) throw new Error("Publication exceeds the file or total byte limit.");
    }
  }
  const branch = workBranch(input.sessionId);
  const source = await commitTree(token, input.baseSha, signal);
  const byPath = new Map(source.tree.map(item => [item.path, item]));
  const tree = input.changes.map(change => {
    const previous = byPath.get(change.path);
    if (previous && (previous.type !== "blob" || !["100644", "100755"].includes(previous.mode))) throw new Error("Cannot publish over symlinks, submodules or directories.");
    for (let prefix = change.path; prefix.includes("/");) {
      prefix = prefix.slice(0, prefix.lastIndexOf("/"));
      const ancestor = byPath.get(prefix);
      if (ancestor && ancestor.type !== "tree") throw new Error("Cannot publish below a non-directory Git entry.");
    }
    if (change.content === null && !previous) throw new Error("Cannot delete a file absent from the base snapshot.");
    return { path: change.path, mode: previous?.mode || "100644", type: "blob", ...(change.content === null ? { sha: null } : { content: change.content }) };
  });
  // A session publishes once. Retries may reuse exactly its own tree/commit/PR,
  // but never overwrite a branch or silently adopt a different implementation.
  const treeSha = sha.parse(object.parse((await request(token, "git/trees", signal, { base_tree: source.treeSha, tree })).data).sha);
  if (treeSha === source.treeSha) throw new Error("No changes to publish.");
  const marker = `Factory-Session: ${createHash("sha256").update(input.sessionId).digest("hex")}\nFactory-Base: ${input.baseSha}`;
  async function existingHead(): Promise<string | null> {
    let ref;
    try { ref = object.parse((await request(token, `git/ref/heads/${branch}`, signal)).data); }
    catch (error) { if (error instanceof GitHubError && error.status === 404) return null; throw error; }
    const head = sha.parse(object.parse(ref.object).sha);
    const commit = z.object({ tree: z.object({ sha }), parents: z.array(z.object({ sha })), message: z.string() }).parse((await request(token, `git/commits/${head}`, signal)).data);
    if (commit.tree.sha !== treeSha || commit.parents.length !== 1 || commit.parents[0]?.sha !== input.baseSha || !commit.message.endsWith(marker)) throw new Error("Factory branch already exists with a different head; refusing to overwrite it.");
    return head;
  }
  let headSha = await existingHead();
  if (!headSha) {
    const main = z.object({ object: z.object({ sha }) }).parse((await request(token, "git/ref/heads/main", signal)).data);
    if (main.object.sha !== input.baseSha) throw new Error("Main advanced since preparation; start a fresh worker session.");
    const created = object.parse((await request(token, "git/commits", signal, { tree: treeSha, parents: [input.baseSha], message: `factory: ${input.title}\n\n${marker}` })).data);
    headSha = sha.parse(created.sha);
    try { await request(token, "git/refs", signal, { ref: `refs/heads/${branch}`, sha: headSha }); }
    catch (error) { if (!(error instanceof GitHubError && error.status === 422)) throw error; headSha = await existingHead(); if (!headSha) throw error; }
  }
  const query = new URLSearchParams({ state: "all", head: `software-factory-workshop:${branch}`, base: "main", per_page: "100" });
  async function existingPull() {
    const response = await request(token, `pulls?${query}`, signal);
    if (response.next) throw new Error("Unexpected paginated factory branch pull requests.");
    const candidates = z.array(pullSchema).parse(response.data);
    if (candidates.length > 1) throw new Error("Ambiguous factory branch pull requests.");
    const pr = candidates[0];
    if (pr && (pr.head.sha !== headSha || pr.head.ref !== branch || pr.state !== "open")) throw new Error("Existing factory pull request changed or closed; refusing to republish.");
    return pr;
  }
  let pr = await existingPull();
  if (!pr) {
    try { pr = pullSchema.parse((await request(token, "pulls", signal, { head: branch, base: "main", title: input.title, body: `${input.body}\n\n<!-- ${marker} -->`, draft: true })).data); }
    catch (error) { if (!(error instanceof GitHubError && error.status === 422)) throw error; pr = await existingPull(); if (!pr) throw error; }
  }
  await verifyPullRequestHead(token, pr.number, headSha!, signal);
  return { branch, number: pr.number, url: pr.html_url, headSha: headSha!, baseSha: input.baseSha };
}
