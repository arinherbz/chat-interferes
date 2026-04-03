import { Frequency, RetryStrategyBuilder } from "checkly/constructs";
import type { ChecklyConfig } from "checkly";

const config: ChecklyConfig = {
  projectName: "Ariostore Public Monitoring",
  logicalId: "ariostore-public-monitoring",
  checks: {
    locations: ["us-east-1", "eu-west-1"],
    frequency: Frequency.EVERY_10M,
    retryStrategy: RetryStrategyBuilder.fixedStrategy({
      maxRetries: 1,
      baseBackoffSeconds: 30,
      sameRegion: false,
    }),
    tags: ["ariostore", "production"],
    checkMatch: "checkly/**/*.check.ts",
    browserChecks: {
      testMatch: "checkly/**/*.spec.ts",
    },
  },
  cli: {
    runLocation: "us-east-1",
  },
};

export default config;
