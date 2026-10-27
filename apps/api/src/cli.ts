// Operational commands:
//   cli create-admin --email ops@example.com --name "Ops Lead"   Creates an admin and prints a one-time password
//   cli seed [--force]                                           Loads demo data (refuses in production unless --force)
import { emailSchema } from "@fwp/shared";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createDatabase, type Database } from "./db/client";
import { employerProfiles, jobs, users, workerProfiles } from "./db/schema";
import { hashPassword } from "./lib/password";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

class CliError extends Error {}

async function createAdmin(db: Database) {
  const email = emailSchema.parse(values.email ?? "");
  const name = values.name?.trim();
  if (!name) throw new CliError("--name is required");

  const password = randomBytes(18).toString("base64url");
  const [created] = await db
    .insert(users)
    .values({
      email,
      fullName: name,
      role: "admin",
      phone: "+2340000000000",
      passwordHash: await hashPassword(password),
      termsAcceptedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!created) throw new CliError(`A user with email ${email} already exists`);

  console.log(`Admin created: ${email}`);
  console.log(`One-time password: ${password}`);
  console.log("Sign in and change this password immediately (Account → Change password).");
}

const DEMO_PASSWORD = "demo-password-123";

const demoEmployers = [
  {
    email: "greenfields@demo.farmworkforce.ng",
    fullName: "Tunde Bakare",
    organisationName: "GreenFields Produce",
    state: "Oyo",
    town: "Iseyin",
    verified: true,
  },
  {
    email: "harvestpoint@demo.farmworkforce.ng",
    fullName: "Ngozi Eze",
    organisationName: "HarvestPoint Farms",
    state: "Ogun",
    town: "Abeokuta",
    verified: true,
  },
  {
    email: "northstar@demo.farmworkforce.ng",
    fullName: "Musa Bello",
    organisationName: "NorthStar Livestock",
    state: "Kaduna",
    town: "Zaria",
    verified: false,
  },
] as const;

const demoJobs = [
  {
    employer: 0,
    title: "General farm workers",
    category: "general_labour",
    employmentType: "seasonal",
    state: "Oyo",
    town: "Iseyin",
    payMin: 45000,
    payMax: 60000,
    payPeriod: "month",
    positions: 12,
    accommodationProvided: true,
    mealsProvided: true,
    description:
      "Join our planting and harvest team for the rainy season. Duties include land clearing, planting maize and cassava, weeding, and harvesting. No experience needed — training provided on day one.",
  },
  {
    employer: 1,
    title: "Drip irrigation technician",
    category: "irrigation",
    employmentType: "full_time",
    state: "Ogun",
    town: "Abeokuta",
    payMin: 100000,
    payMax: 150000,
    payPeriod: "month",
    positions: 2,
    accommodationProvided: false,
    mealsProvided: false,
    description:
      "Install, inspect and repair drip irrigation lines, pumps and filters across 25 hectares of vegetables. You will also manage fertigation schedules. At least 2 years' irrigation experience required.",
  },
  {
    employer: 2,
    title: "Poultry attendant",
    category: "livestock",
    employmentType: "full_time",
    state: "Kaduna",
    town: "Zaria",
    payMin: 55000,
    payMax: 75000,
    payPeriod: "month",
    positions: 4,
    accommodationProvided: true,
    mealsProvided: false,
    description:
      "Care for a 10,000-bird layer operation: feeding, watering, egg collection, cleaning pens and keeping biosecurity records. Reliability and attention to hygiene are essential.",
  },
  {
    employer: 1,
    title: "Harvest & packing team",
    category: "post_harvest",
    employmentType: "daily",
    state: "Ogun",
    town: "Ifo",
    payMin: 3500,
    payMax: 4500,
    payPeriod: "day",
    positions: 20,
    accommodationProvided: false,
    mealsProvided: true,
    description:
      "Daily-paid work harvesting, sorting, grading and packing tomatoes and peppers for market. Work starts at 6am. Payment every Friday by bank transfer.",
  },
  {
    employer: 0,
    title: "Tractor operator",
    category: "machinery",
    employmentType: "full_time",
    state: "Oyo",
    town: "Ogbomoso",
    payMin: 90000,
    payMax: 130000,
    payPeriod: "month",
    positions: 1,
    accommodationProvided: true,
    mealsProvided: false,
    description:
      "Operate and carry out daily maintenance on a 75hp tractor and implements for ploughing, harrowing and ridging. Valid driving licence and 3 years' experience required.",
  },
  {
    employer: 0,
    title: "Assistant farm supervisor",
    category: "supervision",
    employmentType: "full_time",
    state: "Oyo",
    town: "Iseyin",
    payMin: 120000,
    payMax: 180000,
    payPeriod: "month",
    positions: 1,
    accommodationProvided: true,
    mealsProvided: true,
    description:
      "Support the farm manager in planning daily tasks, supervising teams of up to 20 workers, keeping attendance and input records, and reporting on crop progress.",
  },
] as const;

async function seed(db: Database) {
  if (process.env.NODE_ENV === "production" && !values.force) {
    throw new CliError("Refusing to seed demo data in production. Pass --force if you really mean it.");
  }
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, demoEmployers[0].email));
  if (existing) {
    console.log("Demo data already present — nothing to do.");
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const employerIds: string[] = [];

  for (const e of demoEmployers) {
    const [user] = await db
      .insert(users)
      .values({
        email: e.email,
        fullName: e.fullName,
        role: "employer",
        phone: "+2348030000000",
        passwordHash,
        termsAcceptedAt: new Date(),
      })
      .returning({ id: users.id });
    await db.insert(employerProfiles).values({
      userId: user!.id,
      organisationName: e.organisationName,
      state: e.state,
      town: e.town,
      description: `${e.organisationName} is a demo employer for testing the platform.`,
      verifiedAt: e.verified ? new Date() : null,
    });
    employerIds.push(user!.id);
  }

  for (const { employer, ...job } of demoJobs) {
    await db
      .insert(jobs)
      .values({ ...job, employerId: employerIds[employer]!, status: "open", publishedAt: new Date() });
  }

  const [worker] = await db
    .insert(users)
    .values({
      email: "worker@demo.farmworkforce.ng",
      fullName: "Ade Okafor",
      role: "worker",
      phone: "+2348031234567",
      passwordHash,
      termsAcceptedAt: new Date(),
    })
    .returning({ id: users.id });
  await db.insert(workerProfiles).values({
    userId: worker!.id,
    state: "Oyo",
    town: "Ibadan",
    primaryCategory: "irrigation",
    skills: ["drip irrigation", "pump repair", "fertigation"],
    yearsExperience: 4,
    bio: "Irrigation technician with four years' experience on vegetable farms.",
  });

  console.log("Demo data loaded. Sign in with any of these (password: %s):", DEMO_PASSWORD);
  console.log(
    ["worker@demo.farmworkforce.ng", ...demoEmployers.map((e) => e.email)].map((e) => `  ${e}`).join("\n"),
  );
}

// Run last, so every declaration above is initialised first.
const { db, sql } = createDatabase(databaseUrl, { max: 2 });
const command = positionals[0];

try {
  if (command === "create-admin") await createAdmin(db);
  else if (command === "seed") await seed(db);
  else {
    console.error("Usage: cli <create-admin --email <email> --name <name> | seed [--force]>");
    process.exitCode = 1;
  }
} catch (error) {
  // Expected problems get a one-line message; anything else gets the full stack trace.
  console.error(error instanceof CliError ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
