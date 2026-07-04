import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { clearMemoryLogs, createMemoryDrain, readMemoryLogs } from "evlog/memory";
import { describe, expect, it } from "vite-plus/test";

import { PHI_FIELD_BANLIST } from "@tsu-stack/core/phi";

import { initLogger, log } from "#@/server/index";

const REPO_ROOT = join(import.meta.dirname, "../../../../..");
const SOURCE_ROOTS = ["apps", "packages"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const EXCLUDED_SEGMENTS = new Set([".output", "dist", "migrations", "node_modules", "__tests__"]);
const LOGGER_CALL_PATTERNS = [
  /\b(?:log|logger|requestLog|context\.logger)\.(?:debug|emit|error|info|set|warn)\s*\((?<body>[\s\S]*?)\);/g,
  /\bcreate(?:Request)?Logger\s*\((?<body>[\s\S]*?)\)/g
];

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return EXCLUDED_SEGMENTS.has(entry.name) ? [] : collectSourceFiles(path);
    }

    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("PHI log guard", () => {
  it("redacts PHI fields before drain output", async () => {
    const store = "phi-log-guard";
    clearMemoryLogs(store);
    const phiProbe = Object.fromEntries(
      PHI_FIELD_BANLIST.map((field) => [field, `phi_probe_${field}`])
    );

    initLogger({
      drain: createMemoryDrain({ store }),
      pretty: false,
      silent: true,
      stringify: false
    });

    log.info({
      event: "phi_log_guard_probe",
      nested: phiProbe
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    const output = JSON.stringify(readMemoryLogs({ store }));
    for (const field of PHI_FIELD_BANLIST) {
      expect(output).not.toContain(`phi_probe_${field}`);
    }
    expect(output).toContain("[REDACTED]");
  });

  it("does not find direct PHI field names in object logger calls", () => {
    const sourceFiles = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(join(REPO_ROOT, root)));
    const phiFieldPattern = new RegExp(
      `\\b(?:${PHI_FIELD_BANLIST.map(escapeRegExp).join("|")})\\s*:`,
      "u"
    );
    const matches = sourceFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return LOGGER_CALL_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)])
        .filter((match) => phiFieldPattern.test(match.groups?.body ?? ""))
        .map(
          (match) =>
            `${relative(REPO_ROOT, file)}:${source.slice(0, match.index).split("\n").length}`
        );
    });

    expect(matches).toEqual([]);
  });
});
