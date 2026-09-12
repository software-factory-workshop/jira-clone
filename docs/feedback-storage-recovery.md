# Proposal feedback storage recovery

Browser-local usefulness marks live under `adeo-factory-proposal-feedback-v1`
in `localStorage`. No storage logic changed here; these are manual checks for
the cockpit warnings in `ProposalFeedback.vue`.

## Malformed saved feedback: a new saved mark replaces the bad entry

1. Open a cockpit report with at least one proposal card.
2. In DevTools, overwrite the key with invalid JSON:
   `localStorage.setItem("adeo-factory-proposal-feedback-v1", "{not-json")`,
   then reload.
3. Expect the malformed warning: unreadable marks are hidden, readable marks
   stay shown, and the typed reason stays on screen.
4. Mark a proposal useful (or not useful) and save the reason.
5. Expect the warning to clear and the new mark to persist after reload.
   The malformed entry was replaced by the newly saved data; the typed reason
   and verdict were never discarded by the warning itself.

## Temporarily unavailable storage: retry recovers

1. Open a cockpit report, then make storage throw (for example, block site
   data / cookies for the preview origin, or run with storage disabled).
2. Reload, then try marking a proposal: expect the unavailable warning plus
   the save alert. The typed reason and any shown marks stay on screen.
3. Re-enable storage and save again (or reload once storage works).
4. Expect the warnings to clear on the first clean load or successful save.
   If they linger while saves keep failing, storage is still unavailable —
   the warning is telling the truth, not stuck.
