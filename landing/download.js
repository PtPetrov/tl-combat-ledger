(function () {
  const downloadBtn = document.getElementById("download-btn");
  const meta = document.getElementById("download-meta");
  const footnote = document.getElementById("version-footnote");

  const releasesApi = "https://api.github.com/repos/PtPetrov/tl-combat-ledger/releases/latest";
  const fallbackUrl = "https://github.com/PtPetrov/tl-combat-ledger/releases/latest";

  async function fetchLatest() {
    try {
      const res = await fetch(releasesApi, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const asset = (data.assets || []).find((a) =>
        a.name && a.name.toLowerCase().includes("setup-x64")
      );

      if (asset?.browser_download_url) {
        downloadBtn.href = asset.browser_download_url;
        downloadBtn.textContent = "Download for Windows";
        meta.textContent = `Latest: v${data.tag_name || data.name || "?"} · ${asset.name}`;
        if (footnote) footnote.textContent = `Current release: ${data.tag_name || asset.name}`;
      } else {
        throw new Error("No installer asset found");
      }
    } catch (err) {
      console.error("Failed to fetch latest release", err);
      downloadBtn.href = fallbackUrl;
      downloadBtn.textContent = "View releases";
      meta.textContent = "Could not fetch latest build. Open releases to download.";
      if (footnote) footnote.textContent = "";
    }
  }

  fetchLatest();
})();
