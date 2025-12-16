import * as Sentry from "@sentry/electron/renderer";
import type { TelemetrySettings } from "../types/telemetryTypes";
import type { Breadcrumb, ErrorEvent as SentryErrorEvent, StackFrame } from "@sentry/core";
import { makeFetchTransport } from "@sentry/browser";

type Listener = (settings: TelemetrySettings) => void;

let currentSettings: TelemetrySettings = {
  crashReportsEnabled: false,
};

let sentryInitialized = false;
let hasLoadedSettings = false;
let sentAppStarted = false;
const listeners = new Set<Listener>();
let cachedSentryDsn: string | null = null;

const WINDOWS_PATH_RE = /[A-Za-z]:\\(?:[^\\\r\n]+\\)*[^\\\r\n]+/g;
const POSIX_PATH_RE = /\/(?:[^/\r\n]+\/)*[^/\r\n]+/g;
const FILE_URL_RE = /file:\/\/\/[^\s)]+/gi;

const sanitizeString = (value: string): string =>
  value
    .replace(FILE_URL_RE, "[REDACTED_URL]")
    .replace(WINDOWS_PATH_RE, "[REDACTED_PATH]")
    .replace(POSIX_PATH_RE, "[REDACTED_PATH]");

const sanitizeUnknown = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeUnknown(v, depth + 1));
  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key.toLowerCase() === "argv") continue;
    next[key] = sanitizeUnknown(val, depth + 1);
  }
  return next;
};

const shouldSendEvent = (event: SentryErrorEvent): boolean => {
  return currentSettings.crashReportsEnabled;
};

const scrubEvent = (event: SentryErrorEvent): SentryErrorEvent => {
  const next: SentryErrorEvent = { ...event };
  if (typeof next.message === "string") next.message = sanitizeString(next.message);

  if ((next as any).server_name) {
    delete (next as any).server_name;
  }
  if ((next as any).user) {
    delete (next as any).user;
  }
  if (next.contexts?.device && typeof next.contexts.device === "object") {
    const device = { ...(next.contexts.device as Record<string, unknown>) };
    if ("name" in device) delete device.name;
    next.contexts = { ...next.contexts, device };
  }

  if ((next as any).request) {
    delete (next as any).request;
  }

  if (next.breadcrumbs) {
    next.breadcrumbs = next.breadcrumbs.map((crumb: Breadcrumb) => {
      const c: Breadcrumb = { ...crumb };
      if (typeof c.message === "string") c.message = sanitizeString(c.message);
      if (c.data) c.data = sanitizeUnknown(c.data) as any;
      return c;
    });
  }

  if (next.exception?.values) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((ex) => {
        const e = { ...ex };
        const frames = e.stacktrace?.frames;
        if (frames) {
          e.stacktrace = {
            ...e.stacktrace,
            frames: frames.map((frame: StackFrame) => {
              const f: StackFrame = { ...frame };
              if ("abs_path" in f) delete (f as any).abs_path;
              if (typeof f.filename === "string") f.filename = sanitizeString(f.filename);
              return f;
            }),
          };
        }
        if (typeof e.value === "string") e.value = sanitizeString(e.value);
        return e;
      }),
    };
  }

  if (next.extra) next.extra = sanitizeUnknown(next.extra) as any;
  return next;
};

const getTelemetryApi = () => {
  if (typeof window === "undefined") return undefined;
  return window.tlcla?.telemetry;
};

const notify = (settings: TelemetrySettings) => {
  listeners.forEach((listener) => listener(settings));
};

const initSentryIfNeeded = async () => {
  const shouldInit = currentSettings.crashReportsEnabled;
  if (!shouldInit || sentryInitialized) return;

  const appVersion = await window.tlcla?.app?.getVersion?.().catch(() => null);
  if (cachedSentryDsn === null) {
    cachedSentryDsn = (await window.tlcla?.telemetry
      ?.getConfig?.()
      .then((cfg) => (cfg?.sentryDsn ? String(cfg.sentryDsn) : ""))
      .catch(() => "")) ?? "";
  }
  if (!cachedSentryDsn) return;

  Sentry.init({
    dsn: cachedSentryDsn,
    // Send directly from the renderer (avoids relying on main-process IPC wiring).
    transport: makeFetchTransport,
    sendDefaultPii: false,
    sendClientReports: false,
    environment: import.meta.env.DEV ? "development" : "production",
    release: appVersion ? `tl-combat-ledger@${appVersion}` : undefined,
    defaultIntegrations: false,
    integrations: [
      Sentry.globalHandlersIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
    ],
    tracesSampleRate: 0,
    beforeSend(event) {
      if (!shouldSendEvent(event)) return null;
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (!currentSettings.crashReportsEnabled) return null;
      const next = { ...breadcrumb };
      if (typeof next.message === "string") next.message = sanitizeString(next.message);
      if (next.data) next.data = sanitizeUnknown(next.data) as any;
      return next;
    },
  });

  Sentry.setUser(null);
  if (appVersion) Sentry.setTag("app_version", appVersion);
  sentryInitialized = true;
};

export const loadTelemetrySettings = async (): Promise<TelemetrySettings> => {
  const api = getTelemetryApi();
  if (!api) {
    hasLoadedSettings = true;
    return currentSettings;
  }

  const settings = await api.getSettings();
  currentSettings = settings;
  hasLoadedSettings = true;
  notify(currentSettings);

  await initSentryIfNeeded();
  if (!sentAppStarted) {
    trackUsage("app.started");
    sentAppStarted = true;
  }

  return currentSettings;
};

export const getTelemetrySettings = (): TelemetrySettings => currentSettings;

export const subscribeTelemetrySettings = (listener: Listener) => {
  listeners.add(listener);
  if (hasLoadedSettings) listener(currentSettings);
  return () => {
    listeners.delete(listener);
  };
};

export const updateTelemetrySettings = async (
  update: Partial<TelemetrySettings>
): Promise<TelemetrySettings> => {
  const api = getTelemetryApi();
  if (!api) return currentSettings;

  const next = await api.setSettings(update);
  currentSettings = next;
  notify(currentSettings);

  await initSentryIfNeeded();
  if (!sentAppStarted) {
    trackUsage("app.started");
    sentAppStarted = true;
  }
  return currentSettings;
};

export const trackUsage = (
  eventName: string,
  props?: Record<string, string | number | boolean>
) => {
  void window.tlcla?.analytics?.trackUsage?.(eventName, props);
};

export const flushTelemetry = async (timeoutMs = 2000): Promise<boolean> => {
  if (!sentryInitialized) return false;
  try {
    const client = Sentry.getClient() as any;
    if (!client?.flush) return false;
    return await client.flush(timeoutMs);
  } catch {
    return false;
  }
};

export const sendTestCrashReport = async (): Promise<void> => {
  if (!currentSettings.crashReportsEnabled) return;
  if (!sentryInitialized) return;

  Sentry.captureException(new Error("Sentry test crash report (renderer)"));
  await flushTelemetry(2000);
};

export const sendTestUsageEvent = async (): Promise<void> => {
  trackUsage("telemetry.test");
};
