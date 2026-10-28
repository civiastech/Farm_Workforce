import { EMPLOYMENT_TYPES, formatPay, uuidSchema } from "@fwp/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { employerProfiles, jobs } from "../db/schema";

/**
 * Pages for machines rather than people. nginx sends link-preview bots (WhatsApp, Facebook,
 * Telegram, X…) here for /jobs/:id, because they don't run JavaScript and would otherwise see a
 * generic title. Also serves robots.txt and the sitemap, which need the site's absolute URL.
 */

const SITE_NAME = "Farm Workforce";
const DEFAULT_DESCRIPTION = "Real farm jobs with clear pay. Trusted workers. Free for workers, always.";
const PUBLIC_PAGES = ["/", "/jobs", "/how-it-works", "/trust", "/privacy", "/terms"];
const SITEMAP_LIMIT = 5000;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

function previewPage({
  title,
  description,
  url,
  image,
}: Record<"title" | "description" | "url" | "image", string>) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="en_NG">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${SITE_NAME}: farm jobs across Nigeria">
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${escapeHtml(url)}">Open on ${SITE_NAME}</a></p>
</body>
</html>`;
}

export const shareRoutes: FastifyPluginAsync = async (app) => {
  const origin = app.config.APP_ORIGIN;
  const image = `${origin}/og-image.png`;

  app.get("/share/jobs/:id", async (request, reply) => {
    const parsed = uuidSchema.safeParse((request.params as { id?: string }).id);
    const [row] = parsed.success
      ? await app.db
          .select({
            job: jobs,
            organisationName: employerProfiles.organisationName,
            verifiedAt: employerProfiles.verifiedAt,
          })
          .from(jobs)
          .innerJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
          .where(and(eq(jobs.id, parsed.data), inArray(jobs.status, ["open", "closed"])))
      : [];

    reply.type("text/html; charset=utf-8").header("Cache-Control", "public, max-age=300");
    if (!row) {
      return previewPage({
        title: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        url: `${origin}/jobs`,
        image,
      });
    }

    const { job } = row;
    const perks = [
      EMPLOYMENT_TYPES[job.employmentType],
      job.accommodationProvided && "Accommodation provided",
      job.mealsProvided && "Meals provided",
      job.positions > 1 && `${job.positions} positions`,
    ].filter(Boolean);
    const employer = `${row.organisationName}${row.verifiedAt ? " (verified employer)" : ""}`;
    const status = job.status === "closed" ? "This job has closed. " : "";
    return previewPage({
      title: `${job.title} · ${formatPay(job.payMin, job.payMax, job.payPeriod)}`,
      description: truncate(
        `${status}${employer} is hiring in ${job.town}, ${job.state}. ${perks.join(" · ")}. Apply free on ${SITE_NAME}.`,
        200,
      ),
      url: `${origin}/jobs/${job.id}`,
      image,
    });
  });

  /** Preview for the home page and other public pages. */
  app.get("/share/site", async (_request, reply) => {
    reply.type("text/html; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return previewPage({
      title: `${SITE_NAME}: farm jobs and workers across Nigeria`,
      description: DEFAULT_DESCRIPTION,
      url: origin,
      image,
    });
  });

  app.get("/robots.txt", async (_request, reply) => {
    reply.type("text/plain; charset=utf-8").header("Cache-Control", "public, max-age=3600");
    return [
      "User-agent: *",
      "Allow: /",
      "Disallow: /dashboard",
      "Disallow: /admin",
      "Disallow: /api/",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n");
  });

  app.get("/sitemap.xml", async (_request, reply) => {
    const openJobs = await app.db
      .select({ id: jobs.id, updatedAt: jobs.updatedAt })
      .from(jobs)
      .where(eq(jobs.status, "open"))
      .orderBy(desc(jobs.publishedAt))
      .limit(SITEMAP_LIMIT);

    const urls = [
      ...PUBLIC_PAGES.map((path) => `<url><loc>${origin}${path === "/" ? "" : path}</loc></url>`),
      ...openJobs.map(
        (job) =>
          `<url><loc>${origin}/jobs/${job.id}</loc><lastmod>${job.updatedAt.toISOString()}</lastmod></url>`,
      ),
    ];
    reply.type("application/xml; charset=utf-8").header("Cache-Control", "public, max-age=900");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  });
};
