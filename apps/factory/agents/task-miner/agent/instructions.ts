import { defineInstructions } from "eve/instructions";
import { miningInstructions } from "../../../runtime/lib/mining-instructions";
const qualityReminder = "\n\nBefore acting, read factory/policies/agent-quality.md after the required repository context. Apply its source-first, evidence and completion rules. When communicating with the user, use the $show-me skill when it is attached, or the same smallest accurate inline diagram form when it is not. Do not claim a visual artifact or state that was not produced.";
export default defineInstructions({content:miningInstructions + qualityReminder});
