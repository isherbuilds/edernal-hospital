import { type RouterClient } from "@orpc/server";

import { consultRouter } from "#@/routers/consult/index";
import { facilityRouter } from "#@/routers/facility/index";
import { formularyRouter } from "#@/routers/formulary/index";
import { healthRouter } from "#@/routers/health/index";
import { noteTemplateRouter } from "#@/routers/note-template/index";
import { patientRouter } from "#@/routers/patient/index";
import { practitionerRouter } from "#@/routers/practitioner/index";
import { queueRouter } from "#@/routers/queue/index";
import { tenantRouter } from "#@/routers/tenant/index";

export const appRouter = {
  consult: consultRouter,
  facility: facilityRouter,
  formulary: formularyRouter,
  health: healthRouter,
  noteTemplate: noteTemplateRouter,
  patient: patientRouter,
  practitioner: practitionerRouter,
  queue: queueRouter,
  tenant: tenantRouter
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
