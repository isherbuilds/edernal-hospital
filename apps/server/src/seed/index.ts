import { randomUUID } from "node:crypto";
import process from "node:process";

import { auth } from "@tsu-stack/auth/index";
import { type StaffRole } from "@tsu-stack/core/auth";
import { and, closeDb, db, eq } from "@tsu-stack/db";
import {
  facilities,
  member,
  organization,
  practitioners,
  user as authUser
} from "@tsu-stack/db/schema";
import { ENV_SERVER } from "@tsu-stack/env/server/env";

const SEED_PASSWORD = "EdernalDev#2026";

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

type SeedTenant = {
  facility: SeedFacility;
  organization: SeedOrganization;
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
    ]
  }
];

async function ensureUser(input: SeedStaffUser) {
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
      password: SEED_PASSWORD
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
  await db.insert(organization).values({
    defaultTimezone: seed.facility.timezone,
    displayName: seed.organization.displayName,
    id,
    legalName: seed.organization.legalName,
    name: seed.organization.name,
    slug: seed.organization.slug
  });

  const [created] = await db.select().from(organization).where(eq(organization.id, id)).limit(1);
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
async function main() {
  if (ENV_SERVER.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to run seed against production without ALLOW_PRODUCTION_SEED=true");
  }

  let seededStaffCount = 0;

  for (const seed of SEED_TENANTS) {
    const organizationRow = await ensureOrganization(seed);
    await ensureFacility(organizationRow.id, seed);

    for (const staff of seed.staffUsers) {
      const userRow = await ensureUser(staff);
      await ensureMember({
        employeeCode: staff.employeeCode,
        organizationId: organizationRow.id,
        role: staff.role,
        staffName: staff.name,
        userId: userRow.id
      });
      await ensurePractitioner({
        staff,
        tenantId: organizationRow.id,
        userId: userRow.id
      });
      seededStaffCount += 1;
    }
  }

  const adminEmails = SEED_TENANTS.flatMap((seed) =>
    seed.staffUsers.filter((staff) => staff.role === "hospital_admin").map((staff) => staff.email)
  ).join(", ");

  process.stdout.write(
    `Seeded ${SEED_TENANTS.length} Tenants with ${seededStaffCount} staff users. ` +
      `Seed password: ${SEED_PASSWORD}. ` +
      `Hospital admin users: ${adminEmails}.\n`
  );
}

try {
  await main();
} finally {
  await closeDb();
}
