import { type ComponentProps } from "react";

import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@tsu-stack/ui/components/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Field, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import { Textarea } from "@tsu-stack/ui/components/textarea";

export function TextField({
  label,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "onChange"> & {
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input {...props} onChange={(event) => onChange(event.currentTarget.value)} />
    </Field>
  );
}

export function TextareaField({
  label,
  value,
  readOnly,
  onChange
}: {
  label: string;
  readOnly: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </Field>
  );
}

export function ConfirmDialog({
  confirmLabel,
  description,
  isPending,
  open,
  title,
  onConfirm,
  onOpenChange
}: {
  confirmLabel: string;
  description: string;
  isPending: boolean;
  open: boolean;
  title: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button disabled={isPending} type="button" onClick={onConfirm}>
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const clinicalStatusBadgeMeta = {
  preliminary: { label: "Preliminary", variant: "secondary" },
  signed: { label: "Signed", variant: "default" },
  superseded: { label: "Superseded", variant: "outline" }
} satisfies Record<
  "preliminary" | "signed" | "superseded",
  { label: string; variant: ComponentProps<typeof Badge>["variant"] }
>;

export function ClinicalStatusBadge({
  status
}: {
  status: "preliminary" | "signed" | "superseded";
}) {
  const meta = clinicalStatusBadgeMeta[status];

  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-2xl border">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="min-h-64">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
