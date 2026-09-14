import { test } from "node:test";
import assert from "node:assert/strict";
import { publicationBody } from "../runtime/lib/publication-body.ts";

const command = (check: string, exitCode = 0) => ({ command: `export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo; ${check}`, exitCode });

test("publication body contains reviewer prose and concise evidence without task history", () => {
  const body = publicationBody("Keep issue drafts after a failed save. Retrying now submits the same draft.", [], [command("pnpm typecheck"), command("pnpm test"), command("pnpm --filter @jira-clone/jira test"), command("pnpm build")]);
  assert.equal(body, "Keep issue drafts after a failed save. Retrying now submits the same draft.\n\n## Validation\n\n- `pnpm typecheck`: passed\n- `pnpm test`: passed\n- `pnpm --filter @jira-clone/jira test`: passed\n- `pnpm build`: passed");
  assert.doesNotMatch(body, /Original task|Requested revision|Native Eve session|Source:|export PATH|None reported/);
});

test("failed checks and substantive limitations remain visible", () => {
  const body = publicationBody("Preserve issue drafts.", ["Browser verification is still required.", " "], [command("pnpm test", 1)]);
  assert.match(body, /`pnpm test`: failed \(exit 1\)/);
  assert.match(body, /## Limitations\n\n- Browser verification is still required\./);
});

test("host browser evidence is included without embedding frame data", () => {
  const body = publicationBody("Preserve issue drafts.", [], [command("pnpm test")], {
    complete: false,
    observations: [{
      origin: "http://127.0.0.1:3001",
      headSha: "a".repeat(40),
      sessionId: "wrun_worker",
      source: "head",
      snapshot: true,
      interaction: true,
      keyboard: false,
      screenshot: true,
      afterInteraction: false,
      route: "/issues?view=`open`",
      eventIds: ["event-1"],
    }],
  });

  assert.match(body, /## Browser evidence/);
  assert.match(body, /Status: partial/);
  assert.match(body, /keyboard no/);
  assert.match(body, /route `\/issues\?view='open'`/);
  assert.doesNotMatch(body, /data:image|event-1/);
});
