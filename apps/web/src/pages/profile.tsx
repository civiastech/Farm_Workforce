import {
  JOB_CATEGORIES,
  NIGERIAN_STATES,
  employerProfileSchema,
  workerProfileSchema,
  type ProfileResponse,
} from "@fwp/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, MapPin, Sparkles, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Alert, Avatar, Field, Options, QueryError, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { meQueryKey } from "../lib/auth";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function ProfilePage() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<ProfileResponse>("/me/profile") });
  const [params] = useSearchParams();
  const isWelcome = params.get("welcome") === "1";
  const isEmployer = profile.data?.user.role === "employer";
  usePageTitle(isEmployer ? "Organisation profile" : "My profile");

  if (profile.isLoading) return <Spinner />;
  if (profile.error) return <QueryError error={profile.error} retry={() => profile.refetch()} />;
  const data = profile.data!;

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={data.user.fullName} size={56} />
          <div>
            <h1 className="display" style={{ margin: 0 }}>
              {isEmployer ? "Organisation profile" : "Your worker profile"}
            </h1>
            <p className="muted">
              {isEmployer
                ? "Workers see this on every job you post."
                : "Employers see this when you apply. Your phone and email stay private until they shortlist you."}
            </p>
          </div>
        </div>
      </div>
      {isWelcome && (
        <Alert tone="success" title="Welcome to Farm Workforce!">
          Add a few details below — it takes about a minute and you only do it once.
        </Alert>
      )}
      {isEmployer ? <EmployerProfileForm data={data} /> : <WorkerProfileForm data={data} />}
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
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    if (safeNext) navigate(safeNext, { replace: true });
    else if (params.get("welcome") === "1") navigate("/dashboard", { replace: true });
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
    <form className="panel form" onSubmit={onSubmit} noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}

      <section className="form-section">
        <h2>
          <MapPin size={18} /> Where you can work
        </h2>
        <div className="form-grid">
          <Field label="State you live in" name="state" error={fieldErrors.state}>
            {(props) => (
              <select className="select" defaultValue={worker?.state ?? ""} {...props}>
                <Options items={NIGERIAN_STATES} placeholder="Choose a state" />
              </select>
            )}
          </Field>
          <Field label="Town or LGA" optional name="town" error={fieldErrors.town}>
            {(props) => (
              <input
                className="input"
                defaultValue={worker?.town ?? ""}
                placeholder="e.g. Ogbomoso"
                {...props}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2>
          <Sparkles size={18} /> Skills &amp; experience
        </h2>
        <div className="form-grid">
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
            {(props) => (
              <input
                className="input"
                defaultValue={worker?.skills.join(", ") ?? ""}
                placeholder="planting, weeding, harvesting"
                {...props}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2>
          <UserRound size={18} /> About you
        </h2>
        <Field
          label="Short bio"
          optional
          name="bio"
          error={fieldErrors.bio}
          hint="A few sentences about your experience and what work you're looking for."
          counter={{ max: 1000, initial: worker?.bio?.length ?? 0 }}
        >
          {(props) => (
            <textarea className="textarea" maxLength={1000} defaultValue={worker?.bio ?? ""} {...props} />
          )}
        </Field>
        <label className="switch-row">
          <div>
            <strong>Available for work now</strong>
            <span>Employers can see that you're ready to start.</span>
          </div>
          <input
            type="checkbox"
            className="switch"
            name="available"
            defaultChecked={worker?.available ?? true}
          />
        </label>
      </section>

      <div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={isPending}>
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
    <form className="panel form" onSubmit={onSubmit} noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}
      {employer &&
        (employer.verified ? (
          <Alert tone="success" title="Verified employer">
            <span className="icon-inline">
              <BadgeCheck size={16} /> Your jobs show a verified badge.
            </span>
          </Alert>
        ) : (
          <Alert title="Verification pending">
            Our team reviews new employers. Verified employers get a badge on every job and more applicants.
          </Alert>
        ))}

      <section className="form-section">
        <h2>
          <Building2 size={18} /> Your organisation
        </h2>
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
                placeholder="e.g. GreenFields Produce"
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
          <Field label="Town or LGA" optional name="town" error={fieldErrors.town}>
            {(props) => <input className="input" defaultValue={employer?.town ?? ""} {...props} />}
          </Field>
          <Field
            className="full"
            label="About your farm"
            optional
            name="description"
            error={fieldErrors.description}
            hint="What you grow or raise, farm size, and what it's like to work with you."
            counter={{ max: 1500, initial: employer?.description?.length ?? 0 }}
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
      </section>
      <div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save organisation"}
        </button>
      </div>
    </form>
  );
}
