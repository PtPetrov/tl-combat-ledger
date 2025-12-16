import { initialize, trackEvent } from "@aptabase/electron/main";
import Store from "electron-store";
import { randomUUID } from "node:crypto";

import { getAptabaseAppKey } from "./telemetryConfig";

type AnalyticsIdentity = {
  installId: string;
};

const identityStore = new Store<AnalyticsIdentity>({
  name: "analytics",
  defaults: {
    installId: "",
  },
});

const getOrCreateInstallId = (): string => {
  const existing = String(identityStore.get("installId") || "").trim();
  if (existing) return existing;
  const next = randomUUID();
  identityStore.set("installId", next);
  return next;
};

const INSTALL_ID = getOrCreateInstallId();

const WINDOWS_PATH_RE = /[A-Za-z]:\\(?:[^\\\r\n]+\\)*[^\\\r\n]+/g;
const POSIX_PATH_RE = /\/(?:[^/\r\n]+\/)*[^/\r\n]+/g;
const FILE_URL_RE = /file:\/\/\/[^\s)]+/gi;

const sanitizeString = (value: string): string =>
  value
    .replace(FILE_URL_RE, "[REDACTED_URL]")
    .replace(WINDOWS_PATH_RE, "[REDACTED_PATH]")
    .replace(POSIX_PATH_RE, "[REDACTED_PATH]");

const sanitizeProps = (
  props?: Record<string, string | number | boolean>
): Record<string, string | number | boolean> | undefined => {
  if (!props) return undefined;

  const next: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string") next[key] = sanitizeString(value);
    else next[key] = value;
  }
  return next;
};

export const trackUsageEvent = async (
  eventName: string,
  props?: Record<string, string | number | boolean>
): Promise<void> => {
  const safeEventName = sanitizeString(eventName).slice(0, 80);
  const nextProps: Record<string, string | number | boolean> = {
    ...(props ?? {}),
  };
  if (!("install_id" in nextProps)) nextProps.install_id = INSTALL_ID;
  await trackEvent(safeEventName, sanitizeProps(nextProps));
};

// Must be invoked before the Electron app `ready` event.
const aptabaseAppKey = getAptabaseAppKey();
if (aptabaseAppKey) {
  initialize(aptabaseAppKey);
}
