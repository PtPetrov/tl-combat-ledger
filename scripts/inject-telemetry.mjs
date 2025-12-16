import fs from "node:fs";
import path from "node:path";

const aptabaseAppKey = String(
  process.env.TLCL_APTABASE_APP_KEY ?? process.env.APTABASE_APP_KEY ?? ""
).trim();

const sentryDsn = String(
  process.env.TLCL_SENTRY_DSN ?? process.env.SENTRY_DSN ?? ""
).trim();

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
};

const maybeInjectPackageJson = () => {
  if (!aptabaseAppKey && !sentryDsn) return;

  const packageJsonPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  pkg.tlclTelemetry = pkg.tlclTelemetry ?? {};
  if (aptabaseAppKey) pkg.tlclTelemetry.aptabaseAppKey = aptabaseAppKey;
  if (sentryDsn) pkg.tlclTelemetry.sentryDsn = sentryDsn;

  writeJson(packageJsonPath, pkg);
};

const maybeInjectLanding = () => {
  if (!aptabaseAppKey) return;

  const landingPath = path.join(process.cwd(), "landing", "download.js");
  if (!fs.existsSync(landingPath)) return;

  const content = fs.readFileSync(landingPath, "utf8");
  const updated = content.replaceAll("__TLCL_APTABASE_APP_KEY__", aptabaseAppKey);
  if (updated !== content) fs.writeFileSync(landingPath, updated);
};

maybeInjectPackageJson();
maybeInjectLanding();

