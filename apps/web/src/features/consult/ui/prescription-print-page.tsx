import { useEffect, useRef } from "react";

import { type PrescriptionPrintOutput } from "@tsu-stack/api/routers/consult/queries";
import { Button } from "@tsu-stack/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";

import { useTenantGate } from "@/shared/lib/use-tenant-gate";
import { Container } from "@/shared/ui/container";
import { TenantGateCard } from "@/shared/ui/tenant-gate-card";

import { useGetPrescriptionPrintQuery } from "@/features/consult/api/get-prescription-print.query";
import { getErrorMessage } from "@/features/consult/ui/consult-form.helpers";

export function PrescriptionPrintPage({ prescriptionId }: { prescriptionId?: string }) {
  const {
    membership,
    organizationOptions,
    organizationsPending,
    roles,
    setTenantId,
    tenantId,
    tenantReady
  } = useTenantGate();
  const canViewPrint = roles.includes("practitioner") || roles.includes("hospital_admin");
  const printQuery = useGetPrescriptionPrintQuery(
    { prescriptionId: prescriptionId ?? "00000000-0000-0000-0000-000000000000", tenantId },
    { enabled: tenantReady && canViewPrint && Boolean(prescriptionId) }
  );
  const printedOnce = useRef(false);

  useEffect(() => {
    if (!printQuery.data || printedOnce.current || typeof window === "undefined") {
      return;
    }
    printedOnce.current = true;
    const timeoutId = window.setTimeout(() => window.print(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [printQuery.data]);

  return (
    <Container className="flex flex-col gap-6 py-8 print:block print:max-w-none print:p-0">
      <div className="print:hidden">
        <TenantGateCard
          description="Choose the organization before printing. The server prints signed prescriptions only."
          manualInputId="print-tenant-id"
          membershipError={membership.error}
          membershipPending={tenantReady && membership.isPending}
          organizationOptions={organizationOptions}
          organizationsPending={organizationsPending}
          tenantId={tenantId}
          title="Prescription print"
          onTenantChange={setTenantId}
        />
      </div>

      {!prescriptionId ? (
        <PrintEmptyState
          description="Open the print route from a signed prescription so the prescriptionId search parameter is present."
          title="Prescription ID missing"
        />
      ) : !tenantReady ? (
        <PrintEmptyState
          description="Choose the tenant that owns this signed prescription."
          title="Select an organization"
        />
      ) : tenantReady && membership.isPending ? (
        <PrintLoadingState label="Checking your clinical role…" />
      ) : membership.error ? (
        <PrintEmptyState
          description="The server could not verify your role for this organization."
          title="Membership could not be loaded"
        />
      ) : !canViewPrint ? (
        <PrintEmptyState
          description="Prescription printing requires the practitioner or hospital admin role."
          title="Not allowed"
        />
      ) : printQuery.isPending ? (
        <PrintLoadingState label="Loading signed prescription…" />
      ) : printQuery.error ? (
        <PrintEmptyState
          description={getErrorMessage(printQuery.error, "The prescription could not be printed.")}
          title="Prescription cannot be printed"
        />
      ) : printQuery.data ? (
        <>
          <div className="flex flex-wrap justify-end gap-2 print:hidden">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          </div>
          <PrescriptionPrintDocument payload={printQuery.data} />
        </>
      ) : null}
    </Container>
  );
}

function PrescriptionPrintDocument({ payload }: { payload: PrescriptionPrintOutput }) {
  const tenantName = payload.tenant.displayName ?? payload.tenant.legalName ?? "Hospital";
  const legalName = payload.tenant.legalName ?? tenantName;
  const allergies = payload.patient.allergies.trim();

  return (
    <article className="mx-auto max-w-5xl bg-white p-8 text-black shadow-sm ring-1 ring-black/10 print:m-0 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      <style>{`@media print { @page { margin: 16mm; } body { background: white !important; } }`}</style>
      <header className="border-b border-black pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between print:flex-row">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black">{tenantName}</h1>
            <p className="text-sm text-black">{legalName}</p>
            <p className="mt-2 text-base font-semibold text-black">{payload.facility.name}</p>
            <p className="max-w-2xl text-sm text-black">
              {formatAddress(payload.facility.address)}
            </p>
            {payload.facility.gstin ? (
              <p className="text-sm text-black">GSTIN: {payload.facility.gstin}</p>
            ) : null}
          </div>
          <div className="text-sm text-black md:text-right print:text-right">
            <p>Prescription</p>
            <p>Encounter: {payload.encounter.id}</p>
            <p>Date: {formatDateTime(payload.prescription.signedAt)}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 border-b border-black py-4 text-sm md:grid-cols-2 print:grid-cols-2">
        <div>
          <p className="font-semibold text-black">Patient</p>
          <p className="text-black">{payload.patient.fullName}</p>
          <p className="text-black">
            {formatPatientAgeSex(payload.patient.ageYears, payload.patient.sex)} · Phone{" "}
            {payload.patient.phone}
          </p>
        </div>
        <div className="rounded-none border border-black p-3">
          <p className="font-semibold text-black">Allergies</p>
          <p className="text-black">
            {allergies.length > 0 ? allergies : "No known allergies recorded"}
          </p>
        </div>
      </section>

      <section className="py-5">
        <Table>
          <TableHeader>
            <TableRow className="border-black hover:bg-transparent">
              <TableHead className="w-12 border border-black text-black">#</TableHead>
              <TableHead className="border border-black text-black">Medication</TableHead>
              <TableHead className="border border-black text-black">Dose</TableHead>
              <TableHead className="border border-black text-black">Frequency</TableHead>
              <TableHead className="border border-black text-black">Duration</TableHead>
              <TableHead className="border border-black text-black">Instructions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payload.prescription.lines.map((line, index) => (
              <TableRow key={line.id} className="border-black hover:bg-transparent">
                <TableCell className="border border-black text-black">{index + 1}</TableCell>
                <TableCell className="border border-black whitespace-normal text-black">
                  {line.medicationText}
                </TableCell>
                <TableCell className="border border-black whitespace-normal text-black">
                  {line.dose}
                </TableCell>
                <TableCell className="border border-black whitespace-normal text-black">
                  {line.frequency}
                </TableCell>
                <TableCell className="border border-black whitespace-normal text-black">
                  {line.duration}
                </TableCell>
                <TableCell className="border border-black whitespace-normal text-black">
                  {line.instructions}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <footer className="mt-12 flex justify-end text-sm text-black">
        <div className="min-w-64 text-left">
          <div className="mb-12 border-b border-black" />
          <p className="font-semibold text-black">{payload.practitioner.displayName}</p>
          <p className="text-black">
            {payload.practitioner.registrationCouncil} {payload.practitioner.registrationNumber}
          </p>
          <p className="text-black">Signature</p>
        </div>
      </footer>
    </article>
  );
}

function PrintLoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-2xl border print:hidden">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        <span>{label}</span>
      </div>
    </div>
  );
}

function PrintEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="min-h-64 print:hidden">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function formatAddress(address: PrescriptionPrintOutput["facility"]["address"]) {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : "Address not recorded";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

function formatPatientAgeSex(ageYears: number | null, sex: string) {
  const age = ageYears == null ? "Age not recorded" : `${ageYears}y`;
  const sexText = sex === "unknown" ? "sex not recorded" : sex;
  return `${age} / ${sexText}`;
}
