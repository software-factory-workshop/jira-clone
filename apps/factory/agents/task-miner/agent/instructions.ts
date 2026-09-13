import { defineInstructions } from "eve/instructions";
import { miningInstructions } from "../../../runtime/lib/mining-instructions.ts";
import { composeAgentInstructions } from "../../../shared/agent-quality.ts";

export default defineInstructions({
  content: composeAgentInstructions(miningInstructions),
});
