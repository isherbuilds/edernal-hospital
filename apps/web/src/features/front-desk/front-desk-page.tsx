import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PatientOutput, PatientSexSchema } from "@tsu-stack/api/routers/patient/queries";
import { type QueueTokenOutput } from "@tsu-stack/api/routers/queue/queries";
import { authClient } from "@tsu-stack/auth/react/auth-client";
import { Button } from "@tsu-stack/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@tsu-stack/ui/components/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle
} from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Separator } from "@tsu-stack/ui/components/separator";
import { Spinner } from "@tsu-stack/ui/components/spinner";

import { Container } from "@/shared/ui/container";

type RegistrationDuplicatePrompt = {
  matches: PatientOutput[];
  phoneDigits: string;
};

type RegistrationForm = {
  addressLine1: string;
  ageYears: string;
  dateOfBirth: string;
  fullName: string;
  phone: string;
  sex: PatientOutput["sex"];
};

type QueueManagerStatus = Extract<QueueTokenOutput["status"], "done" | "skipped" | "waiting">;

const PATIENT_SEX_OPTIONS = PatientSexSchema.options;

function getPhoneDigits(value: string) {
  let digits = "";
  for (const character of value) {
    if (character >= "0" && character <= "9") {
      digits += character;
    }
  }
  return digits;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  const errorRecord =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
  const message = errorRecord?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function isRegisterAnywaySubmit(event: FormEvent<HTMLFormElement>) {
  const submitter = "submitter" in event.nativeEvent ? event.nativeEvent.submitter : null;
  return (
    submitter instanceof HTMLElement && submitter.dataset.registrationIntent === "register-anyway"
  );
}

function toPatientSex(value: string): PatientOutput["sex"] {
  switch (value) {
    case "female":
      return "female";
    case "male":
      return "male";
    case "other":
      return "other";
    default:
      return "unknown";
  }
}

export function FrontDeskPage() {
  const [tenantId, setTenantId] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const phoneSearchRef = useRef<HTMLInputElement>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientOutput | null>(null);
  const [registration, setRegistration] = useState<RegistrationForm>({
    addressLine1: "",
    ageYears: "",
    dateOfBirth: "",
    fullName: "",
    phone: "",
    sex: "unknown"
  });
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationDuplicatePrompt, setRegistrationDuplicatePrompt] =
    useState<RegistrationDuplicatePrompt | null>(null);
  const [registerAnywayPhoneDigits, setRegisterAnywayPhoneDigits] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [selectedPractitionerId, setSelectedPractitionerId] = useState("");
  const organizations = authClient.useListOrganizations();
  const tenantReady = tenantId.trim().length > 0;
  const phoneSearchDigits = getPhoneDigits(phoneSearch);
  const registrationPhoneDigits = getPhoneDigits(registration.phone);
  const activeRegistrationDuplicatePrompt =
    registrationDuplicatePrompt?.phoneDigits === registrationPhoneDigits
      ? registrationDuplicatePrompt
      : null;

  const facilities = useQuery({
    ...orpc.facility.list.queryOptions({ input: { tenantId } }),
    enabled: tenantReady
  });
  const practitioners = useQuery({
    ...orpc.practitioner.list.queryOptions({ input: { tenantId } }),
    enabled: tenantReady
  });
  const membership = useQuery({
    ...orpc.tenant.membership.queryOptions({ input: { tenantId } }),
    enabled: tenantReady
  });
  const organizationOptions = organizations.data ?? [];
  const memberRoles = membership.data?.roles ?? [];
  const membershipPending = tenantReady && membership.isPending;
  const canRegister = memberRoles.includes("front_desk");
  const canManageQueue =
    memberRoles.includes("front_desk") || memberRoles.includes("hospital_admin");
  const canStartConsult =
    memberRoles.includes("practitioner") || memberRoles.includes("hospital_admin");
  const defaultFacilityId =
    selectedFacilityId.length > 0 ? selectedFacilityId : (facilities.data?.[0]?.id ?? "");
  const defaultPractitionerId =
    selectedPractitionerId.length > 0
      ? selectedPractitionerId
      : (practitioners.data?.[0]?.id ?? "");
  const queueBoard = useQuery({
    ...orpc.queue.board.queryOptions({
      input: {
        facilityId: defaultFacilityId.length > 0 ? defaultFacilityId : undefined,
        tenantId
      }
    }),
    enabled: tenantReady,
    refetchInterval: 3000
  });
  const practitionerDay = useQuery({
    ...orpc.queue.practitionerDay.queryOptions({
      input: {
        practitionerId: defaultPractitionerId,
        tenantId
      }
    }),
    enabled: tenantReady && defaultPractitionerId.length > 0,
    refetchInterval: 3000
  });
  const patientSearch = useMutation(orpc.patient.searchByPhone.mutationOptions());
  const duplicateCheck = useMutation(orpc.patient.searchByPhone.mutationOptions());
  const quickRegister = useMutation(orpc.patient.quickRegister.mutationOptions());
  const checkIn = useMutation(orpc.queue.checkIn.mutationOptions());
  const reassign = useMutation(orpc.queue.reassign.mutationOptions());
  const startConsult = useMutation(orpc.queue.startConsult.mutationOptions());
  const updateStatus = useMutation(orpc.queue.updateStatus.mutationOptions());

  const searchedPatients = patientSearch.data ?? [];
  const duplicateWarnings = selectedPatient?.duplicateWarnings ?? [];
  const isBusy =
    quickRegister.isPending ||
    checkIn.isPending ||
    reassign.isPending ||
    startConsult.isPending ||
    updateStatus.isPending;

  function selectTenant(nextTenantId: string) {
    if (nextTenantId === tenantId) {
      return;
    }
    setTenantId(nextTenantId);
    setPhoneSearch("");
    setSelectedPatient(null);
    setRegistrationDuplicatePrompt(null);
    setRegisterAnywayPhoneDigits(null);
    setSelectedFacilityId("");
    setSelectedPractitionerId("");
    patientSearch.reset();
    duplicateCheck.reset();
  }

  // Operator terminal: first keystroke must land in phone lookup (<60s registration target).
  useEffect(() => {
    phoneSearchRef.current?.focus();
  }, []);

  const queueByStatus = useMemo(() => {
    const rows = (queueBoard.data ?? []).filter((token) => token.status !== "done");
    return {
      inConsult: rows.filter((token) => token.status === "in_consult"),
      skipped: rows.filter((token) => token.status === "skipped"),
      waiting: rows.filter((token) => token.status === "waiting")
    };
  }, [queueBoard.data]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantReady || phoneSearchDigits.length < 6) {
      return;
    }
    try {
      const patients = await patientSearch.mutateAsync({
        phone: phoneSearch,
        tenantId
      });
      setSelectedPatient(patients[0] ?? null);
      setRegistration((current) => {
        return { ...current, phone: phoneSearch };
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Patient search failed."));
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantReady || !canRegister) {
      if (tenantReady && !canRegister) {
        toast.error("Quick registration requires the front desk role.");
      }
      return;
    }
    const ageInput = registration.ageYears.trim();
    const dateOfBirth = registration.dateOfBirth.trim();
    const addressLine1 = registration.addressLine1.trim();
    const ageYears = ageInput.length > 0 ? Number(ageInput) : null;
    if (ageYears != null && (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > 130)) {
      setRegistrationError("Age must be a whole number between 0 and 130.");
      return;
    }
    if (ageYears == null && dateOfBirth.length === 0) {
      setRegistrationError("Enter age or date of birth.");
      return;
    }
    setRegistrationError(null);
    const registerAnywayRequested = isRegisterAnywaySubmit(event);
    try {
      if (
        registrationPhoneDigits.length >= 6 &&
        !registerAnywayRequested &&
        registerAnywayPhoneDigits !== registrationPhoneDigits
      ) {
        const matches = await duplicateCheck.mutateAsync({
          phone: registration.phone,
          tenantId
        });
        if (matches.length > 0) {
          setRegistrationDuplicatePrompt({ matches, phoneDigits: registrationPhoneDigits });
          setRegisterAnywayPhoneDigits(null);
          return;
        }
      }
      setRegistrationDuplicatePrompt(null);
      setRegisterAnywayPhoneDigits(null);
      const patient = await quickRegister.mutateAsync({
        ...(addressLine1.length > 0 ? { address: { line1: addressLine1 } } : {}),
        ...(ageYears != null ? { ageYears } : {}),
        ...(dateOfBirth.length > 0 ? { dateOfBirth } : {}),
        fullName: registration.fullName,
        phone: registration.phone,
        sex: registration.sex,
        tenantId
      });
      setSelectedPatient(patient);
      setPhoneSearch(patient.phone);
      try {
        await duplicateCheck.mutateAsync({ phone: patient.phone, tenantId });
      } catch {
        // Registration already succeeded; do not report a refresh failure as a registration failure.
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Quick registration failed."));
    }
  }

  async function refreshQueueViews() {
    await queueBoard.refetch();
    if (defaultPractitionerId.length > 0) {
      await practitionerDay.refetch();
    }
  }

  async function handleCheckIn() {
    if (!selectedPatient || !defaultFacilityId || !defaultPractitionerId || !canManageQueue) {
      if (selectedPatient && tenantReady && !canManageQueue) {
        toast.error("Issuing tokens requires the front desk or hospital admin role.");
      }
      return;
    }
    const input = {
      facilityId: defaultFacilityId,
      patientId: selectedPatient.id,
      practitionerId: defaultPractitionerId,
      tenantId
    };
    try {
      await checkIn.mutateAsync(input);
      setSelectedFacilityId(defaultFacilityId);
      setSelectedPractitionerId(defaultPractitionerId);
      await refreshQueueViews();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to issue token."));
    }
  }

  async function reassignToken(tokenId: string, practitionerId: string) {
    if (!canManageQueue) {
      toast.error("Moving tokens requires the front desk or hospital admin role.");
      return;
    }
    try {
      await reassign.mutateAsync({ practitionerId, tenantId, tokenId });
      await refreshQueueViews();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to move token."));
    }
  }

  async function moveToken(tokenId: string, status: QueueManagerStatus) {
    if (!canManageQueue) {
      toast.error("Updating tokens requires the front desk or hospital admin role.");
      return;
    }
    try {
      await updateStatus.mutateAsync({ status, tenantId, tokenId });
      await refreshQueueViews();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update token."));
    }
  }

  async function startConsultToken(tokenId: string) {
    if (!canStartConsult) {
      toast.error("Starting consults requires the practitioner or hospital admin role.");
      return;
    }
    try {
      await startConsult.mutateAsync({ tenantId, tokenId });
      await refreshQueueViews();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to start consult."));
    }
  }

  return (
    <Container className="flex flex-col gap-8 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Phase 1</p>
        <h1 className="font-display text-4xl">Front desk loop</h1>
        <p className="max-w-3xl text-muted-foreground">
          Phone lookup, quick registration, token issue, queue board, and practitioner day list. All
          patient and queue calls go through tenant-scoped audited procedures.
        </p>
      </header>

      <section className="rounded-lg border p-4">
        <FieldGroup>
          <Field>
            <FieldLabel>Tenant organization</FieldLabel>
            {organizations.isPending ? (
              <p className="text-sm text-muted-foreground">Loading your organizations…</p>
            ) : null}
            {organizationOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {organizationOptions.map((organization) => (
                  <Button
                    key={organization.id}
                    type="button"
                    variant={tenantId === organization.id ? "default" : "outline"}
                    className="h-auto flex-col items-start gap-1 rounded-2xl px-3 py-2"
                    onClick={() => selectTenant(organization.id)}
                  >
                    <span>{organization.name}</span>
                    <span className="font-mono text-xs opacity-80">{organization.id}</span>
                  </Button>
                ))}
              </div>
            ) : organizations.isPending ? null : (
              <p className="text-sm text-muted-foreground">
                No organizations were listed for this session. Use the manual fallback below if an
                administrator supplied an organization ID.
              </p>
            )}
            <FieldDescription>
              Client value is only a selector; the server verifies Better Auth membership before PHI
              access.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="tenant-id">Manual organization ID fallback</FieldLabel>
            <Input
              id="tenant-id"
              autoComplete="off"
              className="max-w-sm"
              value={tenantId}
              onChange={(event) => selectTenant(event.currentTarget.value.trim())}
              placeholder="org_..."
            />
          </Field>
        </FieldGroup>
        {membershipPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Checking your organization roles…</p>
        ) : null}
        {tenantReady && membership.error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            Could not load your membership for this organization.
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border p-4">
          <h2 className="font-display mb-4 text-2xl">1. Find or create patient</h2>
          <form className="flex flex-col gap-3" onSubmit={handleSearch}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="phone-search">Phone lookup</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    ref={phoneSearchRef}
                    id="phone-search"
                    inputMode="tel"
                    value={phoneSearch}
                    onChange={(event) => setPhoneSearch(event.currentTarget.value)}
                    placeholder="9876543210"
                  />
                  <Button
                    type="submit"
                    disabled={
                      !tenantReady || phoneSearchDigits.length < 6 || patientSearch.isPending
                    }
                  >
                    {patientSearch.isPending ? <Spinner /> : null}
                    Search
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </form>

          <div className="mt-4 flex flex-col gap-2">
            {searchedPatients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="rounded-lg border p-3 text-left hover:bg-muted"
                onClick={() => setSelectedPatient(patient)}
              >
                <span className="font-medium">{patient.fullName}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {patient.phone} · {patient.ageYears ?? "DOB"} · {patient.sex}
                </span>
              </button>
            ))}
          </div>

          <Separator className="my-5" />

          {canRegister ? (
            <form className="flex flex-col gap-4" onSubmit={handleRegister}>
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="patient-name">Name</FieldLabel>
                    <Input
                      id="patient-name"
                      value={registration.fullName}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setRegistration((current) => {
                          return { ...current, fullName: value };
                        });
                      }}
                      placeholder="Patient full name"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field>
                      <FieldLabel htmlFor="patient-phone">Phone</FieldLabel>
                      <Input
                        id="patient-phone"
                        inputMode="tel"
                        value={registration.phone}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setRegistrationDuplicatePrompt(null);
                          setRegisterAnywayPhoneDigits(null);
                          setRegistration((current) => {
                            return { ...current, phone: value };
                          });
                        }}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="patient-age">Age</FieldLabel>
                      <Input
                        id="patient-age"
                        inputMode="numeric"
                        value={registration.ageYears}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setRegistration((current) => {
                            return { ...current, ageYears: value };
                          });
                        }}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="patient-dob">DOB</FieldLabel>
                      <Input
                        id="patient-dob"
                        type="date"
                        value={registration.dateOfBirth}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setRegistration((current) => {
                            return { ...current, dateOfBirth: value };
                          });
                        }}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="patient-sex">Sex</FieldLabel>
                      <select
                        id="patient-sex"
                        className="h-9 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                        value={registration.sex}
                        onChange={(event) => {
                          const sex = toPatientSex(event.currentTarget.value);
                          setRegistration((current) => {
                            return { ...current, sex };
                          });
                        }}
                      >
                        {PATIENT_SEX_OPTIONS.map((sex) => (
                          <option key={sex} value={sex}>
                            {sex}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="patient-address">Address (optional)</FieldLabel>
                    <Input
                      id="patient-address"
                      value={registration.addressLine1}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setRegistration((current) => {
                          return { ...current, addressLine1: value };
                        });
                      }}
                      placeholder="Address line"
                    />
                  </Field>
                  {registrationError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {registrationError}
                    </p>
                  ) : null}
                  {activeRegistrationDuplicatePrompt ? (
                    <output className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                      <div>
                        <p className="font-medium">Possible existing patient for this phone.</p>
                        <p className="text-muted-foreground">
                          Select a match to use the existing patient, or register anyway only if
                          this is a different person.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {activeRegistrationDuplicatePrompt.matches.map((patient) => (
                          <Button
                            key={patient.id}
                            type="button"
                            variant="outline"
                            className="h-auto justify-start px-3 py-2 text-left"
                            onClick={() => {
                              setSelectedPatient(patient);
                              setPhoneSearch(patient.phone);
                              setRegistrationDuplicatePrompt(null);
                              setRegisterAnywayPhoneDigits(null);
                            }}
                          >
                            <span className="flex flex-col items-start">
                              <span>{patient.fullName}</span>
                              <span className="text-xs text-muted-foreground">
                                {patient.phone} · {patient.ageYears ?? "DOB"} · {patient.sex}
                              </span>
                            </span>
                          </Button>
                        ))}
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        data-registration-intent="register-anyway"
                        onClick={() => setRegisterAnywayPhoneDigits(registrationPhoneDigits)}
                      >
                        Register anyway
                      </Button>
                    </output>
                  ) : null}
                </FieldGroup>
              </FieldSet>
              <Button
                type="submit"
                disabled={!tenantReady || quickRegister.isPending || duplicateCheck.isPending}
              >
                {quickRegister.isPending ? <Spinner /> : null}
                Quick register
              </Button>
            </form>
          ) : (
            <p className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {membershipPending
                ? "Checking quick registration permissions…"
                : tenantReady
                  ? "Quick registration requires the front desk role."
                  : "Select an organization to load quick registration permissions."}
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-display mb-4 text-2xl">2. Issue token</h2>
          {selectedPatient ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-medium">{selectedPatient.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPatient.phone} · {selectedPatient.ageYears ?? "DOB recorded"} ·{" "}
                  {selectedPatient.sex}
                </p>
              </div>
              {duplicateWarnings.length > 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  Similar patient warning: {duplicateWarnings.length} patient record
                  {duplicateWarnings.length === 1 ? "" : "s"} already use this phone. Continue only
                  if this is a new registration.
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Facility</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {(facilities.data ?? []).map((facility) => (
                      <Button
                        key={facility.id}
                        type="button"
                        variant={defaultFacilityId === facility.id ? "default" : "outline"}
                        onClick={() => setSelectedFacilityId(facility.id)}
                      >
                        {facility.name}
                      </Button>
                    ))}
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Practitioner</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {(practitioners.data ?? []).map((practitioner) => (
                      <Button
                        key={practitioner.id}
                        type="button"
                        variant={defaultPractitionerId === practitioner.id ? "default" : "outline"}
                        onClick={() => setSelectedPractitionerId(practitioner.id)}
                      >
                        {practitioner.displayName}
                      </Button>
                    ))}
                  </div>
                </Field>
              </div>
              {canManageQueue ? (
                <Button
                  type="button"
                  disabled={isBusy || !defaultFacilityId || !defaultPractitionerId}
                  onClick={handleCheckIn}
                >
                  {checkIn.isPending ? <Spinner /> : null}
                  Issue token
                </Button>
              ) : (
                <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {membershipPending
                    ? "Checking token issue permissions…"
                    : "Issuing tokens requires the front desk or hospital admin role."}
                </p>
              )}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No patient selected</EmptyTitle>
                <EmptyDescription>
                  Search by phone or quick-register to issue a token.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">Queue board</h2>
              <p className="text-sm text-muted-foreground">Auto-refreshes every 3 seconds.</p>
            </div>
            {queueBoard.isFetching ? <Spinner /> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <QueueColumn
              title="Waiting"
              tokens={queueByStatus.waiting}
              practitioners={(practitioners.data ?? []).map((practitioner) => {
                return {
                  id: practitioner.id,
                  name: practitioner.displayName
                };
              })}
              canManageQueue={canManageQueue}
              canStartConsult={canStartConsult}
              onDone={(tokenId) => moveToken(tokenId, "done")}
              onReassign={reassignToken}
              onSkip={(tokenId) => moveToken(tokenId, "skipped")}
              onStart={startConsultToken}
            />
            <QueueColumn
              title="In consult"
              tokens={queueByStatus.inConsult}
              practitioners={[]}
              canManageQueue={canManageQueue}
              canStartConsult={canStartConsult}
              onDone={(tokenId) => moveToken(tokenId, "done")}
              onReassign={reassignToken}
              onSkip={(tokenId) => moveToken(tokenId, "skipped")}
              onStart={startConsultToken}
            />
            <QueueColumn
              title="Skipped"
              tokens={queueByStatus.skipped}
              practitioners={(practitioners.data ?? []).map((practitioner) => {
                return {
                  id: practitioner.id,
                  name: practitioner.displayName
                };
              })}
              canManageQueue={canManageQueue}
              canStartConsult={canStartConsult}
              onDone={(tokenId) => moveToken(tokenId, "done")}
              onReassign={reassignToken}
              onSkip={(tokenId) => moveToken(tokenId, "skipped")}
              onStart={startConsultToken}
            />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-display mb-4 text-2xl">Practitioner day list</h2>
          <FieldGroup>
            <Field>
              <FieldLabel>Practitioner filter</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(practitioners.data ?? []).map((practitioner) => (
                  <Button
                    key={practitioner.id}
                    type="button"
                    variant={selectedPractitionerId === practitioner.id ? "default" : "outline"}
                    onClick={() => setSelectedPractitionerId(practitioner.id)}
                  >
                    {practitioner.displayName}
                  </Button>
                ))}
              </div>
            </Field>
          </FieldGroup>
          <div className="mt-4 flex flex-col gap-2">
            {(practitionerDay.data ?? []).map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    #{token.sequence} {token.patientName}
                  </p>
                  <p className="text-sm text-muted-foreground">{token.status}</p>
                </div>
                {canStartConsult ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={token.status !== "waiting"}
                    onClick={() => startConsultToken(token.id)}
                  >
                    Start consult
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </Container>
  );
}

function QueueColumn({
  canManageQueue,
  canStartConsult,
  onDone,
  onReassign,
  onSkip,
  onStart,
  practitioners,
  title,
  tokens
}: {
  canManageQueue: boolean;
  canStartConsult: boolean;
  onDone: (tokenId: string) => void;
  onReassign: (tokenId: string, practitionerId: string) => void;
  onSkip: (tokenId: string) => void;
  onStart: (tokenId: string) => void;
  practitioners: Array<{ id: string; name: string }>;
  title: string;
  tokens: QueueTokenOutput[];
}) {
  return (
    <div className="flex min-h-60 flex-col gap-3 rounded-lg bg-muted/40 p-3">
      <FieldTitle>{title}</FieldTitle>
      {tokens.length === 0 ? <p className="text-sm text-muted-foreground">No tokens.</p> : null}
      {tokens.map((token) => (
        <div key={token.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3">
          <div>
            <p className="text-2xl font-semibold">#{token.sequence}</p>
            <p className="font-medium">{token.patientName}</p>
            <p className="text-sm text-muted-foreground">{token.practitionerName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canStartConsult && token.status === "waiting" ? (
              <Button type="button" size="sm" onClick={() => onStart(token.id)}>
                Start
              </Button>
            ) : null}
            {canManageQueue && token.status === "in_consult" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onDone(token.id)}>
                Done
              </Button>
            ) : null}
            {canManageQueue && token.status === "waiting" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onSkip(token.id)}>
                Skip
              </Button>
            ) : null}
          </div>
          {canManageQueue && practitioners.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {practitioners
                .filter((practitioner) => practitioner.id !== token.practitionerId)
                .map((practitioner) => (
                  <Button
                    key={practitioner.id}
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => onReassign(token.id, practitioner.id)}
                  >
                    Move to {practitioner.name}
                  </Button>
                ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
