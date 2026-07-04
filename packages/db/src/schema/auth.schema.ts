import { defineRelationsPart } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
});

export const session = pgTable(
  "session",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    activeOrganizationId: text("active_organization_id").references(() => organization.id, {
      onDelete: "set null"
    }),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    value: text("value").notNull()
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const organization = pgTable(
  "organization",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    defaultTimezone: text("default_timezone").default("Asia/Kolkata"),
    displayName: text("display_name"),
    id: text("id").primaryKey(),
    legalName: text("legal_name"),
    logo: text("logo"),
    metadata: text("metadata"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique()
  },
  (table) => [index("organization_slug_idx").on(table.slug)]
);

export const member = pgTable(
  "member",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    displayNameOverride: text("display_name_override"),
    employeeCode: text("employee_code"),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // No DB default: Better Auth must persist one or more explicit StaffRole slugs.
    role: text("role").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_organizationId_userId_unique").on(table.organizationId, table.userId)
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role"),
    status: text("status").default("pending").notNull()
  },
  (table) => [
    index("invitation_email_idx").on(table.email),
    index("invitation_organizationId_idx").on(table.organizationId)
  ]
);

export const relations = defineRelationsPart(
  { account, invitation, member, organization, session, user, verification },
  (r) => {
    return {
      account: {
        user: r.one.user({
          from: r.account.userId,
          to: r.user.id
        })
      },
      session: {
        activeOrganization: r.one.organization({
          from: r.session.activeOrganizationId,
          optional: true,
          to: r.organization.id
        }),
        user: r.one.user({
          from: r.session.userId,
          to: r.user.id
        })
      },
      invitation: {
        inviter: r.one.user({
          from: r.invitation.inviterId,
          to: r.user.id
        }),
        organization: r.one.organization({
          from: r.invitation.organizationId,
          to: r.organization.id
        })
      },
      member: {
        organization: r.one.organization({
          from: r.member.organizationId,
          to: r.organization.id
        }),
        user: r.one.user({
          from: r.member.userId,
          to: r.user.id
        })
      },
      organization: {
        invitations: r.many.invitation({
          from: r.organization.id,
          to: r.invitation.organizationId
        }),
        members: r.many.member({
          from: r.organization.id,
          to: r.member.organizationId
        }),
        sessions: r.many.session({
          from: r.organization.id,
          to: r.session.activeOrganizationId
        })
      },
      user: {
        accounts: r.many.account({
          from: r.user.id,
          to: r.account.userId
        }),
        invitationsSent: r.many.invitation({
          from: r.user.id,
          to: r.invitation.inviterId
        }),
        memberships: r.many.member({
          from: r.user.id,
          to: r.member.userId
        }),
        sessions: r.many.session({
          from: r.user.id,
          to: r.session.userId
        })
      }
    };
  }
);
