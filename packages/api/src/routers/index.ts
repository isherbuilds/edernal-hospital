import { type RouterClient } from "@orpc/server";

import { facilityRouter } from "#@/routers/facility/index";
import { healthRouter } from "#@/routers/health/index";
import { practitionerRouter } from "#@/routers/practitioner/index";

export const appRouter = {
  facility: facilityRouter,
  health: healthRouter,
  practitioner: practitionerRouter
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
