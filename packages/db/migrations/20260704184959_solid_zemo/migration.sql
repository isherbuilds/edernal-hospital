CREATE TYPE "encounter_status" AS ENUM('planned', 'in_progress', 'finished');--> statement-breakpoint
CREATE TYPE "patient_sex" AS ENUM('male', 'female', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "token_status" AS ENUM('waiting', 'in_consult', 'done', 'skipped');--> statement-breakpoint
CREATE TABLE "encounters" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"facility_id" uuid NOT NULL,
	"finished_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"patient_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"status" "encounter_status" DEFAULT 'planned'::"encounter_status" NOT NULL,
	"tenant_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_identifiers" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"patient_id" uuid NOT NULL,
	"system" text NOT NULL,
	"tenant_id" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"address" jsonb DEFAULT '{}' NOT NULL,
	"age_years" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date_of_birth" date,
	"full_name" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"phone" text NOT NULL,
	"phone_normalized" text NOT NULL,
	"sex" "patient_sex" DEFAULT 'unknown'::"patient_sex" NOT NULL,
	"tenant_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"patient_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"status" "token_status" DEFAULT 'waiting'::"token_status" NOT NULL,
	"tenant_id" text NOT NULL,
	"token_date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_tenant_id_id_unique" ON "facilities" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "practitioners_tenant_id_id_unique" ON "practitioners" ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "encounters_tenant_id_patient_id_idx" ON "encounters" ("tenant_id","patient_id");--> statement-breakpoint
CREATE INDEX "encounters_tenant_id_practitioner_id_status_idx" ON "encounters" ("tenant_id","practitioner_id","status");--> statement-breakpoint
CREATE INDEX "patient_identifiers_tenant_id_patient_id_idx" ON "patient_identifiers" ("tenant_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_identifiers_tenant_id_system_value_unique" ON "patient_identifiers" ("tenant_id","system","value");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_tenant_id_id_unique" ON "patients" ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "patients_tenant_id_phone_normalized_idx" ON "patients" ("tenant_id","phone_normalized");--> statement-breakpoint
CREATE INDEX "patients_tenant_id_full_name_idx" ON "patients" ("tenant_id","full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "encounters_tenant_id_id_unique" ON "encounters" ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_tenant_id_encounter_id_unique" ON "tokens" ("tenant_id","encounter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_tenant_id_practitioner_id_date_sequence_unique" ON "tokens" ("tenant_id","practitioner_id","token_date","sequence");--> statement-breakpoint
CREATE INDEX "tokens_tenant_id_facility_id_date_status_idx" ON "tokens" ("tenant_id","facility_id","token_date","status");--> statement-breakpoint
CREATE INDEX "tokens_tenant_id_practitioner_id_date_idx" ON "tokens" ("tenant_id","practitioner_id","token_date");--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_facility_id_facilities_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practitioner_id_practitioners_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "patient_identifiers" ADD CONSTRAINT "patient_identifiers_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "patient_identifiers" ADD CONSTRAINT "patient_identifiers_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_encounter_id_encounters_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_facility_id_facilities_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_practitioner_id_practitioners_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_tenant_id_organization_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "patient_identifiers" ADD CONSTRAINT "patient_identifiers_tenant_id_patient_id_patients_tenant_id_id_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patients"("tenant_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_tenant_id_facility_id_facilities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","facility_id") REFERENCES "facilities"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_tenant_id_patient_id_patients_tenant_id_id_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patients"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_tenant_id_practitioner_id_practitioners_tenant_id_id_fk" FOREIGN KEY ("tenant_id","practitioner_id") REFERENCES "practitioners"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_tenant_id_encounter_id_encounters_tenant_id_id_fk" FOREIGN KEY ("tenant_id","encounter_id") REFERENCES "encounters"("tenant_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_tenant_id_facility_id_facilities_tenant_id_id_fk" FOREIGN KEY ("tenant_id","facility_id") REFERENCES "facilities"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_tenant_id_patient_id_patients_tenant_id_id_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patients"("tenant_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_tenant_id_practitioner_id_practitioners_tenant_id_id_fk" FOREIGN KEY ("tenant_id","practitioner_id") REFERENCES "practitioners"("tenant_id","id") ON DELETE RESTRICT;