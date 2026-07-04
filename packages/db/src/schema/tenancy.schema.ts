import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "#@/schema/auth.schema";

export type FacilityAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export const facilities = pgTable(
  "facilities",
  {
    address: jsonb("address").$type<FacilityAddress>().default({}).notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    gstin: text("gstin"),
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    status: text("status").default("active").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    timezone: text("timezone").default("Asia/Kolkata").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [uniqueIndex("facilities_tenant_id_code_unique").on(table.tenantId, table.code)]
);

export const practitioners = pgTable(
  "practitioners",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    displayName: text("display_name").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    registrationCouncil: text("registration_council").notNull(),
    registrationNumber: text("registration_number").notNull(),
    specialties: jsonb("specialties").$type<string[]>().default([]).notNull(),
    status: text("status").default("active").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" })
  },
  (table) => [
    uniqueIndex("practitioners_tenant_id_registration_unique").on(
      table.tenantId,
      table.registrationCouncil,
      table.registrationNumber
    )
  ]
);
