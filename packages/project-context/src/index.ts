export const repository = {
  name: "software-factory-workshop/jira-clone",
  url: "https://github.com/software-factory-workshop/jira-clone",
  stage: "00",
};
export const stages = [
  {
    number: "00",
    title: "A place to begin",
    description:
      "Review the cockpit, draft requests and inspect the project context.",
    status: "Current",
  },
  {
    number: "01",
    title: "Understand the work",
    description:
      "An Eve agent turns a request into a supported work order or a focused question.",
    status: "Planned",
  },
  {
    number: "02",
    title: "Learn the project",
    description:
      "Apply ADEO guidance and carry product feedback into a different task.",
    status: "Planned",
  },
  {
    number: "03",
    title: "Make a bounded change",
    description:
      "Produce a candidate in an isolated checkout with actual check results.",
    status: "Planned",
  },
  {
    number: "04",
    title: "Check the result",
    description:
      "A fresh verifier catches defects and rejects evidence for the wrong revision.",
    status: "Planned",
  },
  {
    number: "05",
    title: "Improve the next run",
    description:
      "Turn findings into evaluations, then test whether the improvement transfers.",
    status: "Planned",
  },
];
export const references = [
  {
    id: "brief",
    title: "The project brief",
    kind: "Working agreement",
    icon: "i-lucide-target",
    content:
      "Grow a project-owned software factory with Eve. Use a recognizable ADEO-branded Jira demo as its test subject. Measure improvements to the factory, not the number of Jira features shipped. Stage zero is a reviewable home for requests and context. There is no agent execution yet.",
  },
  {
    id: "adeo",
    title: "ADEO Nuxt UI",
    kind: "Design system · v0.1.1",
    icon: "i-lucide-palette",
    content:
      "Use @software-factory-workshop/nuxt-adeo-ds 0.1.1. Native UButton, UInput, UTable and other Nuxt UI primitives inherit ADEO styling. Composed components include AdeoPageHeader, AdeoSidebar and AdeoEmptyState. Keep ADEO teal and purple, Roboto, semantic colors and Lucide icons. Do not invent parallel AdeoButton or AdeoTable primitives.",
  },
  {
    id: "jira",
    title: "Jira sandbox observations",
    kind: "Read-only capture · 12 Sep 2026",
    icon: "i-lucide-scan-search",
    content:
      "Authenticated REST inspection verified project KAN (10000), My Kanban Space, a simplified next-gen software project. KAN board is ID 1, type simple. Issue types: Epic, Subtask, Task, Story, Feature and Bug. Statuses: To Do, In Progress, In Review and Done. The transition graph and browser appearance were not inspected. No Jira data was changed.",
  },
  {
    id: "research",
    title: "Why this cockpit is small",
    kind: "Research interpretation",
    icon: "i-lucide-book-open",
    content:
      "The factory UI comparison favors a stable work object, specific human-attention states, and evidence next to decisions. AI SDK Factory keeps work and attempts connected; Mastra surfaces attention; Vercel Factory connects plans and evidence. For stage zero, expose requests, project knowledge and the growth path. Run traces, approvals and evaluations arrive with their working backend capabilities.",
  },
];
export const starterRequests = [
  {
    title: "An ADEO issue list",
    body: "Create an ADEO issue list inspired by project KAN. I want to scan issue key, summary, type, status and assignee. Use our Nuxt UI design system. Identify what we know, what remains a design decision, and what would demonstrate that the first slice works.",
    icon: "i-lucide-list-filter",
  },
  {
    title: "A board worth using",
    body: "Help define the first ADEO Kanban board. Use the observed Jira statuses, but do not assume they describe every allowed transition. Explain the smallest useful behavior and the questions we need to answer.",
    icon: "i-lucide-columns-3",
  },
  {
    title: "Accounts with clear permissions",
    body: "Prepare the work for accounts derived from verified Passport identity. Distinguish identity, application membership and delegated Connect access. Do not assume that SAML or directory sync already works.",
    icon: "i-lucide-users",
  },
];
export type Draft = {
  id: string;
  title: string;
  request: string;
  updatedAt: string;
};
export function parseDrafts(value: unknown): Draft[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Draft =>
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.id === "string" &&
      typeof entry.title === "string" &&
      typeof entry.request === "string" &&
      typeof entry.updatedAt === "string" &&
      Number.isFinite(Date.parse(entry.updatedAt)),
  );
}
export const demoIssues = [
  {
    key: "ADEO-1",
    title: "Welcome to the ADEO Jira workspace",
    type: "Story",
    status: "To Do",
    priority: "Medium",
    assignee: "Unassigned",
    description:
      "This is a synthetic issue used to review the stage-zero layout. The factory will grow the application from here.",
  },
  {
    key: "ADEO-2",
    title: "Make the issue list easy to scan",
    type: "Task",
    status: "In Progress",
    priority: "High",
    assignee: "Demo member",
    description:
      "Review information density, column order and the ADEO component choices. This row is a fixture, not a live task or factory result.",
  },
  {
    key: "ADEO-3",
    title: "Clarify who can move an issue",
    type: "Task",
    status: "In Review",
    priority: "High",
    assignee: "Demo member",
    description:
      "Future behavior must check application permissions on both UI and API paths. Authentication is not implemented in this shell.",
  },
  {
    key: "ADEO-4",
    title: "Keep demo data separate from evidence",
    type: "Bug",
    status: "To Do",
    priority: "Medium",
    assignee: "Unassigned",
    description:
      "All issues shown here are explicitly synthetic. Jira reference observations are recorded separately in the cockpit.",
  },
];
