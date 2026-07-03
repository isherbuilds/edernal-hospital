import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { jsonbArray, jsonbObj, lifecycleStatus, timestampColumns } from "./_shared";
import { tenants } from "./iam";

export const configPacks = pgTable(
  "config_packs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    geographyCode: varchar("geography_code", { length: 32 }).notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    status: lifecycleStatus("status").notNull().default("draft"),
    basePackId: uuid("base_pack_id"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    manifest: jsonbObj("manifest").notNull(),
    checksumSha256: text("checksum_sha256"),
    createdByUserId: text("created_by_user_id"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("config_pack_code_version_uq").on(t.code, t.version), index("config_pack_geo_idx").on(t.geographyCode, t.status)],
);

export const tenantConfigPackAssignments = pgTable(
  "tenant_config_pack_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull().default("primary"),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("tenant_config_pack_active_uq").on(t.tenantId, t.configPackId, t.purpose)],
);

export const identifierSystems = pgTable(
  "identifier_systems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    systemUri: text("system_uri").notNull(),
    displayName: text("display_name").notNull(),
    entityType: text("entity_type").notNull(),
    validationRegex: text("validation_regex"),
    maskingPattern: text("masking_pattern"),
    requiresVerification: boolean("requires_verification").notNull().default(false),
    isSensitive: boolean("is_sensitive").notNull().default(true),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("identifier_system_pack_code_uq").on(t.configPackId, t.code), uniqueIndex("identifier_system_uri_uq").on(t.systemUri)],
);

export const terminologyCodeSystems = pgTable(
  "terminology_code_systems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    systemUri: text("system_uri").notNull(),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    version: varchar("version", { length: 64 }),
    license: text("license"),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("code_system_uri_version_uq").on(t.systemUri, t.version), index("code_system_pack_idx").on(t.configPackId)],
);

export const terminologyConcepts = pgTable(
  "terminology_concepts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeSystemId: uuid("code_system_id")
      .notNull()
      .references(() => terminologyCodeSystems.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    display: text("display").notNull(),
    normalizedDisplay: text("normalized_display").notNull(),
    definition: text("definition"),
    synonyms: text("synonyms").array().notNull().default(sql`ARRAY[]::text[]`),
    properties: jsonbObj("properties"),
    status: lifecycleStatus("status").notNull().default("active"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("concept_code_system_code_uq").on(t.codeSystemId, t.code),
    index("concept_display_fts_idx").using("gin", sql`to_tsvector('simple', coalesce(${t.normalizedDisplay}, ''))`),
  ],
);

export const terminologyMaps = pgTable(
  "terminology_maps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    sourceSystemUri: text("source_system_uri").notNull(),
    sourceCode: text("source_code").notNull(),
    targetSystemUri: text("target_system_uri").notNull(),
    targetCode: text("target_code").notNull(),
    equivalence: text("equivalence").notNull().default("equivalent"),
    confidence: integer("confidence"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("terminology_map_uq").on(t.configPackId, t.sourceSystemUri, t.sourceCode, t.targetSystemUri, t.targetCode)],
);

export const drugCatalogs = pgTable(
  "drug_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    source: text("source").notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    license: text("license"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("drug_catalog_pack_code_version_uq").on(t.configPackId, t.code, t.version)],
);

export const drugProducts = pgTable(
  "drug_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drugCatalogId: uuid("drug_catalog_id")
      .notNull()
      .references(() => drugCatalogs.id, { onDelete: "cascade" }),
    productCode: varchar("product_code", { length: 128 }).notNull(),
    brandName: text("brand_name"),
    genericName: text("generic_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    ingredientCodes: text("ingredient_codes").array().notNull().default(sql`ARRAY[]::text[]`),
    strength: text("strength"),
    dosageForm: text("dosage_form"),
    route: text("route"),
    manufacturer: text("manufacturer"),
    rxNormCode: text("rxnorm_code"),
    atcCode: text("atc_code"),
    schedule: text("schedule"),
    isControlled: boolean("is_controlled").notNull().default(false),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("drug_product_catalog_code_uq").on(t.drugCatalogId, t.productCode),
    index("drug_product_name_fts_idx").using("gin", sql`to_tsvector('simple', coalesce(${t.normalizedName}, ''))`),
  ],
);

export const drugInteractionRules = pgTable(
  "drug_interaction_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drugCatalogId: uuid("drug_catalog_id")
      .notNull()
      .references(() => drugCatalogs.id, { onDelete: "cascade" }),
    ruleCode: varchar("rule_code", { length: 128 }).notNull(),
    ingredientCodes: text("ingredient_codes").array().notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    clinicalEffect: text("clinical_effect"),
    recommendation: text("recommendation"),
    evidenceLevel: text("evidence_level"),
    isBlocking: boolean("is_blocking").notNull().default(false),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("drug_interaction_rule_uq").on(t.drugCatalogId, t.ruleCode), index("drug_interaction_ingredients_gin_idx").using("gin", t.ingredientCodes)],
);

export const payerCatalogs = pgTable(
  "payer_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    configPackId: uuid("config_pack_id").references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    payerType: text("payer_type").notNull(),
    nhcxParticipantId: text("nhcx_participant_id"),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("payer_catalog_tenant_code_uq").on(t.tenantId, t.code)],
);

export const taxRules = pgTable(
  "tax_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    taxType: text("tax_type").notNull(),
    ratePercent: text("rate_percent").notNull(),
    appliesTo: jsonbObj("applies_to").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("tax_rule_pack_code_uq").on(t.configPackId, t.code, t.effectiveFrom)],
);

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    documentType: text("document_type").notNull(),
    language: varchar("language", { length: 32 }).notNull().default("en-IN"),
    templateEngine: text("template_engine").notNull().default("handlebars"),
    templateBody: text("template_body").notNull(),
    schema: jsonbObj("schema"),
    status: lifecycleStatus("status").notNull().default("active"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("document_template_pack_code_lang_uq").on(t.configPackId, t.code, t.language)],
);

export const languagePacks = pgTable(
  "language_packs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 32 }).notNull(),
    namespace: varchar("namespace", { length: 128 }).notNull(),
    messages: jsonbObj("messages").notNull(),
    status: lifecycleStatus("status").notNull().default("active"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("language_pack_namespace_locale_uq").on(t.configPackId, t.namespace, t.locale)],
);
