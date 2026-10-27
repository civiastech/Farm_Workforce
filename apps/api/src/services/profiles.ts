import type { EmployerProfile, WorkerProfile } from "@fwp/shared";
import type { employerProfiles, workerProfiles } from "../db/schema";

export function toWorkerProfile(row: typeof workerProfiles.$inferSelect): WorkerProfile {
  return {
    state: row.state,
    town: row.town,
    primaryCategory: row.primaryCategory,
    skills: row.skills,
    yearsExperience: row.yearsExperience,
    bio: row.bio,
    available: row.available,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEmployerProfile(row: typeof employerProfiles.$inferSelect): EmployerProfile {
  return {
    organisationName: row.organisationName,
    state: row.state,
    town: row.town,
    description: row.description,
    verified: row.verifiedAt !== null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
