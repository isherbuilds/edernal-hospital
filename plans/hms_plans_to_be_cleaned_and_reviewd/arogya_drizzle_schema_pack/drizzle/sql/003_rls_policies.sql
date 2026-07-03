-- Baseline tenant isolation policies.
-- Do not enable this file against Better Auth's own tables until Better Auth session creation
-- and organization/team flows are adapted to set app.tenant_id.
--
-- Domain tables must include tenant_id. Tables without tenant_id should be protected by
-- application-level service APIs or separate policies.

create or replace function app.enforce_tenant(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select app.rls_bypass_enabled() or p_tenant_id is null or p_tenant_id = app.current_tenant_id()
$$;

-- Template used below:
--   alter table <table> enable row level security;
--   alter table <table> force row level security;
--   create policy <table>_tenant_isolation on <table>
--     using (app.enforce_tenant(tenant_id))
--     with check (app.enforce_tenant(tenant_id));

alter table tenants enable row level security;
alter table tenants force row level security;
drop policy if exists tenants_isolation on tenants;
create policy tenants_isolation on tenants
  using (app.rls_bypass_enabled() or id = app.current_tenant_id())
  with check (app.rls_bypass_enabled() or id = app.current_tenant_id());

-- RLS for standard tenant-scoped domain tables.
do $$
declare
  r record;
begin
  for r in
    select unnest(array[
      'tenant_key_versions',
      'facilities',
      'departments',
      'practitioners',
      'practitioner_roles',
      'user_tenant_profiles',
      'role_definitions',
      'user_role_assignments',
      'access_policy_rules',
      'break_glass_sessions',
      'support_access_grants',
      'fhir_resource_versions',
      'fhir_resource_current',
      'patient_projections',
      'patient_identifiers',
      'patient_merge_candidates',
      'patient_merges',
      'encounter_projections',
      'document_references',
      'object_blobs',
      'patient_consents',
      'tenant_config_pack_assignments',
      'payer_catalogs',
      'appointment_books',
      'appointments',
      'queue_boards',
      'queue_tokens',
      'encounter_lifecycle_events',
      'clinical_tasks',
      'prescription_drafts',
      'prescription_lines',
      'medication_safety_checks',
      'clinical_note_signatures',
      'service_catalogs',
      'tariff_plans',
      'tariff_items',
      'billable_order_projections',
      'invoices',
      'invoice_lines',
      'discount_requests',
      'payments',
      'refunds',
      'gst_ledger_entries',
      'claims',
      'claim_documents',
      'claim_pre_scrub_findings',
      'revenue_leakage_items',
      'day_close_runs',
      'scribe_sessions',
      'scribe_audio_chunks',
      'transcripts',
      'ai_generations',
      'ai_artifact_reviews',
      'ai_signoff_guards',
      'ocr_jobs',
      'ai_evaluation_datasets',
      'ai_evaluation_runs',
      'audit_events',
      'audit_immutable_batches',
      'fhir_provenance_records',
      'security_incidents',
      'tenant_export_jobs',
      'integration_connections',
      'integration_messages',
      'webhook_subscriptions',
      'webhook_deliveries',
      'abdm_patient_links',
      'abdm_consent_artifacts',
      'abdm_health_information_links',
      'whatsapp_messages',
      'hl7v2_messages',
      'edge_devices',
      'edge_sync_cursors',
      'edge_command_queue',
      'offline_queues',
      'bill_number_reservations',
      'idempotency_keys',
      'outbox_events',
      'inbox_processed_messages',
      'background_jobs',
      'migration_sources',
      'migration_mappings',
      'migration_runs',
      'migration_run_rows',
      'onboarding_checklists',
      'analytics_events',
      'metric_snapshots'
    ]) as table_name
  loop
    execute format('alter table %I enable row level security', r.table_name);
    execute format('alter table %I force row level security', r.table_name);
    execute format('drop policy if exists %I on %I', r.table_name || '_tenant_isolation', r.table_name);
    execute format(
      'create policy %I on %I using (app.enforce_tenant(tenant_id)) with check (app.enforce_tenant(tenant_id))',
      r.table_name || '_tenant_isolation',
      r.table_name
    );
  end loop;
end $$;
