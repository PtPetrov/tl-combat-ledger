(function () {
  const downloadBtn = document.getElementById("download-btn");
  const downloadLabel = document.getElementById("download-label");
  const downloadVersion = document.getElementById("download-version");
  const meta = document.getElementById("download-meta");

  const releasesApi = "https://api.github.com/repos/PtPetrov/tl-combat-ledger/releases/latest";
  const fallbackUrl = "https://github.com/PtPetrov/tl-combat-ledger/releases/latest";

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

  fetchLatest();
})();
