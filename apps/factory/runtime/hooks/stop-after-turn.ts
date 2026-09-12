import { defineHook } from "eve/hooks";
import { miningState } from "../lib/mining-state";
export default defineHook({events:{
 async "turn.completed"(_,ctx){if(miningState.get().sandboxStarted) await (await ctx.getSandbox()).stop();},
 async "turn.cancelled"(_,ctx){if(miningState.get().sandboxStarted) await (await ctx.getSandbox()).stop();},
}});
