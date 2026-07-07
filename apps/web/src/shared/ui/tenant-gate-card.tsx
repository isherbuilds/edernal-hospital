import { type ReactNode } from "react";

import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";

export type TenantGateCardProps = {
  description?: ReactNode;
  fieldDescription?: ReactNode;
  manualInputId: string;
  membershipError: unknown;
  membershipPending: boolean;
  membershipPendingText?: string;
  noOrganizationsDescription?: ReactNode;
  organizationOptions: Array<{ id: string; name: string }>;
  organizationsPending: boolean;
  tenantId: string;
  title?: ReactNode;
  variant?: "card" | "section";
  onTenantChange: (tenantId: string) => void;
};

export function TenantGateCard({
  description,
  fieldDescription,
  manualInputId,
  membershipError,
  membershipPending,
  membershipPendingText = "Checking organization roles…",
  noOrganizationsDescription = "No organizations were listed for this session.",
  organizationOptions,
  organizationsPending,
  tenantId,
  title,
  variant = "card",
  onTenantChange
}: TenantGateCardProps) {
  const content = (
    <>
      {title || description ? (
        <CardHeader>
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel>Tenant organization</FieldLabel>
            {organizationsPending ? (
              <p className="text-sm text-muted-foreground">Loading your organizations…</p>
            ) : null}
            {organizationOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {organizationOptions.map((organization) => (
                  <Button
                    key={organization.id}
                    className="h-auto flex-col items-start gap-1 rounded-2xl px-3 py-2"
                    type="button"
                    variant={tenantId === organization.id ? "default" : "outline"}
                    onClick={() => onTenantChange(organization.id)}
                  >
                    <span>{organization.name}</span>
                    <span className="font-mono text-xs opacity-80">{organization.id}</span>
                  </Button>
                ))}
              </div>
            ) : organizationsPending ? null : (
              <p className="text-sm text-muted-foreground">{noOrganizationsDescription}</p>
            )}
            {fieldDescription ? <FieldDescription>{fieldDescription}</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={manualInputId}>Manual organization ID fallback</FieldLabel>
            <Input
              id={manualInputId}
              autoComplete="off"
              className="max-w-sm"
              placeholder="org_..."
              value={tenantId}
              onChange={(event) => onTenantChange(event.currentTarget.value.trim())}
            />
          </Field>
        </FieldGroup>
        {membershipPending ? (
          <p className="text-sm text-muted-foreground">{membershipPendingText}</p>
        ) : null}
        {tenantId.length > 0 && membershipError ? (
          <p className="text-sm text-destructive" role="alert">
            Could not load your membership for this organization.
          </p>
        ) : null}
      </CardContent>
    </>
  );

  if (variant === "section") {
    return <section className="rounded-lg border p-4">{content}</section>;
  }

  return <Card>{content}</Card>;
}
