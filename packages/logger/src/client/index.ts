import { initLogger as initEvlogLogger, log as evlogLog } from "evlog";
import { createHttpLogDrain, type HttpLogDrainOptions } from "evlog/http";

import { LOG_SERVICES } from "#@/constants/services";

type ClientLoggerConfig = {
  batchedTransport?: HttpLogDrainOptions;
  console?: boolean;
  enabled?: boolean;
  minLevel?: NonNullable<Parameters<typeof initEvlogLogger>[0]>["minLevel"];
  pretty?: boolean;
  service?: string;
};

type LogMethod = typeof evlogLog.info;
type LogMethodName = "debug" | "error" | "info" | "warn";

const DEFAULT_CLIENT_LOGGER_CONFIG = {
  service: LOG_SERVICES.DEFAULT
} satisfies ClientLoggerConfig;

let isInitialized = false;
let identityContext: Record<string, unknown> = {};

function isBrowserRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Initialize browser logging with evlog's HTTP drain transport.
 *
 * @example
 * ```ts
 * import {
 *   LOG_SERVICES,
 *   initLog,
 * } from "@tsu-stack/logger/client";
 * import { ENV_WEB_ISOMORPHIC } from "@tsu-stack/env/web/env.isomorphic";
 *
 * initLog({
 *   batchedTransport: {
 *     drain: {
 *       credentials: "include",
 *       endpoint: `${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL.replace(/\/$/, "")}/_logs/ingest`,
 *     },
 *   },
 *   service: LOG_SERVICES.WEB_CLIENT,
 * });
 * ```
 */
export function initLog(config: ClientLoggerConfig = {}) {
  if (!isBrowserRuntime()) {
    return;
  }

  if (isInitialized) {
    return;
  }

  initEvlogLogger({
    drain: config.batchedTransport ? createHttpLogDrain(config.batchedTransport) : undefined,
    enabled: config.enabled,
    env: {
      service: config.service ?? DEFAULT_CLIENT_LOGGER_CONFIG.service
    },
    minLevel: config.minLevel,
    pretty: config.pretty,
    silent: config.console === false
  });
  isInitialized = true;
}

/**
 * Stable service names for browser logging.
 *
 * @example
 * ```ts
 * import { LOG_SERVICES } from "@tsu-stack/logger/client";
 *
 * initLog({ service: LOG_SERVICES.WEB_CLIENT });
 * ```
 */
export { LOG_SERVICES };

/**
 * Simple browser logging API. Object payloads automatically include the current identity context.
 *
 * @example
 * ```ts
 * import { log } from "@tsu-stack/logger/client";
 *
 * log.info({ event: "page_view", path: location.pathname });
 * log.error({ code: "UNHANDLED_ERROR", event: "global_error_boundary" });
 * ```
 */
export const log = {
  debug: withIdentity("debug"),
  error: withIdentity("error"),
  info: withIdentity("info"),
  warn: withIdentity("warn")
} satisfies typeof evlogLog;

/**
 * Attach user/session context to future browser log events.
 *
 * @example
 * ```ts
 * import { setIdentity } from "@tsu-stack/logger/client";
 *
 * setIdentity({ userId: user.id });
 * ```
 */
export function setIdentity(identity: Record<string, unknown>) {
  if (!isBrowserRuntime()) {
    return;
  }

  identityContext = { ...identity };
}

/**
 * Clear browser identity context, usually on sign-out or provider cleanup.
 *
 * @example
 * ```ts
 * import { clearIdentity } from "@tsu-stack/logger/client";
 *
 * clearIdentity();
 * ```
 */
export function clearIdentity() {
  if (!isBrowserRuntime()) {
    return;
  }

  identityContext = {};
}

function withIdentity(methodName: LogMethodName): LogMethod {
  function logWithIdentity(tag: string, message: string): void;
  function logWithIdentity(event: Record<string, unknown>): void;
  function logWithIdentity(tagOrEvent: string | Record<string, unknown>, message?: string) {
    if (!isBrowserRuntime()) {
      return;
    }

    if (isRecord(tagOrEvent)) {
      evlogLog[methodName]({
        ...identityContext,
        ...tagOrEvent
      });
      return;
    }

    if (message === undefined) {
      return;
    }

    evlogLog[methodName](tagOrEvent, message);
  }

  return logWithIdentity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
