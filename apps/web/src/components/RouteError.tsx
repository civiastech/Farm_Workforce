import { useEffect } from "react";
import { useRouteError } from "react-router";
import { useI18n } from "../i18n";
import { reportError } from "../lib/monitoring";

/** Shown when a page crashes while rendering or loading. Reports the error, then offers a reload. */
export function RouteError() {
  const error = useRouteError();
  const { t } = useI18n();

  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <div className="wrap not-found" role="alert">
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>
        {t("common.somethingWrong")}
      </h1>
      <p className="muted">{t("crash.body")}</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t("crash.reload")}
        </button>
        <a className="btn btn-outline" href="/">
          {t("common.goHome")}
        </a>
      </div>
    </div>
  );
}
