import { type AuthSession } from "@tsu-stack/auth/index";
import { type StaffRole } from "@tsu-stack/core/auth";
import { type member, type organization } from "@tsu-stack/db/schema";
import { type RequestLogger } from "@tsu-stack/logger/server";

export type TenantContext = {
  id: string;
  member: typeof member.$inferSelect;
  profile: typeof organization.$inferSelect;
  roles: StaffRole[];
};

export type OrpcContext = {
  session: AuthSession | null;
  logger: RequestLogger;
  requestId?: string;
  tenant?: TenantContext;
};

export type AuthenticatedOrpcContext = OrpcContext & {
  session: NonNullable<AuthSession>;
};

export type TenantOrpcContext = AuthenticatedOrpcContext & {
  tenant: TenantContext;
};
