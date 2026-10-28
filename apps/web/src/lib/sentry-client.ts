// Loaded on demand by monitoring.ts. Importing only what we use lets the bundler drop the rest
// of the SDK (tracing, replay, feedback), which matters on slow mobile connections.
export { captureException, init } from "@sentry/react";
