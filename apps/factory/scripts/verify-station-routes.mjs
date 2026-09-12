import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const config = JSON.parse(await readFile(".vercel/output/config.json", "utf8"));
for (const prefix of ["/eve/v1", "/factory/stations"]) {
  const pattern = `^${prefix}/(.*)$`;
  assert(config.routes.some(route => route.src === pattern && route.destination?.service === "eve"), `Missing Eve service route for ${prefix}`);
  assert(config.services.eve.routes.some(route => route.src === pattern && route.transforms?.some(transform => transform.type === "request.path" && transform.op === "set" && transform.args === `${prefix}/$1`)), `Missing service path preservation for ${prefix}`);
}
console.log("Standard Eve transport and authenticated station routes use the same service.");
