import process from "node:process";

export function setupApiTestEnv(): void {
  if (!["development", "production"].includes(process.env.NODE_ENV ?? "")) {
    process.env.NODE_ENV = "development";
  }

  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/edernal_hospital_test";
  process.env.BETTER_AUTH_SECRET ??= "test_better_auth_secret_32_chars_minimum";
}
