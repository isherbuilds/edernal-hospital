import { randomUUID } from "node:crypto";
import process from "node:process";

import { auth } from "@tsu-stack/auth/index";
import { type StaffRole } from "@tsu-stack/core/auth";
import { normalizePatientPhone } from "@tsu-stack/core/patient";
import { and, closeDb, db, eq } from "@tsu-stack/db";
import {
  encounters,
  facilities,
  formularyItems,
  member,
  noteTemplates,
  organization,
  patients,
  practitioners,
  tokens,
  user as authUser
} from "@tsu-stack/db/schema";
import { ENV_SERVER } from "@tsu-stack/env/server/env";

type SeedOrganization = {
  displayName: string;
  legalName: string;
  name: string;
  slug: string;
};

type SeedFacility = {
  address: {
    city: string;
    country: string;
    line1: string;
    postalCode: string;
    state: string;
  };
  code: string;
  name: string;
  timezone: string;
};

type SeedStaffUser = {
  email: string;
  employeeCode: string;
  name: string;
  practitioner?: {
    registrationCouncil: string;
    registrationNumber: string;
    specialties: string[];
  };
  role: StaffRole;
};

type SeedPatient = {
  ageYears: number;
  fullName: string;
  phone: string;
  sex: "male" | "female" | "other" | "unknown";
};

type SeedFormularyItem = {
  defaultDoseText: string;
  form: string;
  name: string;
  strength: string;
};

type SeedNoteTemplate = {
  advice: string;
  complaints: string;
  diagnosisText: string;
  findings: string;
  followUp: string;
  name: string;
  specialty?: string;
};

type SeedTenant = {
  facility: SeedFacility;
  organization: SeedOrganization;
  patients: SeedPatient[];
  staffUsers: SeedStaffUser[];
};

const SEED_TENANTS: SeedTenant[] = [
  {
    facility: {
      address: {
        city: "Bengaluru",
        country: "IN",
        line1: "Seed Campus",
        postalCode: "560001",
        state: "Karnataka"
      },
      code: "MAIN",
      name: "Main Hospital",
      timezone: "Asia/Kolkata"
    },
    organization: {
      displayName: "Edernal General Hospital",
      legalName: "Edernal General Hospital Private Limited",
      name: "Edernal General Hospital",
      slug: "edernal-general"
    },
    staffUsers: [
      {
        email: "admin@edernal.local",
        employeeCode: "ADM-001",
        name: "Seed Hospital Admin",
        role: "hospital_admin"
      },
      {
        email: "frontdesk@edernal.local",
        employeeCode: "FD-001",
        name: "Seed Front Desk",
        role: "front_desk"
      },
      {
        email: "doctor@edernal.local",
        employeeCode: "DOC-001",
        name: "Seed Practitioner",
        practitioner: {
          registrationCouncil: "NMC",
          registrationNumber: "SEED-0001",
          specialties: ["general_medicine"]
        },
        role: "practitioner"
      },
      {
        email: "billing@edernal.local",
        employeeCode: "BIL-001",
        name: "Seed Billing",
        role: "billing"
      },
      {
        email: "lab@edernal.local",
        employeeCode: "LAB-001",
        name: "Seed Pharmacy Lab",
        role: "pharmacy_lab"
      }
    ],
    patients: [
      {
        ageYears: 34,
        fullName: "Anita Rao",
        phone: "+91 98765 43210",
        sex: "female"
      },
      {
        ageYears: 41,
        fullName: "Rohan Mehta",
        phone: "99999 90000",
        sex: "male"
      }
    ]
  },
  {
    facility: {
      address: {
        city: "Delhi",
        country: "IN",
        line1: "North Wing",
        postalCode: "110001",
        state: "Delhi"
      },
      code: "MAIN",
      name: "North Clinic",
      timezone: "Asia/Kolkata"
    },
    organization: {
      displayName: "Edernal North Clinic",
      legalName: "Edernal North Clinic Private Limited",
      name: "Edernal North Clinic",
      slug: "edernal-north"
    },
    staffUsers: [
      {
        email: "admin@edernal-north.local",
        employeeCode: "ADM-101",
        name: "North Hospital Admin",
        role: "hospital_admin"
      },
      {
        email: "frontdesk@edernal-north.local",
        employeeCode: "FD-101",
        name: "North Front Desk",
        role: "front_desk"
      },
      {
        email: "doctor@edernal-north.local",
        employeeCode: "DOC-101",
        name: "North Practitioner",
        practitioner: {
          registrationCouncil: "NMC",
          registrationNumber: "SEED-0101",
          specialties: ["general_medicine"]
        },
        role: "practitioner"
      },
      {
        email: "billing@edernal-north.local",
        employeeCode: "BIL-101",
        name: "North Billing",
        role: "billing"
      },
      {
        email: "lab@edernal-north.local",
        employeeCode: "LAB-101",
        name: "North Pharmacy Lab",
        role: "pharmacy_lab"
      }
    ],
    patients: [
      {
        ageYears: 29,
        fullName: "Maya Shah",
        phone: "88888 80000",
        sex: "female"
      }
    ]
  }
];

const SEED_FORMULARY_ITEMS: SeedFormularyItem[] = [
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Paracetamol",
    strength: "500 mg"
  },
  {
    defaultDoseText: "1 capsule",
    form: "capsule",
    name: "Amoxicillin",
    strength: "500 mg"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Azithromycin",
    strength: "500 mg"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Cetirizine",
    strength: "10 mg"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Pantoprazole",
    strength: "40 mg"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Metformin",
    strength: "500 mg"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Amlodipine",
    strength: "5 mg"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Ibuprofen",
    strength: "400 mg"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Domperidone",
    strength: "10 mg"
  },
  {
    defaultDoseText: "1 sachet in 1 litre water",
    form: "sachet",
    name: "ORS",
    strength: ""
  },
  {
    defaultDoseText: "5 ml",
    form: "syrup",
    name: "Cough syrup",
    strength: "100 ml"
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Multivitamin",
    strength: ""
  },
  {
    defaultDoseText: "1 capsule weekly",
    form: "capsule",
    name: "Vitamin D3",
    strength: "60000 IU"
  },
  {
    defaultDoseText: "2 puffs",
    form: "inhaler",
    name: "Salbutamol",
    strength: ""
  },
  {
    defaultDoseText: "1 tablet",
    form: "tablet",
    name: "Rabeprazole",
    strength: "20 mg"
  }
];

const SEED_NOTE_TEMPLATES: SeedNoteTemplate[] = [
  {
    advice: "Hydration, rest, and warning signs explained.",
    complaints: "Fever with cough/cold symptoms.",
    diagnosisText: "Fever / upper respiratory infection.",
    findings: "General condition stable; throat and chest examined.",
    followUp: "Review in 2-3 days or earlier if symptoms worsen.",
    name: "Fever / URI",
    specialty: "General Medicine"
  },
  {
    advice: "Oral rehydration and light diet; return for dehydration warning signs.",
    complaints: "Loose stools and abdominal discomfort.",
    diagnosisText: "Acute gastroenteritis.",
    findings: "Hydration status assessed; abdomen soft.",
    followUp: "Review in 48 hours if not improving.",
    name: "Acute gastroenteritis",
    specialty: "General Medicine"
  },
  {
    advice: "Continue lifestyle measures and medication adherence.",
    complaints: "Routine blood pressure follow-up.",
    diagnosisText: "Hypertension follow-up.",
    findings: "Blood pressure reviewed; no acute symptoms reported.",
    followUp: "Follow up in 4 weeks with home BP readings.",
    name: "Hypertension follow-up",
    specialty: "General Medicine"
  }
];

async function ensureUser(input: SeedStaffUser, seedPassword: string) {
  const [existing] = await db
    .select()
    .from(authUser)
    .where(eq(authUser.email, input.email))
    .limit(1);
  if (existing) {
    return existing;
  }

  await auth.api.signUpEmail({
    body: {
      email: input.email,
      name: input.name,
      password: seedPassword
    }
  });

  const [created] = await db
    .select()
    .from(authUser)
    .where(eq(authUser.email, input.email))
    .limit(1);
  if (!created) {
    throw new Error(`Failed to create seed user ${input.email}`);
  }

  return created;
}

async function ensureOrganization(seed: SeedTenant) {
  const [existing] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, seed.organization.slug))
    .limit(1);
  if (existing) {
    return existing;
  }

  const id = randomUUID();
  const [created] = await db
    .insert(organization)
    .values({
      defaultTimezone: seed.facility.timezone,
      displayName: seed.organization.displayName,
      id,
      legalName: seed.organization.legalName,
      name: seed.organization.name,
      slug: seed.organization.slug
    })
    .returning();
  if (!created) {
    throw new Error(`Failed to create seed organization ${seed.organization.slug}`);
  }

  return created;
}

async function ensureMember(input: {
  employeeCode: string;
  organizationId: string;
  role: StaffRole;
  staffName: string;
  userId: string;
}) {
  const [existing] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, input.organizationId), eq(member.userId, input.userId)))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(member)
    .values({
      displayNameOverride: input.staffName,
      employeeCode: input.employeeCode,
      id: randomUUID(),
      organizationId: input.organizationId,
      role: input.role,
      userId: input.userId
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create seed organization member");
  }

  return created;
}

async function ensureFacility(tenantId: string, seed: SeedTenant) {
  const [existing] = await db
    .select()
    .from(facilities)
    .where(and(eq(facilities.tenantId, tenantId), eq(facilities.code, seed.facility.code)))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(facilities)
    .values({
      address: seed.facility.address,
      code: seed.facility.code,
      name: seed.facility.name,
      tenantId,
      timezone: seed.facility.timezone
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create seed Facility ${seed.facility.code}`);
  }

  return created;
}

async function ensurePractitioner(input: {
  staff: SeedStaffUser;
  tenantId: string;
  userId: string;
}) {
  const { staff, tenantId, userId } = input;
  if (!staff.practitioner) {
    return null;
  }

  const [existing] = await db
    .select()
    .from(practitioners)
    .where(
      and(
        eq(practitioners.tenantId, tenantId),
        eq(practitioners.registrationCouncil, staff.practitioner.registrationCouncil),
        eq(practitioners.registrationNumber, staff.practitioner.registrationNumber)
      )
    )
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(practitioners)
    .values({
      displayName: staff.name,
      registrationCouncil: staff.practitioner.registrationCouncil,
      registrationNumber: staff.practitioner.registrationNumber,
      specialties: staff.practitioner.specialties,
      tenantId,
      userId
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create seed Practitioner");
  }

  return created;
}

async function ensurePatient(tenantId: string, seed: SeedPatient) {
  const phoneNormalized = normalizePatientPhone(seed.phone);
  const [existing] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.tenantId, tenantId), eq(patients.phoneNormalized, phoneNormalized)))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(patients)
    .values({
      address: {},
      ageYears: seed.ageYears,
      fullName: seed.fullName,
      phone: seed.phone,
      phoneNormalized,
      sex: seed.sex,
      tenantId
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create seed Patient ${seed.fullName}`);
  }

  return created;
}

async function ensureSeedToken(input: {
  facilityId: string;
  patientId: string;
  practitionerId: string;
  sequence: number;
  tenantId: string;
  tokenDate: string;
}) {
  const [existing] = await db
    .select()
    .from(tokens)
    .where(
      and(
        eq(tokens.tenantId, input.tenantId),
        eq(tokens.patientId, input.patientId),
        eq(tokens.tokenDate, input.tokenDate)
      )
    )
    .limit(1);
  if (existing) {
    return existing;
  }

  return db.transaction(async (tx) => {
    const [encounter] = await tx
      .insert(encounters)
      .values({
        facilityId: input.facilityId,
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        status: "planned",
        tenantId: input.tenantId
      })
      .returning();

    if (!encounter) {
      throw new Error("Failed to create seed Encounter");
    }

    const [token] = await tx
      .insert(tokens)
      .values({
        encounterId: encounter.id,
        facilityId: input.facilityId,
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        sequence: input.sequence,
        status: "waiting",
        tenantId: input.tenantId,
        tokenDate: input.tokenDate
      })
      .returning();

    if (!token) {
      throw new Error("Failed to create seed Queue token");
    }

    return token;
  });
}

async function ensureFormularyItem(tenantId: string, seed: SeedFormularyItem) {
  const [existing] = await db
    .select()
    .from(formularyItems)
    .where(
      and(
        eq(formularyItems.tenantId, tenantId),
        eq(formularyItems.name, seed.name),
        eq(formularyItems.strength, seed.strength),
        eq(formularyItems.form, seed.form)
      )
    )
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(formularyItems)
    .values({
      defaultDoseText: seed.defaultDoseText,
      form: seed.form,
      name: seed.name,
      strength: seed.strength,
      tenantId
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create seed Formulary item ${seed.name}`);
  }

  return created;
}

async function ensureNoteTemplate(tenantId: string, seed: SeedNoteTemplate) {
  const [existing] = await db
    .select()
    .from(noteTemplates)
    .where(and(eq(noteTemplates.tenantId, tenantId), eq(noteTemplates.name, seed.name)))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(noteTemplates)
    .values({
      advice: seed.advice,
      complaints: seed.complaints,
      diagnosisText: seed.diagnosisText,
      findings: seed.findings,
      followUp: seed.followUp,
      name: seed.name,
      specialty: seed.specialty ?? null,
      tenantId
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create seed Note Template ${seed.name}`);
  }

  return created;
}
async function main() {
  if (ENV_SERVER.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to run seed against production without ALLOW_PRODUCTION_SEED=true");
  }

  if (!ENV_SERVER.SEED_PASSWORD) {
    throw new Error("SEED_PASSWORD is required to create seed Staff User accounts.");
  }

  let seededStaffCount = 0;
  let seededPatientCount = 0;
  let seededFormularyItemCount = 0;
  let seededNoteTemplateCount = 0;

  for (const seed of SEED_TENANTS) {
    const organizationRow = await ensureOrganization(seed);
    const facilityRow = await ensureFacility(organizationRow.id, seed);
    let primaryPractitionerId: string | null = null;
    for (const staff of seed.staffUsers) {
      const userRow = await ensureUser(staff, ENV_SERVER.SEED_PASSWORD);
      await ensureMember({
        employeeCode: staff.employeeCode,
        organizationId: organizationRow.id,
        role: staff.role,
        staffName: staff.name,
        userId: userRow.id
      });
      const practitionerRow = await ensurePractitioner({
        staff,
        tenantId: organizationRow.id,
        userId: userRow.id
      });
      primaryPractitionerId ??= practitionerRow?.id ?? null;
      seededStaffCount += 1;
    }

    if (primaryPractitionerId) {
      const tokenDate = new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone: seed.facility.timezone,
        year: "numeric"
      }).format(new Date());

      for (const [index, patientSeed] of seed.patients.entries()) {
        const patientRow = await ensurePatient(organizationRow.id, patientSeed);
        await ensureSeedToken({
          facilityId: facilityRow.id,
          patientId: patientRow.id,
          practitionerId: primaryPractitionerId,
          sequence: index + 1,
          tenantId: organizationRow.id,
          tokenDate
        });
        seededPatientCount += 1;
      }
    }

    for (const itemSeed of SEED_FORMULARY_ITEMS) {
      await ensureFormularyItem(organizationRow.id, itemSeed);
      seededFormularyItemCount += 1;
    }

    for (const templateSeed of SEED_NOTE_TEMPLATES) {
      await ensureNoteTemplate(organizationRow.id, templateSeed);
      seededNoteTemplateCount += 1;
    }
  }

  const adminEmails = SEED_TENANTS.flatMap((seed) =>
    seed.staffUsers.filter((staff) => staff.role === "hospital_admin").map((staff) => staff.email)
  ).join(", ");

  process.stdout.write(
    `Seeded ${SEED_TENANTS.length} Tenants with ${seededStaffCount} staff users, ` +
      `${seededPatientCount} front-desk patients, ${seededFormularyItemCount} Formulary items, ` +
      `and ${seededNoteTemplateCount} Note Templates. ` +
      "Seed password source: SEED_PASSWORD environment variable. " +
      `Hospital admin users: ${adminEmails}.\n`
  );
}

try {
  await main();
} finally {
  await closeDb();
}
