import type { Config } from "../config";
import type * as SentryNode from "@sentry/node";

/**
 * Error tracking with Sentry, off unless SENTRY_DSN is set. The SDK is loaded only when enabled,
 * so it costs nothing otherwise. No personal data is sent: no cookies, IPs or request bodies.
 */
let sentry: typeof SentryNode | null = null;

export async function initMonitoring(config: Config): Promise<void> {
  if (!config.SENTRY_DSN) return;
  sentry = await import("@sentry/node");
  sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT,
    release: config.SENTRY_RELEASE,
    tracesSampleRate: 0,
    // Errors only: no personal data. The SDK's defaults would collect all of these.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
  });
}

export function captureError(
  error: unknown,
  context: { requestId?: string; method?: string; route?: string; userId?: string } = {},
): void {
  if (!sentry) return;
  const client = sentry;
  client.withScope((scope) => {
    if (context.requestId) scope.setTag("request_id", context.requestId);
    if (context.method) scope.setTag("method", context.method);
    if (context.route) scope.setTag("route", context.route);
    if (context.userId) scope.setUser({ id: context.userId });
    client.captureException(error);
  });
}

/** Sends any queued events before the process exits. */
export async function flushMonitoring(): Promise<void> {
  await sentry?.close(2000);
}
