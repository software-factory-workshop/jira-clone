import { defineNuxtModule } from "nuxt/kit";

// Nitro's bundled Vercel types predate the services configuration emitted by Eve.
interface EveServiceConfig { routes?: unknown[]; services?: Record<string, { routes?: unknown[] }> }
// Eve's Nuxt integration mounts its standard transport only. Reuse that same
// service for the authenticated station channel rather than running another app.
export default defineNuxtModule({
  meta: { name: "factory-station-routes" },
  setup(_options, nuxt) {
    if (!nuxt.options.dev && process.env.VERCEL) {
      const config = nuxt.options.nitro.vercel?.config as EveServiceConfig | undefined;
      const service = config?.services?.eve;
      if (!config || !service) throw new Error("The factory station routes require Eve's generated service.");
      const src = "^/factory/stations/(.*)$";
      config.routes = [{ src, destination: { type: "service", service: "eve" } }, ...(config.routes || [])];
      service.routes = [{ src, transforms: [{ type: "request.path", op: "set", args: "/factory/stations/$1" }] }, ...(service.routes || [])];
    } else {
      nuxt.hook("modules:done", () => {
        const rules = nuxt.options.routeRules ||= {};
        const proxy = rules["/eve/v1/**"]?.proxy;
        const target = typeof proxy === "string" ? proxy : proxy?.to;
        if (!target?.endsWith("/eve/v1/**")) throw new Error("Could not resolve the existing Eve transport proxy.");
        rules["/factory/stations/**"] = { proxy: target.replace(/\/eve\/v1\/\*\*$/, "/factory/stations/**") };
      });
    }
  },
});
