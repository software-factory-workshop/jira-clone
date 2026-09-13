import type { ProposalPayload } from "../utils/draft-guard";

export function useWorkRequest() {
  const pending = useState<ProposalPayload | null>("factory-pending-work-request", () => null);

  function queue(value: ProposalPayload) {
    pending.value = value;
  }

  function consume() {
    const value = pending.value;
    pending.value = null;
    return value;
  }

  return { queue, consume };
}
