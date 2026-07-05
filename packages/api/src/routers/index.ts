import { type RouterClient } from "@orpc/server";

import { facilityRouter } from "#@/routers/facility/index";
import { healthRouter } from "#@/routers/health/index";
import { patientRouter } from "#@/routers/patient/index";
import { practitionerRouter } from "#@/routers/practitioner/index";
import { queueRouter } from "#@/routers/queue/index";
import { tenantRouter } from "#@/routers/tenant/index";

export const appRouter = {
  facility: facilityRouter,
  health: healthRouter,
  patient: patientRouter,
  practitioner: practitionerRouter,
  queue: queueRouter,
  tenant: tenantRouter
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
