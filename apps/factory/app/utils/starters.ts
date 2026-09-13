export interface StarterInput {
  title: string;
  body: string;
  icon?: string;
}

export type StarterState = "shipped" | "open";

export interface StarterMeta {
  state: StarterState;
  badge: string;
  note: string;
  next: string;
}

export interface StarterCard {
  starter: StarterInput;
  meta: StarterMeta;
}

const shipped: Record<string, { note: string; next: string }> = {
  "an adeo issue list": {
    note: "Shipped as a demo slice in the Jira workspace: list, search, assignee filter and priority edit.",
    next: "Extend it — for example comment permissions or another open demo case — rather than proposing the list again.",
  },
  "a board worth using": {
    note: "Shipped as a demo slice in the Jira workspace: board columns, a labelled transition matrix and keyboard moves.",
    next: "Extend it — for example transition permissions or another open demo case — rather than proposing the board again.",
  },
  "accounts with clear permissions": {
    note: "Shipped as a labelled demo-only role matrix (admin, member, viewer) with a Passport-identity fallback.",
    next: "Extend it — for example an OAuth or MCP-era permission case — rather than proposing accounts again.",
  },
};

function keyFor(title: string): string {
  return title.trim().toLowerCase();
}

export function starterDraft(card: StarterCard): { title: string; body: string } {
  if (card.meta.state !== "shipped") {
    return { title: card.starter.title, body: card.starter.body };
  }
  return {
    title: `Extend: ${card.starter.title}`,
    body: `Already shipped: ${card.meta.note}\nNext step: ${card.meta.next}\n\nDraft an extension that builds on the shipped slice. Do not propose the shipped work again.`,
  };
}

export function describeStarter(starter: StarterInput): StarterCard {
  const known = shipped[keyFor(starter.title)];
  if (known) {
    return {
      starter,
      meta: {
        state: "shipped",
        badge: "Shipped in Jira demo",
        note: known.note,
        next: known.next,
      },
    };
  }
  return {
    starter,
    meta: {
      state: "open",
      badge: "Open",
      note: "Not yet shipped. Shape it as a small demo slice before starting work.",
      next: "Edit it in the draft editor, save the draft, then choose a work action below.",
    },
  };
}
