export default defineNuxtConfig({
  modules: ["eve/nuxt", "./modules/station-routes"],
  eve: { eveBuildCommand: "pnpm run build:agent" },
  vite: { optimizeDeps: { include: ["eve/vue"] } },
  extends: ["@software-factory-workshop/nuxt-adeo-ds"],
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-09-12",
  devtools: { enabled: false },
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
