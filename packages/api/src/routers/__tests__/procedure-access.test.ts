import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { isProcedure } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { setupApiTestEnv } from "#@/routers/__tests__/test-env";

const REPO_ROOT = join(import.meta.dirname, "../../../../..");
const API_SRC_ROOT = join(REPO_ROOT, "packages/api/src");
const API_ROUTER_ROOT = join(API_SRC_ROOT, "routers");

setupApiTestEnv();

function collectProcedurePaths(router: Record<string, unknown>, prefix: string[] = []): string[] {
  return Object.entries(router).flatMap(([key, value]) => {
    const path = [...prefix, key];
    if (isProcedure(value)) {
      return [path.join(".")];
    }

    if (value && typeof value === "object") {
      return collectProcedurePaths(value as Record<string, unknown>, path);
    }

    return [];
  });
}

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectSourceFiles(path);
    }

    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("router procedure access", () => {
  it("registers every expected routed procedure", async () => {
    const { appRouter } = await import("#@/routers/index");
    const procedurePaths = collectProcedurePaths(appRouter);
    procedurePaths.sort((first: string, second: string) => first.localeCompare(second));
    expect(procedurePaths).toEqual([
      "facility.byId",
      "facility.create",
      "facility.list",
      "health.live",
      "health.ready",
      "practitioner.byId",
      "practitioner.create",
      "practitioner.list"
    ]);
  });

  it("exports only sanctioned procedure factories", async () => {
    const factory = await import("#@/lib/procedures/factory");

    expect("publicProcedure" in factory).toBe(true);
    expect("tenantProcedure" in factory).toBe(true);
    expect("allStaffRoles" in factory).toBe(false);
    expect("authCookieProcedure" in factory).toBe(false);
    expect("baseProcedure" in factory).toBe(false);
    expect("protectedProcedure" in factory).toBe(false);
    expect("roleProcedure" in factory).toBe(false);
  });

  it("keeps routers on publicProcedure or tenantProcedure only", () => {
    const matches = collectSourceFiles(API_ROUTER_ROOT).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const factoryImport = source.match(
        /import\s+\{(?<imports>[^}]+)\}\s+from\s+"#@\/lib\/procedures\/factory"/
      );
      if (!factoryImport?.groups) {
        return [];
      }

      const unsupportedImports = factoryImport.groups.imports
        .split(",")
        .map((importName) => importName.trim())
        .filter(Boolean)
        .filter((importName) => !["publicProcedure", "tenantProcedure"].includes(importName));

      return unsupportedImports.length > 0 ? [relative(REPO_ROOT, file)] : [];
    });

    expect(matches).toEqual([]);
  });

  it("does not use legacy procedure factories in routers", () => {
    const matches = collectSourceFiles(API_ROUTER_ROOT).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /\b(?:allStaffRoles|authCookieProcedure|baseProcedure|protectedProcedure|roleProcedure)\b/.test(
        source
      )
        ? [relative(REPO_ROOT, file)]
        : [];
    });

    expect(matches).toEqual([]);
  });

  it("does not authorize from a session-level role field", () => {
    const matches = collectSourceFiles(API_SRC_ROOT).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("session.user.role") ? [relative(REPO_ROOT, file)] : [];
    });

    expect(matches).toEqual([]);
  });
});
