import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias:
      mode === "e2e"
        ? {
            "@clerk/clerk-react": fileURLToPath(
              new URL("../e2e/clerk.tsx", import.meta.url),
            ),
          }
        : {},
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "charts", test: /recharts|d3-|victory-vendor/ },
            { name: "auth", test: /@clerk/ },
          ],
        },
      },
    },
  },
}));
