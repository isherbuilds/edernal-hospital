# 0008: Accounting connectors use source-keyed export ledgers, connector epochs, and dry-run batches

**Status:** accepted (2026-07-04)

[ADR-0007](./0007-accounting-boundary-books-integration.md) decided that HMS
keeps operational billing and inventory facts while accounting systems receive a
one-way, PHI-free feed. This ADR defines the connector mechanics so HMS can
support Edernal Books, Tally, CSV, and later accounting packages without
duplicating postings or making counter workflows depend on an accounting system.

## Context

Hospitals may already use Tally or another accounting package. We cannot force a
design partner to switch immediately to Edernal Books, and a tenant may switch
destinations mid-year after months of partial exports. The exact sync gap may be
unknown. Users may also need stream-specific export, such as inventory valuation
only, without touching sales or payments.

External accounting systems differ in duplicate protection. Edernal Books can
eventually enforce idempotent imports because we control its API. Tally/XML/CSV
can carry our references, but a human can still import the same file outside HMS.
HMS therefore needs its own durable export ledger and preview flow.

## Decision

Build a connector-neutral accounting export stream inside HMS.

HMS writes source facts once and exports them through adapters:

- Edernal Books adapter
- Tally adapter
- CSV/register adapter
- future accounting adapters

Every accounting-relevant HMS fact gets a permanent source key and payload hash:

```text
hms:{tenantId}:{stream}:{sourceId}:{version}
```

Examples:

```text
hms:tenant_1:sales_invoice:inv_123:v1
hms:tenant_1:payment:pay_456:v1
hms:tenant_1:inventory_issue:issue_789:v1
hms:tenant_1:day_close:2026-07-03:v1
```

The hash covers the accounting payload, not PHI: accounts, business date,
amounts, tax buckets, item/stock facts, quantity, cost, and source references.

Add an HMS export ledger when connector implementation begins:

```text
accounting_connector
accounting_connector_epoch
accounting_mapping
accounting_export_batch
accounting_export_item
```

`accounting_connector_epoch` defines active date ranges per destination and
stream, for example Tally for sales/payments through 2026-06-30 and Edernal
Books from 2026-07-01. The same tenant may configure multiple destinations, but
one stream and date range must not have two active accounting destinations unless
the export is explicitly marked as duplicate/test.

`accounting_export_item` records:

- connector id
- stream
- source key
- payload hash
- business date
- external reference or voucher id when known
- status
- exported at
- posted at

## Sync Flow

Accounting sync is preview-first:

1. User chooses destination, date range, streams, and mode.
2. HMS prepares a dry-run batch from source facts.
3. HMS classifies each item:
   - `already_posted`
   - `external_match`
   - `new_to_post`
   - `changed_after_post`
   - `needs_review`
   - `mapping_missing`
4. User fixes mappings or matches existing external vouchers.
5. User posts the approved batch.

Retries use the same source keys and export items. A broad date range is safe:
known source keys are skipped or matched, new gaps are posted, and changed
payloads require correction/reversal instead of silent overwrite.

## Time Model

Store four distinct timestamps where connector work needs them:

```text
occurredAt    = when the hospital event happened
businessDate  = which hospital/accounting day owns it
exportedAt    = when HMS sent/generated the export
postedAt      = when the accounting destination accepted or was marked posted
```

Hospitals are 24/7, so midnight is not a universal accounting cutoff. Tenants
configure a business-day cutoff, such as 6 AM. Background workers may retry
delivery every few minutes, but the accounting batch is normally created from a
day-close or user-approved posting action, not from a hard midnight write.

## Stream-Specific Export

Streams are independent:

```text
sales
payments
purchase_bills
inventory_movements
inventory_valuation
tax_summary
```

A tenant may export only `inventory_valuation` for a date range without touching
sales or payments. This supports backfills, cutovers, and cases where one
external package already owns some accounting streams.

## External References

Every adapter should carry deterministic references wherever the destination
allows it:

```text
HMS-INV-inv_123
HMS-PAY-pay_456
HMS-DAYCLOSE-2026-07-03-SALES
HMS-STOCK-ISSUE-issue_789
```

If the destination cannot query or reject duplicate references, HMS still avoids
re-exporting from its own export ledger, but it cannot fully prevent a human from
importing the same file manually in the external product. The UI must make this
visible through match/mark-as-posted review steps.

## Corrections

After export, changed source facts do not mutate old accounting entries
silently. HMS emits a correction, reversal, or reclassification batch. If an
account mapping changes mid-year, old posted entries remain in history and new
entries use the effective-dated mapping. Reclassifications move balances between
old and new accounts when the user explicitly requests that.

## Inventory

For hospital pharmacy inventory, HMS remains the operational stock owner when
that module is built. HMS exports inventory valuation, COGS, write-offs, and
adjustments to the accounting destination. Edernal Books may own stock for
Books-native businesses, but it must not co-own the same hospital stock pool.

If HMS stores detailed stock facts before the accounting destination is ready,
the connector can later backfill from those source facts. If HMS stores only
daily totals, later imports can reconstruct totals but not batch-level stock
history.

## Alternatives Considered

### Edernal Books-only integration

Rejected. Edernal Books should be the preferred destination when it is ready, but
the product must support hospitals that continue with Tally or another accounting
package.

### Timestamp cursor sync

Rejected. The exact outage gap may be unknown, clocks can drift, and users need
safe broad-range backfills. Source keys and payload hashes are stronger.

### Direct live posting from every HMS event

Rejected. Hospital counters must not block on accounting system availability.
Some destinations are file-based or human-reviewed. Day-close and preview batches
fit hospital operations better.

### Dual-writing stock to HMS and accounting software

Rejected. One physical stock pool needs one stock ledger owner. Duplicate stock
ledgers create reconciliation failure.

## Consequences

- HMS needs an export ledger before automatic connector posting ships.
- The pilot can still start with CSV registers; the source-key model should shape
  filenames, references, and future import columns.
- Edernal Books import/public API work should accept external source keys and
  payload hashes from HMS-style adapters.
- Backfill and connector switching become explicit product workflows, not hidden
  side effects of a retry worker.
