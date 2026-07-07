CREATE OR REPLACE FUNCTION prevent_signed_clinical_artifact_update()
RETURNS trigger AS $$
BEGIN
	IF OLD.status = 'superseded' THEN
		RAISE EXCEPTION '% rows with superseded status are immutable', TG_TABLE_NAME;
	END IF;

	IF OLD.status = 'signed' THEN
		IF NEW.status = 'superseded'
			AND to_jsonb(OLD) - 'status' - 'updated_at' = to_jsonb(NEW) - 'status' - 'updated_at' THEN
			RETURN NEW;
		END IF;

		RAISE EXCEPTION '% rows with signed status can only be superseded without other changes', TG_TABLE_NAME;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_signed_clinical_artifact_delete()
RETURNS trigger AS $$
BEGIN
	IF OLD.status IN ('signed', 'superseded') THEN
		RAISE EXCEPTION '% rows with signed or superseded status cannot be deleted', TG_TABLE_NAME;
	END IF;

	RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_prescription_line_signed_parent_mutation()
RETURNS trigger AS $$
DECLARE
	parent_status clinical_artifact_status;
BEGIN
	IF TG_OP IN ('UPDATE', 'DELETE') THEN
		SELECT status INTO parent_status
		FROM prescriptions
		WHERE tenant_id = OLD.tenant_id AND id = OLD.prescription_id;

		IF parent_status IN ('signed', 'superseded') THEN
			RAISE EXCEPTION 'prescription_lines cannot be mutated when parent prescription is signed or superseded';
		END IF;
	END IF;

	IF TG_OP IN ('INSERT', 'UPDATE') THEN
		SELECT status INTO parent_status
		FROM prescriptions
		WHERE tenant_id = NEW.tenant_id AND id = NEW.prescription_id;

		IF parent_status IN ('signed', 'superseded') THEN
			RAISE EXCEPTION 'prescription_lines cannot be mutated when parent prescription is signed or superseded';
		END IF;
	END IF;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER consult_notes_prevent_signed_update
BEFORE UPDATE ON consult_notes
FOR EACH ROW EXECUTE FUNCTION prevent_signed_clinical_artifact_update();
--> statement-breakpoint
CREATE TRIGGER consult_notes_prevent_signed_delete
BEFORE DELETE ON consult_notes
FOR EACH ROW EXECUTE FUNCTION prevent_signed_clinical_artifact_delete();
--> statement-breakpoint
CREATE TRIGGER prescriptions_prevent_signed_update
BEFORE UPDATE ON prescriptions
FOR EACH ROW EXECUTE FUNCTION prevent_signed_clinical_artifact_update();
--> statement-breakpoint
CREATE TRIGGER prescriptions_prevent_signed_delete
BEFORE DELETE ON prescriptions
FOR EACH ROW EXECUTE FUNCTION prevent_signed_clinical_artifact_delete();
--> statement-breakpoint
CREATE TRIGGER prescription_lines_prevent_signed_parent_mutation
BEFORE INSERT OR UPDATE OR DELETE ON prescription_lines
FOR EACH ROW EXECUTE FUNCTION prevent_prescription_line_signed_parent_mutation();
