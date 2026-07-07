import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { isProcedure } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import * as factory from "#@/lib/procedures/factory";
import { appRouter } from "#@/routers/index";

const REPO_ROOT = join(import.meta.dirname, "../../../../..");
const API_SRC_ROOT = join(REPO_ROOT, "packages/api/src");
const API_ROUTER_ROOT = join(API_SRC_ROOT, "routers");

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
  it("registers every expected routed procedure", () => {
    const procedurePaths = collectProcedurePaths(appRouter);
    procedurePaths.sort((first: string, second: string) => first.localeCompare(second));
    expect(procedurePaths).toEqual([
      "consult.printPrescription",
      "consult.saveNote",
      "consult.savePrescription",
      "consult.signNote",
      "consult.signPrescription",
      "consult.supersedeNote",
      "consult.supersedePrescription",
      "consult.workspace",
      "facility.byId",
      "facility.create",
      "facility.list",
      "formulary.create",
      "formulary.list",
      "formulary.search",
      "formulary.update",
      "health.live",
      "health.ready",
      "noteTemplate.create",
      "noteTemplate.list",
      "noteTemplate.update",
      "patient.byId",
      "patient.createIdentifier",
      "patient.quickRegister",
      "patient.searchByPhone",
      "patient.updateAllergies",
      "practitioner.byId",
      "practitioner.create",
      "practitioner.list",
      "queue.board",
      "queue.checkIn",
      "queue.practitionerDay",
      "queue.reassign",
      "queue.startConsult",
      "queue.updateStatus",
      "tenant.membership"
    ]);
  });

  it("exports only sanctioned procedure factories", () => {
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
