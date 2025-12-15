import { initialize, trackEvent } from "@aptabase/electron/main";

const APTABASE_APP_KEY = process.env.APTABASE_APP_KEY ?? "A-EU-8575792021";

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
  await trackEvent(safeEventName, sanitizeProps(props));
};

// Must be invoked before the Electron app `ready` event.
initialize(APTABASE_APP_KEY);

