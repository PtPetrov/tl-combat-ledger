(function () {
  const APTABASE_APP_KEY_RAW = "__TLCL_APTABASE_APP_KEY__";
  const APTABASE_APP_KEY =
    APTABASE_APP_KEY_RAW.startsWith("__") && APTABASE_APP_KEY_RAW.endsWith("__")
      ? ""
      : APTABASE_APP_KEY_RAW;
  const SESSION_TIMEOUT_SEC = 60 * 60;

  const downloadBtn = document.getElementById("download-btn");
  const downloadLabel = document.getElementById("download-label");
  const downloadVersion = document.getElementById("download-version");
  const meta = document.getElementById("download-meta");

  const releasesApi = "https://api.github.com/repos/PtPetrov/tl-combat-ledger/releases/latest";
  const fallbackUrl = "https://github.com/PtPetrov/tl-combat-ledger/releases/latest";

  const WINDOWS_PATH_RE = /[A-Za-z]:\\(?:[^\\\r\n]+\\)*[^\\\r\n]+/g;
  const POSIX_PATH_RE = /\/(?:[^/\r\n]+\/)*[^/\r\n]+/g;
  const FILE_URL_RE = /file:\/\/\/[^\s)]+/gi;

  const sanitizeString = (value) =>
    String(value)
      .replace(FILE_URL_RE, "[REDACTED_URL]")
      .replace(WINDOWS_PATH_RE, "[REDACTED_PATH]")
      .replace(POSIX_PATH_RE, "[REDACTED_PATH]");

  const shouldTrack = () => {
    const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return dnt !== "1";
  };

  const getAptabaseBaseUrl = () => {
    const parts = String(APTABASE_APP_KEY || "").split("-");
    const region = parts[1];
    if (region === "EU") return "https://eu.aptabase.com";
    if (region === "US") return "https://us.aptabase.com";
    if (region === "DEV") return "http://localhost:3000";
    return "https://eu.aptabase.com";
  };

  const newSessionId = () => {
    const epoch = Math.floor(Date.now() / 1000).toString();
    const rand = Math.floor(Math.random() * 1e8).toString().padStart(8, "0");
    return `${epoch}${rand}`;
  };

  const newInstallId = () => {
    try {
      if (crypto?.randomUUID) return crypto.randomUUID();
    } catch {
      // ignore
    }
    const epoch = Math.floor(Date.now() / 1000).toString();
    const rand = Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
    return `web-${epoch}-${rand}`;
  };

  const getInstallId = () => {
    try {
      const existing = String(localStorage.getItem("tlcl:a:installId") || "").trim();
      if (existing) return existing;
      const next = newInstallId();
      localStorage.setItem("tlcl:a:installId", next);
      return next;
    } catch {
      return newInstallId();
    }
  };

  const getSessionId = () => {
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const lastTouchedSec = Number(localStorage.getItem("tlcl:a:lastTouchedSec") || "0");
      let sessionId = localStorage.getItem("tlcl:a:sessionId") || "";

      if (!sessionId || !Number.isFinite(lastTouchedSec) || nowSec - lastTouchedSec > SESSION_TIMEOUT_SEC) {
        sessionId = newSessionId();
        localStorage.setItem("tlcl:a:sessionId", sessionId);
      }

      localStorage.setItem("tlcl:a:lastTouchedSec", String(nowSec));
      return sessionId;
    } catch {
      return newSessionId();
    }
  };

  const trackAptabaseEvent = (eventName, props) => {
    if (!APTABASE_APP_KEY || !shouldTrack()) return;

    const safeEventName = sanitizeString(eventName).slice(0, 80);
    const mergedProps = {
      ...(props || {}),
      install_id: getInstallId(),
    };
    const safeProps = Object.fromEntries(
      Object.entries(mergedProps).map(([key, value]) => [
        key,
        typeof value === "string" ? sanitizeString(value) : value,
      ])
    );

    const body = {
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      eventName: safeEventName,
      systemProps: {
        isDebug: location.hostname === "localhost" || location.hostname === "127.0.0.1",
        locale: navigator.language || "",
        osName: "Web",
        osVersion: "",
        engineName: "Browser",
        engineVersion: "",
        appVersion: "",
        sdkVersion: "tl-combat-ledger-landing@1",
      },
      props: safeProps,
    };

    try {
      // Fire-and-forget.
      void fetch(`${getAptabaseBaseUrl()}/api/v0/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "App-Key": APTABASE_APP_KEY,
        },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // Ignore.
    }
  };

  const getCurrentLandingPage = () => {
    const path = (location.pathname || "/").toLowerCase();
    if (path.endsWith("/features.html") || path.endsWith("/features")) return "features";
    return "landing";
  };

  const getPageViewEventName = (page) => {
    if (page === "features") return "Features Page View";
    return "Landing Page View";
  };

  const initInspectionGuards = () => {
    // Best-effort only: browsers do not allow reliably blocking devtools.
    document.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
      },
      { capture: true }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        const key = String(event.key || "").toLowerCase();
        const ctrlOrCmd = event.ctrlKey || event.metaKey;

        // F12
        if (key === "f12") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        // Ctrl/Cmd+Shift+I/J/C/K (Chrome/Edge/Firefox devtools)
        if (ctrlOrCmd && event.shiftKey && ["i", "j", "c", "k"].includes(key)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        // Cmd+Option+I/J/C (macOS)
        if (event.metaKey && event.altKey && ["i", "j", "c"].includes(key)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        // View source (Ctrl/Cmd+U)
        if (ctrlOrCmd && key === "u") {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true }
    );
  };

  const initLandingAnalytics = () => {
    const page = getCurrentLandingPage();

    trackAptabaseEvent(getPageViewEventName(page), { page });

    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        trackAptabaseEvent("Download Click", { page });
      });
    }

    const featuresLink = document.querySelector('a[href$="features.html"]');
    if (featuresLink) {
      featuresLink.addEventListener("click", () => {
        trackAptabaseEvent("Features Link Click", { from: page });
      });
    }
  };

  async function fetchLatest() {
    try {
      if (downloadLabel) downloadLabel.textContent = "Download for Windows";
      if (downloadVersion) downloadVersion.textContent = "";
      if (meta) meta.textContent = "Fetching latest release…";

      const res = await fetch(releasesApi, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const versionRaw = (data.tag_name || data.name || "?").toString();
      const version = versionRaw.toLowerCase().startsWith("v")
        ? versionRaw
        : `v${versionRaw}`;
      const asset = (data.assets || []).find((a) =>
        a.name && a.name.toLowerCase().includes("setup-x64")
      );

      if (asset?.browser_download_url) {
        downloadBtn.href = asset.browser_download_url;
        if (downloadLabel) downloadLabel.textContent = "Download for Windows";
        if (downloadVersion) downloadVersion.textContent = version;
        if (meta) meta.textContent = "";
      } else {
        throw new Error("No installer asset found");
      }
    } catch (err) {
      console.error("Failed to fetch latest release", err);
      downloadBtn.href = fallbackUrl;
      if (downloadLabel) downloadLabel.textContent = "Download latest";
      if (downloadVersion) downloadVersion.textContent = "";
      if (meta) meta.textContent = "Could not fetch the current version. Opening the latest release page.";
    }
  }

  initInspectionGuards();
  initLandingAnalytics();
  fetchLatest();
})();
