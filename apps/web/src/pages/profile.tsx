import {
  JOB_CATEGORY_KEYS,
  NIGERIAN_STATES,
  employerProfileSchema,
  workerProfileSchema,
  type ProfileResponse,
} from "@fwp/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, MapPin, Sparkles, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Alert, Avatar, Field, Options, QueryError, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { meQueryKey } from "../lib/auth";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function ProfilePage() {
  const { t } = useI18n();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<ProfileResponse>("/me/profile") });
  const [params] = useSearchParams();
  const isWelcome = params.get("welcome") === "1";
  const isEmployer = profile.data?.user.role === "employer";
  usePageTitle(isEmployer ? t("profile.employerTitle") : t("nav.myProfile"));

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
              {isEmployer ? t("profile.employerTitle") : t("profile.workerTitle")}
            </h1>
            <p className="muted">{isEmployer ? t("profile.employerLead") : t("profile.workerLead")}</p>
          </div>
        </div>
      </div>
      {isWelcome && (
        <Alert tone="success" title={t("profile.welcomeTitle")}>
          {t("profile.welcomeBody")}
        </Alert>
      )}
      {isEmployer ? <EmployerProfileForm data={data} /> : <WorkerProfileForm data={data} />}
    </div>
  );
}

function useProfileSaved() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  return (data: ProfileResponse) => {
    queryClient.setQueryData(["profile"], data);
    queryClient.setQueryData(meQueryKey, { user: data.user });
    toast(t("profile.saved"));
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    if (safeNext) navigate(safeNext, { replace: true });
    else if (params.get("welcome") === "1") navigate("/dashboard", { replace: true });
  };
}

function WorkerProfileForm({ data }: { data: ProfileResponse }) {
  const { t } = useI18n();
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
          <MapPin size={18} /> {t("profile.whereWork")}
        </h2>
        <div className="form-grid">
          <Field label={t("profile.stateLive")} name="state" error={fieldErrors.state}>
            {(props) => (
              <select className="select" defaultValue={worker?.state ?? ""} {...props}>
                <Options items={NIGERIAN_STATES} placeholder={t("common.chooseState")} />
              </select>
            )}
          </Field>
          <Field label={t("common.townLga")} optional name="town" error={fieldErrors.town}>
            {(props) => (
              <input
                className="input"
                defaultValue={worker?.town ?? ""}
                placeholder={t("profile.townPlaceholder")}
                {...props}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2>
          <Sparkles size={18} /> {t("profile.skillsSection")}
        </h2>
        <div className="form-grid">
          <Field label={t("profile.mainWork")} name="primaryCategory" error={fieldErrors.primaryCategory}>
            {(props) => (
              <select className="select" defaultValue={worker?.primaryCategory ?? ""} {...props}>
                <option value="">{t("common.chooseOne")}</option>
                {JOB_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`category.${key}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("profile.years")} name="yearsExperience" error={fieldErrors.yearsExperience}>
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
            label={t("profile.skills")}
            name="skills"
            error={fieldErrors.skills ?? fieldErrors["skills.0"]}
            hint={t("profile.skillsHint")}
          >
            {(props) => (
              <input
                className="input"
                defaultValue={worker?.skills.join(", ") ?? ""}
                placeholder={t("profile.skillsPlaceholder")}
                {...props}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h2>
          <UserRound size={18} /> {t("profile.aboutYou")}
        </h2>
        <Field
          label={t("profile.bio")}
          optional
          name="bio"
          error={fieldErrors.bio}
          hint={t("profile.bioHint")}
          counter={{ max: 1000, initial: worker?.bio?.length ?? 0 }}
        >
          {(props) => (
            <textarea className="textarea" maxLength={1000} defaultValue={worker?.bio ?? ""} {...props} />
          )}
        </Field>
        <label className="switch-row">
          <div>
            <strong>{t("profile.available")}</strong>
            <span>{t("profile.availableHint")}</span>
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
          {isPending ? t("common.saving") : t("profile.save")}
        </button>
      </div>
    </form>
  );
}

function EmployerProfileForm({ data }: { data: ProfileResponse }) {
  const { t } = useI18n();
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
          <Alert tone="success" title={t("common.verifiedEmployer")}>
            <span className="icon-inline">
              <BadgeCheck size={16} /> {t("dash.verifiedBody")}
            </span>
          </Alert>
        ) : (
          <Alert title={t("profile.pendingTitle")}>{t("profile.pendingBody")}</Alert>
        ))}

      <section className="form-section">
        <h2>
          <Building2 size={18} /> {t("profile.yourOrg")}
        </h2>
        <div className="form-grid">
          <Field
            className="full"
            label={t("profile.orgName")}
            name="organisationName"
            error={fieldErrors.organisationName}
          >
            {(props) => (
              <input
                className="input"
                autoComplete="organization"
                defaultValue={employer?.organisationName ?? ""}
                placeholder={t("profile.orgPlaceholder")}
                {...props}
              />
            )}
          </Field>
          <Field label={t("common.state")} name="state" error={fieldErrors.state}>
            {(props) => (
              <select className="select" defaultValue={employer?.state ?? ""} {...props}>
                <Options items={NIGERIAN_STATES} placeholder={t("common.chooseState")} />
              </select>
            )}
          </Field>
          <Field label={t("common.townLga")} optional name="town" error={fieldErrors.town}>
            {(props) => <input className="input" defaultValue={employer?.town ?? ""} {...props} />}
          </Field>
          <Field
            className="full"
            label={t("profile.aboutFarm")}
            optional
            name="description"
            error={fieldErrors.description}
            hint={t("profile.aboutFarmHint")}
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
          {isPending ? t("common.saving") : t("profile.saveOrg")}
        </button>
      </div>
    </form>
  );
}
