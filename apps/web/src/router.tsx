import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { HomePage } from "./pages/home";
import { JobDetailPage, JobsPage } from "./pages/jobs";

/**
 * Public browsing pages ship in the main bundle; everything else is code-split
 * so first load stays small on slow mobile connections.
 */
function lazyPage<M>(load: () => Promise<M>, pick: (module: M) => ComponentType): Pick<RouteObject, "lazy"> {
  return { lazy: async () => ({ Component: pick(await load()) }) };
}

const auth = () => import("./pages/auth");
const info = () => import("./pages/info");
const dashboard = () => import("./pages/dashboard");
const employer = () => import("./pages/employer");
const admin = () => import("./pages/admin");

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "jobs/:id", element: <JobDetailPage /> },
      { path: "login", ...lazyPage(auth, (m) => m.LoginPage) },
      { path: "register", ...lazyPage(auth, (m) => m.RegisterPage) },
      { path: "forgot-password", ...lazyPage(auth, (m) => m.ForgotPasswordPage) },
      { path: "reset-password", ...lazyPage(auth, (m) => m.ResetPasswordPage) },
      { path: "how-it-works", ...lazyPage(info, (m) => m.HowItWorksPage) },
      { path: "trust", ...lazyPage(info, (m) => m.TrustPage) },
      { path: "privacy", ...lazyPage(info, (m) => m.PrivacyPage) },
      { path: "terms", ...lazyPage(info, (m) => m.TermsPage) },
      {
        path: "dashboard",
        lazy: async () => {
          const { DashboardLayout } = await dashboard();
          return {
            Component: () => (
              <RequireAuth roles={["worker", "employer"]}>
                <DashboardLayout />
              </RequireAuth>
            ),
          };
        },
        children: [
          { index: true, ...lazyPage(dashboard, (m) => m.DashboardHome) },
          {
            path: "profile",
            ...lazyPage(
              () => import("./pages/profile"),
              (m) => m.ProfilePage,
            ),
          },
          {
            path: "applications",
            ...lazyPage(
              () => import("./pages/worker"),
              (m) => m.MyApplicationsPage,
            ),
          },
          { path: "jobs", ...lazyPage(employer, (m) => m.EmployerJobsPage) },
          { path: "jobs/new", ...lazyPage(employer, (m) => m.JobEditorPage) },
          { path: "jobs/:id/edit", ...lazyPage(employer, (m) => m.JobEditorPage) },
          { path: "jobs/:id/applicants", ...lazyPage(employer, (m) => m.JobApplicantsPage) },
          {
            path: "account",
            ...lazyPage(
              () => import("./pages/account"),
              (m) => m.AccountPage,
            ),
          },
        ],
      },
      {
        path: "admin",
        lazy: async () => {
          const { AdminLayout } = await admin();
          return {
            Component: () => (
              <RequireAuth roles={["admin"]}>
                <AdminLayout />
              </RequireAuth>
            ),
          };
        },
        children: [
          { index: true, element: <Navigate to="reports" replace /> },
          { path: "reports", ...lazyPage(admin, (m) => m.AdminReportsPage) },
          { path: "employers", ...lazyPage(admin, (m) => m.AdminEmployersPage) },
          {
            path: "account",
            ...lazyPage(
              () => import("./pages/account"),
              (m) => m.AccountPage,
            ),
          },
        ],
      },
      { path: "*", ...lazyPage(info, (m) => m.NotFoundPage) },
    ],
  },
]);
