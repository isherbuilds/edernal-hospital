import { z } from "zod";

import { STAFF_ROLE } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { withTenantTx } from "#@/lib/tenancy/scoped-db";

import {
  createNoteTemplate,
  listNoteTemplates,
  NoteTemplateCreateInputSchema,
  NoteTemplateListInputSchema,
  NoteTemplateOutputSchema,
  NoteTemplateUpdateInputSchema,
  updateNoteTemplate
} from "./queries";

const noteTemplateReaderRoles = [STAFF_ROLE.PRACTITIONER, STAFF_ROLE.HOSPITAL_ADMIN] as const;
const noteTemplateManagerRoles = [STAFF_ROLE.HOSPITAL_ADMIN] as const;

export const noteTemplateRouter = {
  create: tenantProcedure(NoteTemplateCreateInputSchema, noteTemplateManagerRoles)
    .route({
      description: "Create a Tenant Note Template",
      method: "POST"
    })
    .output(NoteTemplateOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "noteTemplate.create", (scope) => createNoteTemplate(scope, input))
    ),
  list: tenantProcedure(NoteTemplateListInputSchema, noteTemplateReaderRoles)
    .route({
      description: "List active Tenant Note Templates",
      method: "GET"
    })
    .output(z.array(NoteTemplateOutputSchema))
    .handler(({ context, errors, input }) => {
      if (input.includeInactive && !context.tenant.roles.includes(STAFF_ROLE.HOSPITAL_ADMIN)) {
        throw errors.FORBIDDEN();
      }

      return withTenantTx(context, "noteTemplate.list", (scope) => listNoteTemplates(scope, input));
    }),
  update: tenantProcedure(NoteTemplateUpdateInputSchema, noteTemplateManagerRoles)
    .route({
      description: "Update a Tenant Note Template",
      method: "POST"
    })
    .output(NoteTemplateOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "noteTemplate.update", (scope) => updateNoteTemplate(scope, input))
    )
};
