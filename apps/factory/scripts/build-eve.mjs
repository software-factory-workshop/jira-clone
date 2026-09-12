import { spawnSync } from "node:child_process";
const result = spawnSync("pnpm", ["exec", "eve", "build"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
