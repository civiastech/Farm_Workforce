import { api } from "./api";
import type * as SentryClient from "./sentry-client";

/**
 * Browser error tracking with Sentry, switched on by the API's SENTRY_DSN setting.
 * The SDK is downloaded only when it's enabled, and reports go through /api/monitoring
 * so the Content-Security-Policy stays 'self'-only. No personal data is collected.
 */
let sentry: typeof SentryClient | null = null;

interface ClientConfig {
  sentryDsn: string | null;
  environment: string;
  release: string | null;
}

export async function startMonitoring(): Promise<void> {
  try {
    const config = await api.get<ClientConfig>("/client-config");
    if (!config.sentryDsn) return;
    const client = await import("./sentry-client");
    client.init({
      dsn: config.sentryDsn,
      tunnel: "/api/monitoring",
      environment: config.environment,
      release: config.release ?? undefined,
      tracesSampleRate: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      // Noise from browser extensions and flaky mobile networks, not bugs in the app.
      ignoreErrors: ["ResizeObserver loop", "Failed to fetch", "NetworkError", "Load failed"],
    });
    sentry = client;
  } catch {
    // Monitoring must never break the app.
  }
}

export function reportError(error: unknown): void {
  sentry?.captureException(error);
}
