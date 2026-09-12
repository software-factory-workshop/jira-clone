interface ReviewFile {
  filename: string;
  previous_filename?: string;
}

interface ApprovalState {
  prepared: boolean;
  repositoryChecksPassed: boolean;
  hasBlockingFinding: boolean;
  contextGaps: string[];
  modelLimitations: string[];
  files: ReviewFile[];
}

const browserSourceRoots = ["apps/factory/app/", "apps/jira/app/"];

export function hostReviewLimitations(files: ReviewFile[]): string[] {
  const touchesBrowserSource = files.some(({ filename, previous_filename }) =>
    [filename, previous_filename].some((path) => path && browserSourceRoots.some((root) => path.startsWith(root))),
  );
  if (!touchesBrowserSource) return [];
  return [
    "Required host evidence missing: exercise the changed UI in a real browser.",
    "Required host evidence missing: verify keyboard accessibility for the changed UI.",
  ];
}

export function approvalBlockers(state: ApprovalState): string[] {
  return [
    ...(state.prepared ? [] : ["The independent review workspace was not prepared."]),
    ...(state.repositoryChecksPassed ? [] : ["Mandatory repository typecheck, tests and build have not passed."]),
    ...(state.hasBlockingFinding ? ["Blocking findings remain."] : []),
    ...state.contextGaps,
    ...hostReviewLimitations(state.files),
    ...state.modelLimitations,
  ];
}
