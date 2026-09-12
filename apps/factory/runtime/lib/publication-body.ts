/** Reviewer prose stays separate from host-owned validation and ownership metadata. */
export function publicationBody(
  summary: string,
  limitations: string[],
  checks: Array<{ command: string; exitCode: number }>,
) {
  const validation = checks.map(({ command, exitCode }) => {
    const label = command.replace(/^export PATH="\$HOME\/\.local\/bin:\$PATH"; cd \/workspace\/repo; /, "");
    return `- \`${label}\`: ${exitCode === 0 ? "passed" : `failed (exit ${exitCode})`}`;
  });
  const sections = [summary.trim(), `## Validation\n\n${validation.join("\n")}`];
  const remaining = limitations.map(item => item.trim()).filter(Boolean);
  if (remaining.length) sections.push(`## Limitations\n\n${remaining.map(item => `- ${item}`).join("\n")}`);
  return sections.join("\n\n");
}
