# Focus the investigation before adding more context

Status: development-session observation, 12 September 2026. Remi has not accepted the proposals. This records a native Eve experiment, not an fx run or an automatically activated factory rule.

The earlier native investigation produced a durable report, then parked at the old 8,000-output-token budget. It made 24 file-read calls and used 307,415 input tokens and 10,658 output tokens across the run. Report time was about 171 seconds; recorded model cost was USD 0.011476662.

We clarified how to establish the user's desired outcome and select evidence, reconciled stale fx architecture claims, and focused the agent's reading instructions. The output allowance also increased to 16,000 tokens; simultaneous changes prevent causal attribution.

The focused baseline used runtime `b81899e` and source revision `42d335cbb0827b1d17d6be3d84c946b105533161`. It made 14 file-read calls, used 135,587 input and 7,112 output tokens, and recorded USD 0.006952156 model cost. Findings arrived after 106 seconds and the turn finished after 113 seconds. All four protocol/evidence gates passed without a budget pause.

The report remained correctly incomplete because Vercel evidence was unavailable for both projects. It described intentionally excluded evaluations and Git history as context boundaries rather than additional blocking gaps. It proposed two factory-relevant candidates, with no stale-fx implementation proposal. One error remained: it called the historical fx-backed hosted session `wrun_41M2AMEC0K0GKSGJ90PB36X1RY` native. Its source revision still contained ambiguous verification wording; that wording has since been corrected. Preserve the original report. These observations do not prove better proposal quality or justify implementing either candidate.

The cost figures cover recorded model usage, not Sandbox infrastructure or the development session. A passing gate establishes its narrow assertion, not usefulness. Runtime, source, instructions and budget differ between the runs, and model variation remains an alternative explanation for the smaller read/token footprint.

The transfer run used runtime/source `b81899e`, made 13 file-read calls, and finished in 116 seconds with 203,434 input tokens, 7,536 output tokens and USD 0.007364436 model cost. All four gates passed. It also kept exclusions out of blocking gaps, supporting that narrow hypothesis. However, its proposed two-prompt probe duplicated this ongoing experiment, absent from its snapshot WIP. Task novelty remains unresolved.

Evidence: `factory/mining/native/2026-09-12/focused-baseline.json` and the adjacent native experiment artifacts. Outputs remain held out. Review `focused-transfer.json` alongside the baseline, then ask Remi whether the proposals are worth considering.
