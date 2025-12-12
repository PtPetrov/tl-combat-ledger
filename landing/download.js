(function () {
  const downloadBtn = document.getElementById("download-btn");
  const meta = document.getElementById("download-meta");

  const releasesApi = "https://api.github.com/repos/PtPetrov/tl-combat-ledger/releases/latest";
  const fallbackUrl = "https://github.com/PtPetrov/tl-combat-ledger/releases/latest";

  async function fetchLatest() {
    try {
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
        downloadBtn.textContent = "Download for Windows";
        meta.textContent = `Current version: ${version}`;
      } else {
        throw new Error("No installer asset found");
      }
    } catch (err) {
      console.error("Failed to fetch latest release", err);
      downloadBtn.href = fallbackUrl;
      downloadBtn.textContent = "Download latest";
      meta.textContent = "Could not fetch the current version.";
    }
  }

  fetchLatest();
})();
