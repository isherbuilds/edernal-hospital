import { createContext, useContext, useEffect } from "react";

import { useAuth } from "@tsu-stack/auth/react/tanstack-start/hooks";
import { clearIdentity, log, setIdentity } from "@tsu-stack/logger/client";

type LoggerContextValue = {
  logger: typeof log;
};

const LoggerContext = createContext<LoggerContextValue | null>(null);

export function LoggerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setIdentity({ userId: user.id });
    } else {
      setIdentity({ userId: "anonymous" });
    }

    return () => {
      clearIdentity();
    };
  }, [user]);

  return <LoggerContext.Provider value={{ logger: log }}>{children}</LoggerContext.Provider>;
}

export function useLogger(): typeof log {
  const context = useContext(LoggerContext);
  if (!context) {
    log.warn({
      event: "logger_provider_missing",
      reason: "outside_provider"
    });
    return log;
  }
  return context.logger;
}
