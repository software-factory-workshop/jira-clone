export default defineNuxtConfig({
  extends: ["@software-factory-workshop/nuxt-adeo-ds"],
  modules: ["@nuxtjs/mcp-toolkit"],
  mcp: { name: "ADEO Jira Demo", version: "0.1.0" },
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-09-12",
  devtools: { enabled: false },
  app: {
    head: {
      title: "Jira workspace · ADEO",
      meta: [
        {
          name: "description",
          content: "The ADEO Jira demo, grown by our software factory.",
        },
      ],
    },
  },
  runtimeConfig: {
    public: { factoryUrl: "https://adeo-factory-cockpit.vercel.app" },
  },
});
