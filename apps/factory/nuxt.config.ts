// Restart the whole `pnpm dev` command after changing this file or installing
// dependencies: this Eve/Nuxt version can keep proxying to its stopped child.
export default defineNuxtConfig({
  modules: ["evlog/nuxt", "workflow/nuxt", "./modules/station-routes"],
  vite: { optimizeDeps: { include: ["eve/vue"] } },
  extends: ["@software-factory-workshop/nuxt-adeo-ds"],
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-09-12",
  devtools: { enabled: false },
  evlog: {
    env: { service: "adeo-factory-cockpit" },
    redact: true,
    transport: { enabled: true },
    exclude: ["/_nuxt/**", "/api/_evlog/ingest"],
  },
  app: {
    head: {
      title: "Factory cockpit · ADEO",
      meta: [
        {
          name: "description",
          content: "Grow the factory, one verified capability at a time.",
        },
      ],
    },
  },
  runtimeConfig: { public: { jiraUrl: "https://adeo-jira-clone.vercel.app" } },
});
