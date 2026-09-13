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
  browserEvidenceComplete?: boolean;
}

const browserSourceRoots = ["apps/factory/app/", "apps/jira/app/"];

// Required evidence is derived by the host from the changed-file inventory. A
// reviewer once obtained approval by moving its missing browser checks from
// limitations to "optional" (PR #2 review, 12 Sep 2026); PR #5 made this list
// host-owned so model wording cannot remove a requirement.
export function hostReviewLimitations(files: ReviewFile[], browserEvidenceComplete = false): string[] {
  if (browserEvidenceComplete) return [];
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
    ...hostReviewLimitations(state.files, state.browserEvidenceComplete),
    ...state.modelLimitations,
  ];
}
