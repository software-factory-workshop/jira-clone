import { defineAgent, defineDynamic } from "eve";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyGatewayScope } from "./lib/github.mjs";
import { factoryModelIds, factoryModelLimits } from "./lib/factory-config.ts";

export default defineAgent({
  model: defineDynamic({events:{"session.started":async()=>{verifyGatewayScope(await getVercelOidcToken(),process.env.AI_GATEWAY_API_KEY);return factoryModelIds.taskMiner;}}}),
  build: { externalDependencies: ["@cedar-policy/cedar-wasm"] },
  // Static tool policy on purpose. Eve 0.52.5 accepts `defaultTools` in a
  // dynamic subagent return at build time but rejects it at runtime (hosted run
  // wrun_41M2AV3MBZ0GKQ7CVGE2RTP7S7, 12 Sep 2026). Authority therefore comes from
  // fixed tool lists plus the immutable station check, never from a model choice.
  defaultTools: false,
  limits: factoryModelLimits,
});
