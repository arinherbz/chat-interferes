import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0");
const enabled = Boolean(dsn);

export function initializeSentry() {
  if (!enabled || Sentry.isInitialized()) {
    return;
  }

  Sentry.init({
    dsn,
    environment,
    enabled,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.httpClientIntegration(),
    ],
  });
}

export { Sentry };
