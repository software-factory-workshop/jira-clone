import MarkdownIt from "markdown-it";

// Reports are untrusted model output. Keep HTML and remote images inert.
const markdown = new MarkdownIt({ html: false, linkify: false }).disable("image");
export function renderReport(report: string): string {
  return markdown.render(report);
}
