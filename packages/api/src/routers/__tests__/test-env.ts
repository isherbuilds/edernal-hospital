import process from "node:process";

// Vitest setup file (registered in vite.config.ts). Runs before any test
// module is imported, so `ENV_SERVER` validation in `@tsu-stack/env` sees a
// valid NODE_ENV and fallback secrets even though vitest defaults NODE_ENV to
// "test".
if (!["development", "production"].includes(process.env.NODE_ENV ?? "")) {
  process.env.NODE_ENV = "development";
}

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/edernal_hospital_test";
process.env.BETTER_AUTH_SECRET ??= "test_better_auth_secret_32_chars_minimum";
