import type { JobSummary } from "@fwp/shared";
import { employerProfiles, jobs } from "../db/schema";

/** Columns needed to render a job card; pair with an inner join on employer_profiles. */
export const jobSummaryColumns = {
  id: jobs.id,
  title: jobs.title,
  category: jobs.category,
  employmentType: jobs.employmentType,
  state: jobs.state,
  town: jobs.town,
  payMin: jobs.payMin,
  payMax: jobs.payMax,
  payPeriod: jobs.payPeriod,
  positions: jobs.positions,
  accommodationProvided: jobs.accommodationProvided,
  mealsProvided: jobs.mealsProvided,
  status: jobs.status,
  createdAt: jobs.createdAt,
  organisationName: employerProfiles.organisationName,
  verifiedAt: employerProfiles.verifiedAt,
};

type JobSummaryRow = Omit<JobSummary, "createdAt" | "employer"> & {
  createdAt: Date;
  organisationName: string;
  verifiedAt: Date | null;
};

export function toJobSummary(row: JobSummaryRow): JobSummary {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    employmentType: row.employmentType,
    state: row.state,
    town: row.town,
    payMin: row.payMin,
    payMax: row.payMax,
    payPeriod: row.payPeriod,
    positions: row.positions,
    accommodationProvided: row.accommodationProvided,
    mealsProvided: row.mealsProvided,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    employer: { organisationName: row.organisationName, verified: row.verifiedAt !== null },
  };
}

/** Escapes LIKE wildcards so user search text is matched literally. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}
