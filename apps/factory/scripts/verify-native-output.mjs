import { readdir, access } from "node:fs/promises";
import { resolve, join } from "node:path";

export async function verifyNativeOutput(directory) {
  const output = resolve(directory);
  await access(join(output, "config.json"));
  await access(join(output, "functions/.well-known/workflow/v1/flow.func/.vc-config.json"));
  const files = await readdir(output, { recursive: true });
  const forbidden = files.filter(path => /harness[-_](fx|acp)/i.test(path));
  if (forbidden.length) throw new Error(`Experimental fx runtime leaked into deployment: ${forbidden.join(", ")}`);
  console.log("Verified deployable Eve/Workflow output contains no fx or ACP runtime bundles.");
}
