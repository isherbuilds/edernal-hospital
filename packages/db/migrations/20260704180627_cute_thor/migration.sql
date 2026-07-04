CREATE TYPE "tenant_resource_status" AS ENUM('active', 'inactive');--> statement-breakpoint
DROP INDEX "member_organizationId_idx";--> statement-breakpoint
DROP INDEX "organization_slug_idx";--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "status" SET DATA TYPE "tenant_resource_status" USING "status"::"tenant_resource_status";--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "status" SET DEFAULT 'active'::"tenant_resource_status";--> statement-breakpoint
ALTER TABLE "practitioners" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "practitioners" ALTER COLUMN "status" SET DATA TYPE "tenant_resource_status" USING "status"::"tenant_resource_status";--> statement-breakpoint
ALTER TABLE "practitioners" ALTER COLUMN "status" SET DEFAULT 'active'::"tenant_resource_status";--> statement-breakpoint
CREATE INDEX "invitation_inviterId_idx" ON "invitation" ("inviter_id");--> statement-breakpoint
CREATE INDEX "practitioners_userId_idx" ON "practitioners" ("user_id");--> statement-breakpoint
CREATE INDEX "session_activeOrganizationId_idx" ON "session" ("active_organization_id");