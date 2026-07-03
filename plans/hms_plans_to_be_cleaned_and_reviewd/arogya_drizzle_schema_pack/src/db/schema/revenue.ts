import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import {
  auditActorColumns,
  claimStatus,
  invoiceStatus,
  jsonbArray,
  jsonbObj,
  money,
  paymentStatus,
  percent,
  quantity,
  timestampColumns,
} from "./_shared";
import { tenants, facilities, departments } from "./iam";
import { payerCatalogs, taxRules } from "./config";

export const serviceCatalogs = pgTable(
  "service_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    serviceType: text("service_type").notNull(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    defaultChargeCode: text("default_charge_code"),
    isBillable: boolean("is_billable").notNull().default(true),
    isClinicalOrderable: boolean("is_clinical_orderable").notNull().default(true),
    taxRuleId: uuid("tax_rule_id").references(() => taxRules.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("service_catalog_tenant_code_uq").on(t.tenantId, t.code), index("service_catalog_type_idx").on(t.tenantId, t.serviceType)],
);

export const tariffPlans = pgTable(
  "tariff_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    payerId: uuid("payer_id").references(() => payerCatalogs.id, { onDelete: "set null" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("tariff_plan_tenant_code_uq").on(t.tenantId, t.code, t.effectiveFrom), index("tariff_plan_payer_idx").on(t.tenantId, t.payerId)],
);

export const tariffItems = pgTable(
  "tariff_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tariffPlanId: uuid("tariff_plan_id")
      .notNull()
      .references(() => tariffPlans.id, { onDelete: "cascade" }),
    serviceCatalogId: uuid("service_catalog_id")
      .notNull()
      .references(() => serviceCatalogs.id, { onDelete: "cascade" }),
    chargeCode: text("charge_code"),
    unitPrice: money("unit_price").notNull(),
    minPrice: money("min_price"),
    maxPrice: money("max_price"),
    taxRuleId: uuid("tax_rule_id").references(() => taxRules.id, { onDelete: "set null" }),
    packageRules: jsonbObj("package_rules"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("tariff_item_service_uq").on(t.tariffPlanId, t.serviceCatalogId)],
);

export const billableOrderProjections = pgTable(
  "billable_order_projections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    serviceRequestLogicalId: uuid("service_request_logical_id"),
    serviceCatalogId: uuid("service_catalog_id").references(() => serviceCatalogs.id, { onDelete: "set null" }),
    sourceResourceType: text("source_resource_type").notNull(),
    sourceLogicalId: uuid("source_logical_id").notNull(),
    description: text("description").notNull(),
    quantity: quantity("quantity").notNull().default("1"),
    status: text("status").notNull().default("ordered"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
    billedAt: timestamp("billed_at", { withTimezone: true }),
    invoiceLineId: uuid("invoice_line_id"),
    leakageDetectedAt: timestamp("leakage_detected_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("billable_order_source_uq").on(t.tenantId, t.sourceResourceType, t.sourceLogicalId),
    index("billable_order_unbilled_idx").on(t.tenantId, t.encounterLogicalId, t.status, t.orderedAt),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    fhirInvoiceLogicalId: uuid("fhir_invoice_logical_id"),
    invoiceNumber: text("invoice_number").notNull(),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id"),
    payerId: uuid("payer_id").references(() => payerCatalogs.id, { onDelete: "set null" }),
    tariffPlanId: uuid("tariff_plan_id").references(() => tariffPlans.id, { onDelete: "set null" }),
    status: invoiceStatus("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    subtotalAmount: money("subtotal_amount").notNull().default("0"),
    discountAmount: money("discount_amount").notNull().default("0"),
    taxAmount: money("tax_amount").notNull().default("0"),
    totalAmount: money("total_amount").notNull().default("0"),
    paidAmount: money("paid_amount").notNull().default("0"),
    balanceAmount: money("balance_amount").notNull().default("0"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedByUserId: text("finalized_by_user_id"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    gstInvoiceHash: text("gst_invoice_hash"),
    metadata: jsonbObj("metadata"),
    ...auditActorColumns,
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("invoice_number_facility_uq").on(t.tenantId, t.facilityId, t.invoiceNumber),
    index("invoice_patient_idx").on(t.tenantId, t.patientLogicalId, t.createdAt),
    index("invoice_status_idx").on(t.tenantId, t.status, t.finalizedAt),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    serviceCatalogId: uuid("service_catalog_id").references(() => serviceCatalogs.id, { onDelete: "set null" }),
    billableOrderId: uuid("billable_order_id").references(() => billableOrderProjections.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: quantity("quantity").notNull().default("1"),
    unitPrice: money("unit_price").notNull(),
    grossAmount: money("gross_amount").notNull(),
    discountAmount: money("discount_amount").notNull().default("0"),
    taxAmount: money("tax_amount").notNull().default("0"),
    netAmount: money("net_amount").notNull(),
    taxBreakup: jsonbArray<Record<string, unknown>>("tax_breakup"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("invoice_line_sequence_uq").on(t.invoiceId, t.sequence), index("invoice_line_order_idx").on(t.billableOrderId)],
);

export const discountRequests = pgTable(
  "discount_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").notNull(),
    approvedByUserId: text("approved_by_user_id"),
    status: text("status").notNull().default("requested"),
    discountType: text("discount_type").notNull(),
    discountPercent: percent("discount_percent"),
    discountAmount: money("discount_amount"),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("discount_request_status_idx").on(t.tenantId, t.status, t.requestedAt)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id"),
    paymentNumber: text("payment_number").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    method: text("method").notNull(),
    amount: money("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    gatewayProvider: text("gateway_provider"),
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    gatewaySettlementId: text("gateway_settlement_id"),
    collectedByUserId: text("collected_by_user_id"),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("payment_number_uq").on(t.tenantId, t.paymentNumber),
    index("payment_invoice_idx").on(t.invoiceId),
    index("payment_gateway_idx").on(t.gatewayProvider, t.gatewayPaymentId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    refundNumber: text("refund_number").notNull(),
    amount: money("amount").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    gatewayRefundId: text("gateway_refund_id"),
    requestedByUserId: text("requested_by_user_id"),
    approvedByUserId: text("approved_by_user_id"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("refund_number_uq").on(t.tenantId, t.refundNumber), index("refund_payment_idx").on(t.paymentId)],
);

export const gstLedgerEntries = pgTable(
  "gst_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    entryNumber: text("entry_number").notNull(),
    entryType: text("entry_type").notNull(), // invoice | credit_note | debit_note | refund
    gstin: text("gstin"),
    hsnSacCode: text("hsn_sac_code"),
    taxableAmount: money("taxable_amount").notNull(),
    cgstAmount: money("cgst_amount").notNull().default("0"),
    sgstAmount: money("sgst_amount").notNull().default("0"),
    igstAmount: money("igst_amount").notNull().default("0"),
    totalTaxAmount: money("total_tax_amount").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("gst_ledger_entry_number_uq").on(t.tenantId, t.facilityId, t.entryNumber), index("gst_ledger_invoice_idx").on(t.invoiceId)],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    payerId: uuid("payer_id").references(() => payerCatalogs.id, { onDelete: "set null" }),
    fhirClaimLogicalId: uuid("fhir_claim_logical_id"),
    claimNumber: text("claim_number").notNull(),
    status: claimStatus("status").notNull().default("draft"),
    claimType: text("claim_type").notNull().default("cashless"),
    requestedAmount: money("requested_amount"),
    approvedAmount: money("approved_amount"),
    settledAmount: money("settled_amount"),
    completenessScore: integer("completeness_score"),
    missingItems: jsonbArray<Record<string, unknown>>("missing_items"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    settlementAt: timestamp("settlement_at", { withTimezone: true }),
    externalClaimId: text("external_claim_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("claim_number_uq").on(t.tenantId, t.claimNumber), index("claim_status_idx").on(t.tenantId, t.status, t.submittedAt), index("claim_patient_idx").on(t.tenantId, t.patientLogicalId)],
);

export const claimDocuments = pgTable(
  "claim_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    documentReferenceId: uuid("document_reference_id").notNull(),
    checklistCode: text("checklist_code"),
    status: text("status").notNull().default("attached"),
    verifiedByUserId: text("verified_by_user_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("claim_document_uq").on(t.claimId, t.documentReferenceId)],
);

export const claimPreScrubFindings = pgTable(
  "claim_pre_scrub_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    findingCode: text("finding_code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    recommendation: text("recommendation"),
    status: text("status").notNull().default("open"),
    resolvedByUserId: text("resolved_by_user_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("claim_prescrub_open_idx").on(t.tenantId, t.claimId, t.status, t.severity)],
);

export const revenueLeakageItems = pgTable(
  "revenue_leakage_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    leakageType: text("leakage_type").notNull(),
    sourceId: uuid("source_id"),
    estimatedAmount: money("estimated_amount"),
    severity: text("severity").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: text("resolved_by_user_id"),
    resolution: text("resolution"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("revenue_leakage_open_idx").on(t.tenantId, t.facilityId, t.status, t.detectedAt)],
);

export const dayCloseRuns = pgTable(
  "day_close_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    businessDate: text("business_date").notNull(),
    status: text("status").notNull().default("running"),
    cashTotal: money("cash_total").notNull().default("0"),
    cardTotal: money("card_total").notNull().default("0"),
    upiTotal: money("upi_total").notNull().default("0"),
    gatewaySettlementTotal: money("gateway_settlement_total").notNull().default("0"),
    varianceAmount: money("variance_amount").notNull().default("0"),
    closedByUserId: text("closed_by_user_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    report: jsonbObj("report"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("day_close_facility_date_uq").on(t.tenantId, t.facilityId, t.businessDate)],
);
