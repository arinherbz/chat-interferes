import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0");
const profilesSampleRate = Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0");
const enabled = Boolean(dsn);

if (enabled && !Sentry.isInitialized()) {
  Sentry.init({
    dsn,
    enabled,
    environment,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    profilesSampleRate: Number.isFinite(profilesSampleRate) ? profilesSampleRate : 0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],
  });
}

export { Sentry };
