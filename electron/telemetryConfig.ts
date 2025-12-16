import { readFileSync } from "node:fs";
import * as path from "node:path";

type PackagedTelemetryConfig = {
  aptabaseAppKey?: string;
  sentryDsn?: string;
};

let cachedPackagedConfig: PackagedTelemetryConfig | null = null;

const normalizeConfigValue = (value: unknown): string => {
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return "";
  if (str.startsWith("__") && str.endsWith("__")) return "";
  return str;
};

const readPackagedTelemetryConfig = (): PackagedTelemetryConfig => {
  if (cachedPackagedConfig) return cachedPackagedConfig;

  try {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const raw = readFileSync(packageJsonPath, "utf8");
    const pkg = JSON.parse(raw) as { tlclTelemetry?: PackagedTelemetryConfig };
    cachedPackagedConfig = pkg.tlclTelemetry ?? {};
  } catch {
    cachedPackagedConfig = {};
  }

  return cachedPackagedConfig;
};

export const getAptabaseAppKey = (): string => {
  const packaged = readPackagedTelemetryConfig();
  return normalizeConfigValue(
    process.env.TLCL_APTABASE_APP_KEY ??
      process.env.APTABASE_APP_KEY ??
      packaged.aptabaseAppKey
  );
};

export const getSentryDsn = (): string => {
  const packaged = readPackagedTelemetryConfig();
  return normalizeConfigValue(
    process.env.TLCL_SENTRY_DSN ?? process.env.SENTRY_DSN ?? packaged.sentryDsn
  );
};

