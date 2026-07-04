import { os, type Route } from "@orpc/server";
import { type z } from "zod";

import { StaffRoleSetSchema, type StaffRole } from "@tsu-stack/core/auth";
import { and, db, eq } from "@tsu-stack/db";
import { member, organization } from "@tsu-stack/db/schema";

import { type OrpcContext, type TenantOrpcContext } from "#@/lib/context/types";
import { type TenantScopedInput } from "#@/lib/tenancy/scope";

const o = os.$context<OrpcContext>();

const commonErrors = {
  FORBIDDEN: {
    description: "The current user is not allowed to perform this action.",
    status: 403
  },
  UNAUTHORIZED: {
    description: "Authentication is required.",
    status: 401
  }
} as const;

const baseProcedure = o.errors(commonErrors);

export const publicProcedure = baseProcedure;

const authCookieRoute: Route = {
  spec: (spec) => {
    return {
      ...spec,
      security: [{ authCookie: [] }]
    };
  }
} as const;

const authCookieProcedure = baseProcedure.route(authCookieRoute);

function requireTenantRole(requiredRoles: readonly StaffRole[]) {
  const requiredRoleSet = new Set(requiredRoles);

  return baseProcedure.middleware(async ({ context, errors, next }, requestedTenantId: string) => {
    if (!context.session?.user) {
      throw errors.UNAUTHORIZED();
    }

    const [access] = await db
      .select({
        member,
        profile: organization
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(
        and(
          eq(member.organizationId, requestedTenantId),
          eq(member.userId, context.session.user.id)
        )
      )
      .limit(1);

    if (!access) {
      throw errors.FORBIDDEN();
    }

    const memberRoles = StaffRoleSetSchema.safeParse(
      access.member.role
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean)
    );
    if (!memberRoles.success) {
      throw errors.FORBIDDEN();
    }

    if (!memberRoles.data.some((role) => requiredRoleSet.has(role))) {
      throw errors.FORBIDDEN();
    }

    const nextContext = {
      logger: context.logger,
      session: context.session,
      tenant: {
        id: access.profile.id,
        member: access.member,
        profile: access.profile,
        roles: memberRoles.data
      }
    } satisfies TenantOrpcContext;

    return next({
      context: nextContext
    });
  });
}

export function tenantProcedure<TInputSchema extends z.ZodType<TenantScopedInput>>(
  inputSchema: TInputSchema,
  roles: readonly StaffRole[]
) {
  const parsedRoles = StaffRoleSetSchema.parse(roles);

  return authCookieProcedure
    .input(inputSchema)
    .use(requireTenantRole(parsedRoles), (input) => input.tenantId);
}
