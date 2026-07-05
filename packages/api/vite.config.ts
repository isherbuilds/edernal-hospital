import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.ts"],
    setupFiles: ["./src/routers/__tests__/test-env.ts"]
  }
});
