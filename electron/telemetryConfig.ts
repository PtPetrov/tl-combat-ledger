import { app } from "electron";
import { existsSync, readFileSync } from "node:fs";
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

const resolvePackageJsonPath = (): string => {
  const candidates = new Set<string>();
  const appPath = (() => {
    try {
      return app?.getAppPath?.() ?? "";
    } catch {
      return "";
    }
  })();

  if (appPath) candidates.add(path.join(appPath, "package.json"));
  candidates.add(path.join(__dirname, "..", "package.json"));
  candidates.add(path.join(__dirname, "..", "..", "package.json"));

  if (process.resourcesPath) {
    candidates.add(path.join(process.resourcesPath, "app.asar", "package.json"));
    candidates.add(path.join(process.resourcesPath, "app", "package.json"));
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  return "";
};

const readPackagedTelemetryConfig = (): PackagedTelemetryConfig => {
  if (cachedPackagedConfig) return cachedPackagedConfig;

  try {
    const packageJsonPath = resolvePackageJsonPath();
    if (!packageJsonPath) {
      cachedPackagedConfig = {};
      return cachedPackagedConfig;
    }
    const raw = readFileSync(packageJsonPath, "utf8");
    const pkg = JSON.parse(raw) as {
      tlclTelemetry?: PackagedTelemetryConfig;
      build?: { extraMetadata?: { tlclTelemetry?: PackagedTelemetryConfig } };
    };
    const fromRoot = pkg.tlclTelemetry ?? {};
    const fromExtra = pkg.build?.extraMetadata?.tlclTelemetry ?? {};
    cachedPackagedConfig = {
      aptabaseAppKey: normalizeConfigValue(fromRoot.aptabaseAppKey)
        ? fromRoot.aptabaseAppKey
        : fromExtra.aptabaseAppKey,
      sentryDsn: normalizeConfigValue(fromRoot.sentryDsn)
        ? fromRoot.sentryDsn
        : fromExtra.sentryDsn,
    };
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
