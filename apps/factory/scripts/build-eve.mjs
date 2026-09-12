import { spawnSync } from "node:child_process";
import { verifyNativeOutput } from "./verify-native-output.mjs";

const result = spawnSync("pnpm", ["exec", "eve", "build"], { stdio: "inherit", env: process.env });
if (result.status !== 0) process.exit(result.status ?? 1);
// Vercel supplies project OIDC here. Eve must finish real template prewarming
// before output can pass this check; an unauthenticated CI build is not equivalent.
if (process.env.VERCEL === "1") {
  await verifyNativeOutput(process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY || ".vercel/output");
}
