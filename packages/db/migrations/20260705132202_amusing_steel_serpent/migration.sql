CREATE TYPE "clinical_artifact_status" AS ENUM('preliminary', 'signed', 'superseded');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "facilities_tenant_id_id_unique" ON "facilities" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "practitioners_tenant_id_id_unique" ON "practitioners" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "patients_tenant_id_id_unique" ON "patients" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "encounters_tenant_id_id_unique" ON "encounters" ("tenant_id","id");--> statement-breakpoint
CREATE TABLE "consult_notes" (
	"advice" text DEFAULT '' NOT NULL,
	"complaints" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"diagnosis_code" text,
	"diagnosis_text" text DEFAULT '' NOT NULL,
	"encounter_id" uuid NOT NULL,
	"findings" text DEFAULT '' NOT NULL,
	"follow_up" text DEFAULT '' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"patient_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"signed_at" timestamp with time zone,
	"signed_by_user_id" text,
	"status" "clinical_artifact_status" DEFAULT 'preliminary'::"clinical_artifact_status" NOT NULL,
	"supersedes_consult_note_id" uuid,
	"tenant_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vitals" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formulary_items" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"default_dose_text" text DEFAULT '' NOT NULL,
	"form" text DEFAULT '' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"status" "tenant_resource_status" DEFAULT 'active'::"tenant_resource_status" NOT NULL,
	"strength" text DEFAULT '' NOT NULL,
	"tenant_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_templates" (
	"advice" text DEFAULT '' NOT NULL,
	"complaints" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"diagnosis_text" text DEFAULT '' NOT NULL,
	"findings" text DEFAULT '' NOT NULL,
	"follow_up" text DEFAULT '' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"specialty" text,
	"status" "tenant_resource_status" DEFAULT 'active'::"tenant_resource_status" NOT NULL,
	"tenant_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_lines" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dose" text DEFAULT '' NOT NULL,
	"duration" text DEFAULT '' NOT NULL,
	"formulary_item_id" uuid,
	"frequency" text DEFAULT '' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"instructions" text DEFAULT '' NOT NULL,
	"medication_text" text NOT NULL,
	"prescription_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"tenant_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"patient_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"signed_at" timestamp with time zone,
	"signed_by_user_id" text,
	"status" "clinical_artifact_status" DEFAULT 'preliminary'::"clinical_artifact_status" NOT NULL,
	"supersedes_prescription_id" uuid,
	"tenant_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "allergies" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "consult_notes_tenant_id_id_unique" ON "consult_notes" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "consult_notes_tenant_id_encounter_id_unique" ON "consult_notes" ("tenant_id","encounter_id") WHERE "status" <> 'superseded';--> statement-breakpoint
CREATE INDEX "consult_notes_tenant_id_patient_id_idx" ON "consult_notes" ("tenant_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consult_notes_tenant_id_supersedes_consult_note_id_unique" ON "consult_notes" ("tenant_id","supersedes_consult_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "formulary_items_tenant_id_id_unique" ON "formulary_items" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "formulary_items_tenant_id_name_strength_form_unique" ON "formulary_items" ("tenant_id","name","strength","form");--> statement-breakpoint
CREATE UNIQUE INDEX "note_templates_tenant_id_id_unique" ON "note_templates" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "note_templates_tenant_id_name_unique" ON "note_templates" ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_lines_tenant_id_id_unique" ON "prescription_lines" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_lines_tenant_id_prescription_id_sequence_unique" ON "prescription_lines" ("tenant_id","prescription_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "prescriptions_tenant_id_id_unique" ON "prescriptions" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescriptions_tenant_id_encounter_id_unique" ON "prescriptions" ("tenant_id","encounter_id") WHERE "status" <> 'superseded';--> statement-breakpoint
CREATE INDEX "prescriptions_tenant_id_patient_id_idx" ON "prescriptions" ("tenant_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescriptions_tenant_id_supersedes_prescription_id_unique" ON "prescriptions" ("tenant_id","supersedes_prescription_id");--> statement-breakpoint
ALTER TABLE "consult_notes" ADD CONSTRAINT "consult_notes_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "consult_notes" ADD CONSTRAINT "consult_notes_tenant_id_encounter_id_encounters_tenant_id_id_fk" FOREIGN KEY ("tenant_id","encounter_id") REFERENCES "encounters"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "consult_notes" ADD CONSTRAINT "consult_notes_tenant_id_patient_id_patients_tenant_id_id_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patients"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "consult_notes" ADD CONSTRAINT "consult_notes_tenant_id_practitioner_id_practitioners_tenant_id_id_fk" FOREIGN KEY ("tenant_id","practitioner_id") REFERENCES "practitioners"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "consult_notes" ADD CONSTRAINT "consult_notes_tenant_id_supersedes_consult_note_id_consult_notes_tenant_id_id_fk" FOREIGN KEY ("tenant_id","supersedes_consult_note_id") REFERENCES "consult_notes"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "formulary_items" ADD CONSTRAINT "formulary_items_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "note_templates" ADD CONSTRAINT "note_templates_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "prescription_lines" ADD CONSTRAINT "prescription_lines_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "prescription_lines" ADD CONSTRAINT "prescription_lines_tenant_id_prescription_id_prescriptions_tenant_id_id_fk" FOREIGN KEY ("tenant_id","prescription_id") REFERENCES "prescriptions"("tenant_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "prescription_lines" ADD CONSTRAINT "prescription_lines_tenant_id_formulary_item_id_formulary_items_tenant_id_id_fk" FOREIGN KEY ("tenant_id","formulary_item_id") REFERENCES "formulary_items"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_tenant_id_encounter_id_encounters_tenant_id_id_fk" FOREIGN KEY ("tenant_id","encounter_id") REFERENCES "encounters"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_tenant_id_patient_id_patients_tenant_id_id_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patients"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_tenant_id_practitioner_id_practitioners_tenant_id_id_fk" FOREIGN KEY ("tenant_id","practitioner_id") REFERENCES "practitioners"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_tenant_id_supersedes_prescription_id_prescriptions_tenant_id_id_fk" FOREIGN KEY ("tenant_id","supersedes_prescription_id") REFERENCES "prescriptions"("tenant_id","id") ON DELETE RESTRICT;