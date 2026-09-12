import { addImports, defineNuxtModule } from 'nuxt/kit';

// Production routing is declared once in vercel.json. In development the three
// independent Eve roots listen on separate ports; the browser keeps one origin.
export default defineNuxtModule({
  meta: { name: 'factory-station-routes' },
  setup(_options, nuxt) {
    addImports({ name: 'useEveAgent', from: 'eve/vue' });
    if (process.env.VERCEL) return;
    const rules = nuxt.options.routeRules ||= {};
    for (const [name, port] of [['task-miner', 4274], ['worker', 4275], ['reviewer', 4276]] as const) {
      rules[`/${name}/**`] = { proxy: `http://127.0.0.1:${port}/**` };
    }
    rules['/eve/v1/**'] = { proxy: 'http://127.0.0.1:4274/eve/v1/**' };
    rules['/factory/**'] = { proxy: 'http://127.0.0.1:4274/factory/**' };
  },
});
