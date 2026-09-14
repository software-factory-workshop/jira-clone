import type { BrowserObservation } from "./review-browser.ts";

/** Reviewer prose stays separate from host-owned validation and ownership metadata. */
export function publicationBody(
  summary: string,
  limitations: string[],
  checks: Array<{ command: string; exitCode: number }>,
  browserEvidence?: { complete: boolean; observations: Array<Omit<BrowserObservation, "frames">> },
) {
  const validation = checks.map(({ command, exitCode }) => {
    const label = command.replace(/^export PATH="\$HOME\/\.local\/bin:\$PATH"; cd \/workspace\/repo; /, "");
    return `- \`${label}\`: ${exitCode === 0 ? "passed" : `failed (exit ${exitCode})`}`;
  });
  const sections = [summary.trim(), `## Validation\n\n${validation.join("\n")}`];
  if (browserEvidence) {
    const status = browserEvidence.complete ? "complete" : browserEvidence.observations.length ? "partial" : "missing";
    const observations = browserEvidence.observations.length
      ? browserEvidence.observations.map(observation => {
          const value = (input: string) => input.replaceAll("`", "'").replace(/[\u0000-\u001f\u007f\r\n]/g, " ").slice(0, 240);
          const route = value(observation.route || "/");
          const source = observation.source ? `, source ${value(observation.source)}` : "";
          return `- \`${value(observation.origin)}\` route \`${route}\` @ \`${value(observation.headSha)}\` (session \`${value(observation.sessionId)}\`${source}): snapshot ${observation.snapshot ? "yes" : "no"}, interaction ${observation.interaction ? "yes" : "no"}, keyboard ${observation.keyboard ? "yes" : "no"}, screenshot ${observation.screenshot ? "yes" : "no"}, after-interaction ${observation.afterInteraction ? "yes" : "no"}`;
        })
      : ["- No host-observed browser actions were recorded."];
    sections.push(`## Browser evidence\n\n- Status: ${status}\n${observations.join("\n")}\n\n<small>Browser evidence is host-observed context; it does not by itself establish semantic HTML, correctness, or hosted deployment behavior.</small>`);
  }
  const remaining = limitations.map(item => item.trim()).filter(Boolean);
  if (remaining.length) sections.push(`## Limitations\n\n${remaining.map(item => `- ${item}`).join("\n")}`);
  return sections.join("\n\n");
}
