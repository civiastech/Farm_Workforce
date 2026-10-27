import type {
  ApplicationStatus,
  EmploymentType,
  JobCategory,
  JobStatus,
  Language,
  PayPeriod,
  ReportReason,
  ReportStatus,
  Role,
} from "./constants";

/** API response shapes. Dates are ISO-8601 strings on the wire. */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  phone: string;
  preferredLanguage: Language;
  hasProfile: boolean;
  createdAt: string;
}

export interface WorkerProfile {
  state: string;
  town: string | null;
  primaryCategory: JobCategory;
  skills: string[];
  yearsExperience: number;
  bio: string | null;
  available: boolean;
  updatedAt: string;
}

export interface EmployerProfile {
  organisationName: string;
  state: string;
  town: string | null;
  description: string | null;
  verified: boolean;
  updatedAt: string;
}

export interface ProfileResponse {
  user: CurrentUser;
  worker: WorkerProfile | null;
  employer: EmployerProfile | null;
}

export interface JobSummary {
  id: string;
  title: string;
  category: JobCategory;
  employmentType: EmploymentType;
  state: string;
  town: string;
  payMin: number;
  payMax: number;
  payPeriod: PayPeriod;
  positions: number;
  accommodationProvided: boolean;
  mealsProvided: boolean;
  status: JobStatus;
  createdAt: string;
  employer: {
    organisationName: string;
    verified: boolean;
  };
}

export interface JobDetail extends JobSummary {
  description: string;
  startDate: string | null;
  updatedAt: string;
  isOwner: boolean;
  /** Present when the viewer is a worker who has already applied. */
  myApplication: { id: string; status: ApplicationStatus; createdAt: string } | null;
}

export interface EmployerJob extends JobSummary {
  applicationCounts: Partial<Record<ApplicationStatus, number>>;
}

export interface WorkerApplication {
  id: string;
  status: ApplicationStatus;
  coverNote: string | null;
  createdAt: string;
  updatedAt: string;
  job: Pick<JobSummary, "id" | "title" | "state" | "town" | "status" | "payMin" | "payMax" | "payPeriod"> & {
    organisationName: string;
  };
}

export interface Applicant {
  id: string;
  status: ApplicationStatus;
  coverNote: string | null;
  createdAt: string;
  worker: {
    fullName: string;
    state: string | null;
    town: string | null;
    primaryCategory: JobCategory | null;
    skills: string[];
    yearsExperience: number | null;
    bio: string | null;
    /** Contact details are only revealed once the applicant is shortlisted or hired. */
    phone: string | null;
    email: string | null;
  };
}

export interface PlatformStats {
  openJobs: number;
  employers: number;
  workers: number;
}

export interface AdminReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; fullName: string } | null;
  job: { id: string; title: string; status: JobStatus; employerId: string; organisationName: string } | null;
}

export interface AdminEmployer {
  userId: string;
  fullName: string;
  email: string;
  organisationName: string;
  state: string;
  verified: boolean;
  openJobs: number;
  createdAt: string;
}
