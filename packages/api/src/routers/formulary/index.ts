import { z } from "zod";

import { STAFF_ROLE } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { withTenantTx } from "#@/lib/tenancy/scoped-db";

import {
  createFormularyItem,
  FormularyCreateInputSchema,
  FormularyItemOutputSchema,
  FormularyListInputSchema,
  FormularySearchInputSchema,
  FormularyUpdateInputSchema,
  listFormularyItems,
  searchFormularyItems,
  updateFormularyItem
} from "./queries";

const formularySearchRoles = [
  STAFF_ROLE.PRACTITIONER,
  STAFF_ROLE.PHARMACY_LAB,
  STAFF_ROLE.HOSPITAL_ADMIN
] as const;

const formularyManagerRoles = [STAFF_ROLE.HOSPITAL_ADMIN] as const;

export const formularyRouter = {
  create: tenantProcedure(FormularyCreateInputSchema, formularyManagerRoles)
    .route({
      description: "Create a Tenant Formulary item",
      method: "POST"
    })
    .output(FormularyItemOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "formulary.create", (scope) => createFormularyItem(scope, input))
    ),
  list: tenantProcedure(FormularyListInputSchema, formularyManagerRoles)
    .route({
      description: "List all Tenant Formulary items including inactive entries",
      method: "GET"
    })
    .output(z.array(FormularyItemOutputSchema))
    .handler(({ context }) =>
      withTenantTx(context, "formulary.list", (scope) => listFormularyItems(scope))
    ),
  search: tenantProcedure(FormularySearchInputSchema, formularySearchRoles)
    .route({
      description: "Search active Tenant Formulary items by medication name",
      method: "GET"
    })
    .output(z.array(FormularyItemOutputSchema))
    .handler(({ context, input }) =>
      withTenantTx(context, "formulary.search", (scope) => searchFormularyItems(scope, input))
    ),
  update: tenantProcedure(FormularyUpdateInputSchema, formularyManagerRoles)
    .route({
      description: "Update a Tenant Formulary item",
      method: "POST"
    })
    .output(FormularyItemOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "formulary.update", (scope) => updateFormularyItem(scope, input))
    )
};
