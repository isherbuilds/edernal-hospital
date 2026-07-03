import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Better Auth schema snapshot for Arogya OS.
 *
 * Source of truth at runtime should be the Better Auth config in src/lib/auth/auth.example.ts.
 * Regenerate this file whenever Better Auth or plugins change:
 *   npx auth@latest generate
 *   npx drizzle-kit generate
 *
 * Included plugins/tables:
 * - Core: user, session, account, verification
 * - Admin plugin: role/banned/ban fields on user
 * - Phone Number plugin: phoneNumber/phoneNumberVerified on user
 * - 2FA plugin: twoFactorEnabled on user + twoFactor table
 * - Organization plugin with teams and organizationRole
 * - Passkey plugin
 * - API Key plugin
 * - JWT plugin: jwks
 * - OAuth Provider plugin: oauthClient, oauthRefreshToken, oauthAccessToken, oauthConsent
 */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),

    // Better Auth admin plugin
    role: text("role"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),

    // Better Auth phone-number plugin
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),

    // Better Auth two-factor plugin
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),

    // Arogya OS additional fields surfaced through Better Auth additionalFields
    defaultTenantId: uuid("default_tenant_id"),
    defaultFacilityId: uuid("default_facility_id"),
    locale: varchar("locale", { length: 32 }).notNull().default("en-IN"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    profileCompleteness: integer("profile_completeness").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("user_phone_number_uq").on(t.phoneNumber),
    index("user_default_tenant_idx").on(t.defaultTenantId),
    index("user_role_idx").on(t.role),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    // Better Auth organization plugin
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),

    // Arogya OS context pinned into the session for fast request context creation.
    activeTenantId: uuid("active_tenant_id"),
    activeFacilityId: uuid("active_facility_id"),
    activePurposeOfUse: text("active_purpose_of_use"),
    activePractitionerId: uuid("active_practitioner_id"),
    assuranceLevel: text("assurance_level").notNull().default("aal1"),
    deviceId: text("device_id"),
  },
  (t) => [
    uniqueIndex("session_token_uq").on(t.token),
    index("session_user_idx").on(t.userId),
    index("session_active_tenant_idx").on(t.activeTenantId),
    index("session_expires_idx").on(t.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_provider_account_uq").on(t.providerId, t.accountId),
    index("account_user_idx").on(t.userId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verification_identifier_idx").on(t.identifier),
    index("verification_expires_idx").on(t.expiresAt),
  ],
);

export const twoFactor = pgTable(
  "twoFactor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(false),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [uniqueIndex("two_factor_user_uq").on(t.userId), index("two_factor_locked_until_idx").on(t.lockedUntil)],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    // Arogya OS extension: bind Better Auth organizations to HMS tenants.
    tenantId: uuid("tenant_id"),
    deploymentModel: text("deployment_model").notNull().default("dedicated_tenant"),
    region: text("region").notNull().default("in-west"),
  },
  (t) => [uniqueIndex("organization_slug_uq").on(t.slug), uniqueIndex("organization_tenant_uq").on(t.tenantId)],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    // Arogya OS extension fields
    facilityIds: jsonb("facility_ids").$type<string[]>(),
    practitionerId: uuid("practitioner_id"),
    departmentIds: jsonb("department_ids").$type<string[]>(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("member_user_org_uq").on(t.userId, t.organizationId),
    index("member_org_idx").on(t.organizationId),
    index("member_role_idx").on(t.role),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    teamId: text("team_id"),

    // Arogya OS invite context
    tenantId: uuid("tenant_id"),
    facilityIds: jsonb("facility_ids").$type<string[]>(),
    purpose: text("purpose"),
  },
  (t) => [
    index("invitation_org_idx").on(t.organizationId),
    index("invitation_email_idx").on(sql`lower(${t.email})`),
    index("invitation_status_idx").on(t.status),
  ],
);

export const organizationRole = pgTable(
  "organizationRole",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),

    // Arogya OS permission pack metadata
    description: text("description"),
    isSystemRole: boolean("is_system_role").notNull().default(false),
    clinicalScope: jsonb("clinical_scope").$type<Record<string, unknown>>(),
  },
  (t) => [uniqueIndex("org_role_perm_uq").on(t.organizationId, t.role, t.permission)],
);

export const team = pgTable(
  "team",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),

    // Arogya OS extension
    facilityId: uuid("facility_id"),
    departmentId: uuid("department_id"),
    specialtyCode: text("specialty_code"),
  },
  (t) => [index("team_org_idx").on(t.organizationId), uniqueIndex("team_org_name_uq").on(t.organizationId, t.name)],
);

export const teamMember = pgTable(
  "teamMember",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("team_member_uq").on(t.teamId, t.userId), index("team_member_user_idx").on(t.userId)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type"),
    backedUp: boolean("backed_up"),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("passkey_credential_uq").on(t.credentialID), index("passkey_user_idx").on(t.userId)],
);

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    referenceId: text("reference_id").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").notNull().default(false),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count"),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    permissions: text("permissions"),
    metadata: text("metadata"),

    // Arogya OS extension: scopes for internal service accounts/integration agents.
    tenantId: uuid("tenant_id"),
    facilityId: uuid("facility_id"),
    purposeOfUse: text("purpose_of_use"),
  },
  (t) => [
    uniqueIndex("apikey_key_uq").on(t.key),
    index("apikey_reference_idx").on(t.referenceId),
    index("apikey_config_idx").on(t.configId),
    index("apikey_tenant_idx").on(t.tenantId),
  ],
);

export const jwks = pgTable(
  "jwks",
  {
    id: text("id").primaryKey(),
    publicKey: text("public_key").notNull(),
    privateKey: text("private_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    keyUse: text("key_use").notNull().default("sig"),
    algorithm: text("algorithm").notNull().default("EdDSA"),
    kmsKeyId: text("kms_key_id"),
  },
  (t) => [index("jwks_expires_idx").on(t.expiresAt)],
);

export const oauthClient = pgTable(
  "oauthClient",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret"),
    disabled: boolean("disabled").notNull().default(false),
    skipConsent: boolean("skip_consent").notNull().default(false),
    enableEndSession: boolean("enable_end_session").notNull().default(false),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    public: boolean("public"),
    type: text("type"),
    requirePKCE: boolean("require_pkce").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [uniqueIndex("oauth_client_client_id_uq").on(t.clientId), index("oauth_client_reference_idx").on(t.referenceId)],
);

export const oauthRefreshToken = pgTable(
  "oauthRefreshToken",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    scopes: text("scopes").array().notNull(),
    revoked: timestamp("revoked", { withTimezone: true }),
    authTime: timestamp("auth_time", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("oauth_refresh_token_uq").on(t.token), index("oauth_refresh_client_idx").on(t.clientId), index("oauth_refresh_user_idx").on(t.userId)],
);

export const oauthAccessToken = pgTable(
  "oauthAccessToken",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("oauth_access_token_uq").on(t.token), index("oauth_access_client_idx").on(t.clientId), index("oauth_access_user_idx").on(t.userId)],
);

export const oauthConsent = pgTable(
  "oauthConsent",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("oauth_consent_user_client_reference_uq").on(t.userId, t.clientId, t.referenceId)],
);
