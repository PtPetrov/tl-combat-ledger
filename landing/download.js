(function () {
  const APTABASE_APP_KEY = "A-EU-8575792021";
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
    const safeProps = props
      ? Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            typeof value === "string" ? sanitizeString(value) : value,
          ])
        )
      : undefined;

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

  const initLandingAnalytics = () => {
    const page = getCurrentLandingPage();

    trackAptabaseEvent(`${page}_page_view`);

    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        trackAptabaseEvent("download_click", { page });
      });
    }

    const featuresLink = document.querySelector('a[href$="features.html"]');
    if (featuresLink) {
      featuresLink.addEventListener("click", () => {
        trackAptabaseEvent("features_link_click", { from: page });
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

  initLandingAnalytics();
  fetchLatest();
})();
