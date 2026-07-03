# ADR-009: Authorization Model — RBAC + ABAC + RLS

**Status:** Proposed for acceptance before real PHI ingestion  
**Date:** 2026-07-03  
**Decision owners:** Platform Lead, Security Lead, Product Lead, Clinical Advisor

---

## Context

The existing architecture already commits to OIDC, RBAC, tenant resolution, and Postgres row-level security. That is necessary but not sufficient for healthcare workflows.

Hospitals need boundaries between front desk, doctors, billing, hospital admin, IT admin, Arogya support, and patients. Tenant isolation prevents cross-hospital data leaks; it does not by itself prevent an internal user from browsing unrelated patient records.

---

## Decision

Arogya OS will use **layered authorization**:

1. **Authentication:** OIDC for all human users and signed service identity for service-to-service calls.
2. **RBAC:** coarse permissions by role.
3. **ABAC:** runtime policy checks using tenant, facility, patient relationship, encounter assignment, purpose of use, consent state, resource sensitivity, device/session risk, and emergency context.
4. **Database backstop:** Postgres RLS on all tenant-scoped tables and PHI projections.
5. **Deny by default:** every endpoint and background job must explicitly declare authorization requirements.
6. **Break-glass:** emergency access is allowed only with reason, time limit, elevated audit, and review queue.
7. **Support access:** Arogya staff do not have default PHI access. PHI access requires tenant approval, time-bound elevation, and audit.

---

## Core roles

| Role | Default access | Explicit restrictions |
|---|---|---|
| Front desk | Patient demographics, registration, queue, appointment, payment status. | No SOAP notes, diagnoses, labs, prescriptions, transcripts, or claim documents except explicitly approved front-desk views. |
| Doctor | Assigned/current patient chart, prescriptions, orders, signoff for own encounters. | Cannot browse unrelated patients without treatment relationship or break-glass. |
| Billing executive | Bills, charges, payments, claim checklist, payer-required attachments. | Cannot freely browse full clinical notes unless linked to claim/payment purpose. |
| Hospital admin/owner | Operational dashboards, user management, reports, audit summaries. | No unrestricted patient chart browsing by default. |
| IT admin | Users, devices, roles, configuration. | No clinical read access by default. |
| Arogya support | Tenant metadata, deployment health, non-PHI logs. | PHI access only via approved support session. |
| Patient | Own shared documents, bills, prescriptions, messages. | No provider/admin endpoints. |

---

## Required request context

Every authenticated request must carry or derive:

```text
tenant_id
facility_id
actor_user_id
actor_role
actor_practitioner_id? 
patient_id? 
encounter_id? 
purpose_of_use
session_id
device_id
client_app
request_id
trace_id
```

---

## Policy examples

### Patient registration

Front desk may create or update demographic fields for a patient in the same tenant and facility. Doctor may update limited demographic corrections during an encounter. Billing may view demographics necessary for invoice/claim. Support cannot view demographics unless an approved support session exists.

### Clinical chart read

Doctor may read chart if one of the following is true:

1. The patient is assigned to that doctor for the active encounter.
2. The doctor is in the patient care team for that visit.
3. The doctor uses break-glass access with reason.

Front desk, billing, hospital admin, and IT admin are denied by default for full chart read.

### Prescription finalization

Only a licensed clinician role assigned to the encounter may finalize `MedicationRequest`. AI service may create preliminary resources only. Billing and support are denied.

### Billing read

Billing executive may view encounter-linked orders and payer-required documents for billing purpose. Billing may not view full clinical narrative unless a claim checklist requires it and the access is audited with purpose `payment`.

### Export

Tenant export requires hospital admin approval plus Arogya admin workflow if Arogya operates the environment. Every export is audited and gets a manifest.

---

## Database enforcement

All PHI and tenant-owned tables must include `tenant_id` and RLS policies. This includes:

- FHIR resource versions.
- Relational projections.
- Patient search index.
- Queue and appointment tables.
- Invoice and GST ledger.
- Claims and payer documents.
- Audit events.
- Event outbox.
- Object metadata.
- Edge sync queues.
- Export jobs.

RLS does not replace application authorization. It is a blast-radius reduction control.

---

## Testing requirements

CI must include authorization tests for:

1. Front desk cannot read clinical note.
2. Billing cannot read full SOAP note unless claim-purpose policy allows it.
3. Doctor cannot read unrelated patient without break-glass.
4. IT admin cannot read PHI.
5. Arogya support cannot read PHI by default.
6. Cross-tenant read/write fails even if application bug omits tenant filter.
7. AI service cannot finalize any resource.
8. Preliminary resource cannot be externally shared.
9. Patient can access own prescription but not another patient's data.
10. Export requires approval and emits audit event.

---

## Consequences

### Positive

- Prevents most common insider and over-permission risks.
- Makes audit evidence defensible.
- Keeps RBAC manageable while supporting real clinical context.
- Allows pilot hospitals to trust that users see only what they need.

### Negative

- Adds policy work to every endpoint.
- Requires test harness and policy review discipline.
- Requires product managers to define purpose-of-use and role boundaries per feature.

---

## Non-negotiable engineering rule

A new endpoint or worker that touches PHI is not code-complete until its authorization policy and audit event are implemented and tested.

