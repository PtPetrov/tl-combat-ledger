import { app } from "electron";
import Store from "electron-store";
import * as Sentry from "@sentry/electron/main";
import type {
  Breadcrumb,
  ErrorEvent as SentryErrorEvent,
  Envelope,
  StackFrame,
  Transport,
  TransportMakeRequestResponse,
} from "@sentry/core";
import { makeElectronOfflineTransport } from "@sentry/electron/main";

export type TelemetrySettings = {
  crashReportsEnabled: boolean;
  usageStatsEnabled: boolean;
};

const SENTRY_DSN =
  "https://3dee2673b463e85030996b15f6e716d6@o4510537255616512.ingest.de.sentry.io/4510537621241936";

const store = new Store<TelemetrySettings>({
  name: "telemetry",
  defaults: {
    crashReportsEnabled: false,
    usageStatsEnabled: false,
  },
});

let currentSettings: TelemetrySettings = store.store;
let sentryInitialized = false;

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

const isUsageEvent = (event: SentryErrorEvent): boolean =>
  event.tags?.telemetry === "usage";

const shouldSendEvent = (event: SentryErrorEvent): boolean => {
  if (isUsageEvent(event)) return currentSettings.usageStatsEnabled;
  return currentSettings.crashReportsEnabled;
};

const scrubEvent = (event: SentryErrorEvent): SentryErrorEvent => {
  const next: SentryErrorEvent = { ...event };

  if (typeof next.message === "string") {
    next.message = sanitizeString(next.message);
  }

  if (next.server_name) {
    delete (next as any).server_name;
  }
  if (next.user) {
    delete (next as any).user;
  }
  if (next.contexts?.device && typeof next.contexts.device === "object") {
    const device = { ...(next.contexts.device as Record<string, unknown>) };
    if ("name" in device) delete device.name;
    next.contexts = { ...next.contexts, device } as any;
  }

  if (next.request) {
    // URLs often contain file:// and other environment info we don't need.
    delete (next as any).request;
  }

  if (next.breadcrumbs) {
    next.breadcrumbs = next.breadcrumbs.map((crumb: Breadcrumb) => {
      const c: Breadcrumb = { ...crumb };
      if (typeof c.message === "string") c.message = sanitizeString(c.message);
      if (typeof c.category === "string") c.category = sanitizeString(c.category);
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
              if (typeof (f as any).module === "string") {
                (f as any).module = sanitizeString((f as any).module);
              }
              return f;
            }),
          };
        }
        if (typeof e.value === "string") e.value = sanitizeString(e.value);
        if (typeof e.type === "string") e.type = sanitizeString(e.type);
        return e;
      }),
    };
  }

  if (next.extra) {
    next.extra = sanitizeUnknown(next.extra) as any;
  }

  return next;
};

export const getTelemetrySettings = (): TelemetrySettings => ({
  ...currentSettings,
});

export const setTelemetrySettings = (
  update: Partial<TelemetrySettings>
): TelemetrySettings => {
  const next: TelemetrySettings = {
    crashReportsEnabled:
      typeof update.crashReportsEnabled === "boolean"
        ? update.crashReportsEnabled
        : currentSettings.crashReportsEnabled,
    usageStatsEnabled:
      typeof update.usageStatsEnabled === "boolean"
        ? update.usageStatsEnabled
        : currentSettings.usageStatsEnabled,
  };

  store.set(next);
  currentSettings = next;
  return getTelemetrySettings();
};

const makeGatedTransport = () => {
  const baseFactory = makeElectronOfflineTransport() as unknown as (
    transportOptions: unknown
  ) => Transport;

  return (transportOptions: unknown): Transport => {
    const baseTransport = baseFactory(transportOptions);

    return {
      send(envelope: Envelope): PromiseLike<TransportMakeRequestResponse> {
        // Never send anything unless the user opted into at least one telemetry category.
        if (!currentSettings.crashReportsEnabled && !currentSettings.usageStatsEnabled) {
          return Promise.resolve({ statusCode: 200 });
        }
        return baseTransport.send(envelope);
      },
      flush(timeout?: number): PromiseLike<boolean> {
        return baseTransport.flush(timeout);
      },
    };
  };
};

export const initSentryBeforeReady = () => {
  if (sentryInitialized) return;

  const isDev = !app.isPackaged;
  const release = `tl-combat-ledger@${app.getVersion()}`;

  Sentry.init({
    dsn: SENTRY_DSN,
    release,
    environment: isDev ? "development" : "production",
    sendDefaultPii: false,
    sendClientReports: false,
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      // Minimal device/OS/app context for crash triage (e.g. Windows version).
      Sentry.electronContextIntegration(),
    ],
    // Avoid automatic performance/OTel setup.
    skipOpenTelemetrySetup: true,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    // We initialize the renderer SDK manually (opt-in), so we don't need protocol-based IPC.
    ipcMode: Sentry.IPCMode.Classic,
    transport: makeGatedTransport(),
    beforeSend(event) {
      if (!shouldSendEvent(event)) return null;
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (!currentSettings.crashReportsEnabled) return null;
      const next = { ...breadcrumb };
      if (typeof next.message === "string") next.message = sanitizeString(next.message);
      if (typeof next.category === "string") next.category = sanitizeString(next.category);
      if (next.data) next.data = sanitizeUnknown(next.data) as any;
      return next;
    },
  });

  // Attach stable, non-identifying context.
  Sentry.setUser(null);
  Sentry.setTag("platform", process.platform);
  Sentry.setTag("app_version", app.getVersion());

  sentryInitialized = true;
};

// Sentry Electron main must be initialized before Electron's `ready` event.
// We gate sending at runtime based on the user's opt-in settings.
initSentryBeforeReady();
