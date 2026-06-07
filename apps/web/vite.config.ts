import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // CSS Modules are left unprocessed in tests; class names resolve to their
    // literal local name (e.g. styles.positive === "positive") so component
    // tests can assert toHaveClass("positive") etc.
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
