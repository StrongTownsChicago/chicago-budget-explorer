import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  output: "static",
  integrations: [react(), tailwind()],
  site: "https://budget.strongtownschicago.org", // Update when domain finalized
  vite: {
    ssr: {
      noExternal: ["recharts", "d3"], // Bundle these for SSR
    },
    test: {
      globals: true,
      environment: "jsdom",
    },
  },
});
