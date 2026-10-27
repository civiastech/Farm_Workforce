import {
  JOB_CATEGORIES,
  NIGERIAN_STATES,
  employerProfileSchema,
  workerProfileSchema,
  type ProfileResponse,
} from "@fwp/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { Alert, Field, Options, QueryError, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { meQueryKey } from "../lib/auth";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function ProfilePage() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<ProfileResponse>("/me/profile") });
  const [params] = useSearchParams();
  const isWelcome = params.get("welcome") === "1";
  usePageTitle(profile.data?.user.role === "employer" ? "Organisation profile" : "My profile");

  if (profile.isLoading) return <Spinner />;
  if (profile.error) return <QueryError error={profile.error} retry={() => profile.refetch()} />;
  const data = profile.data!;

  return (
    <div>
      <div className="page-head">
        <h1>{data.user.role === "employer" ? "Organisation profile" : "Your worker profile"}</h1>
        {isWelcome ? (
          <Alert tone="success">
            Your account is ready. Add a few details below — it takes about a minute and you only do it once.
          </Alert>
        ) : (
          <p className="muted">
            {data.user.role === "employer"
              ? "Workers see this on every job you post."
              : "Employers see this when you apply. Your phone and email stay private until they shortlist you."}
          </p>
        )}
      </div>
      {data.user.role === "employer" ? (
        <EmployerProfileForm data={data} />
      ) : (
        <WorkerProfileForm data={data} />
      )}
    </div>
  );
}

function useProfileSaved() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  return (data: ProfileResponse) => {
    queryClient.setQueryData(["profile"], data);
    queryClient.setQueryData(meQueryKey, { user: data.user });
    toast("Profile saved.");
    const next = params.get("next");
    if (params.get("welcome") === "1") {
      navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard", {
        replace: true,
      });
    }
  };
}

function WorkerProfileForm({ data }: { data: ProfileResponse }) {
  const worker = data.worker;
  const onSaved = useProfileSaved();
  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    workerProfileSchema,
    (values) => api.put<ProfileResponse>("/me/profile", values),
    {
      // Skills are typed as a comma-separated list.
      transform: (raw) => ({
        ...raw,
        skills: String(raw.skills ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
      onSuccess: onSaved,
    },
  );

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="form-grid">
        <Field label="State you live in" name="state" error={fieldErrors.state}>
          {(props) => (
            <select className="select" defaultValue={worker?.state ?? ""} {...props}>
              <Options items={NIGERIAN_STATES} placeholder="Choose a state" />
            </select>
          )}
        </Field>
        <Field label="Town or LGA (optional)" name="town" error={fieldErrors.town}>
          {(props) => <input className="input" defaultValue={worker?.town ?? ""} {...props} />}
        </Field>
        <Field label="Main type of work" name="primaryCategory" error={fieldErrors.primaryCategory}>
          {(props) => (
            <select className="select" defaultValue={worker?.primaryCategory ?? ""} {...props}>
              <Options items={JOB_CATEGORIES} placeholder="Choose one" />
            </select>
          )}
        </Field>
        <Field label="Years of farm experience" name="yearsExperience" error={fieldErrors.yearsExperience}>
          {(props) => (
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              defaultValue={worker?.yearsExperience ?? 0}
              {...props}
            />
          )}
        </Field>
        <Field
          className="full"
          label="Skills"
          name="skills"
          error={fieldErrors.skills ?? fieldErrors["skills.0"]}
          hint="Separate with commas, e.g. planting, tractor driving, poultry feeding"
        >
          {(props) => <input className="input" defaultValue={worker?.skills.join(", ") ?? ""} {...props} />}
        </Field>
        <Field className="full" label="About you (optional)" name="bio" error={fieldErrors.bio}>
          {(props) => (
            <textarea className="textarea" maxLength={1000} defaultValue={worker?.bio ?? ""} {...props} />
          )}
        </Field>
        <label className="checkbox full">
          <input type="checkbox" name="available" defaultChecked={worker?.available ?? true} />
          <span>I'm available for work now</span>
        </label>
      </div>
      <div>
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function EmployerProfileForm({ data }: { data: ProfileResponse }) {
  const employer = data.employer;
  const onSaved = useProfileSaved();
  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    employerProfileSchema,
    (values) => api.put<ProfileResponse>("/me/profile", values),
    { onSuccess: onSaved },
  );

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}
      {employer && !employer.verified && (
        <Alert>
          Your organisation is not verified yet. Our team reviews new employers; verified employers get a
          badge on every job.
        </Alert>
      )}
      <div className="form-grid">
        <Field
          className="full"
          label="Farm or organisation name"
          name="organisationName"
          error={fieldErrors.organisationName}
        >
          {(props) => (
            <input
              className="input"
              autoComplete="organization"
              defaultValue={employer?.organisationName ?? ""}
              {...props}
            />
          )}
        </Field>
        <Field label="State" name="state" error={fieldErrors.state}>
          {(props) => (
            <select className="select" defaultValue={employer?.state ?? ""} {...props}>
              <Options items={NIGERIAN_STATES} placeholder="Choose a state" />
            </select>
          )}
        </Field>
        <Field label="Town or LGA (optional)" name="town" error={fieldErrors.town}>
          {(props) => <input className="input" defaultValue={employer?.town ?? ""} {...props} />}
        </Field>
        <Field
          className="full"
          label="About your farm (optional)"
          name="description"
          error={fieldErrors.description}
          hint="What you grow or raise, farm size, and what it's like to work with you."
        >
          {(props) => (
            <textarea
              className="textarea"
              maxLength={1500}
              defaultValue={employer?.description ?? ""}
              {...props}
            />
          )}
        </Field>
      </div>
      <div>
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save organisation"}
        </button>
      </div>
    </form>
  );
}
