/* Artist Settings page */
(function () {
  "use strict";

  const API = "/artists";
  const CONFIG_API = "/config";
  let fullLexicon = {};
  let currentSection = "categories";
  let scanPollTimer = null;

  document.addEventListener("DOMContentLoaded", () => {
    loadConfig();
    loadLexicon();
    pollScanStatus();

    document.getElementById("btn-save-config").addEventListener("click", saveConfig);
    document.getElementById("btn-browse-root").addEventListener("click", browseRoot);
    document.getElementById("btn-scan").addEventListener("click", triggerScan);
    document.getElementById("btn-save-lexicon").addEventListener("click", saveLexicon);
    document.getElementById("btn-reset-lexicon").addEventListener("click", resetLexicon);
    document.getElementById("btn-export-lexicon").addEventListener("click", exportLexicon);
    document.getElementById("btn-import-lexicon").addEventListener("change", importLexicon);

    // Tab switching
    document.querySelectorAll(".lexicon-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        // Save current edits back before switching
        saveCurrentEditsToMemory();
        currentSection = tab.dataset.section;
        document.querySelectorAll(".lexicon-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        renderLexiconSection();
      });
    });
  });

  // ------------------------------------------------------------------
  // Config (settings)
  // ------------------------------------------------------------------
  async function loadConfig() {
    try {
      const r = await fetch(CONFIG_API + "/schema");
      const schema = await r.json();
      const cr = await fetch(CONFIG_API);
      const cfg = await cr.json();

      document.getElementById("cfg-storage-root").value = cfg.artist_storage_root || "";
      document.getElementById("cfg-scan-enabled").checked = !!cfg.artist_scan_enabled;
      document.getElementById("cfg-scan-on-change").checked = !!cfg.artist_scan_on_change;
    } catch (e) {
      console.error("Load config:", e);
    }
  }

  async function browseRoot() {
    const btn = document.getElementById("btn-browse-root");
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const r = await fetch("/config/select-folder", { method: "POST" });
      const d = await r.json();
      if (d.path) {
        document.getElementById("cfg-storage-root").value = d.path;
      }
    } catch (e) {
      console.error("Browse:", e);
    }
    btn.disabled = false;
    btn.textContent = "Browse";
  }

  async function saveConfig() {
    const btn = document.getElementById("btn-save-config");
    const fb = document.getElementById("config-feedback");
    btn.disabled = true;
    fb.textContent = "Saving\u2026";
    fb.className = "save-feedback";

    try {
      const r = await fetch(CONFIG_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_storage_root: document.getElementById("cfg-storage-root").value.trim(),
          artist_scan_enabled: document.getElementById("cfg-scan-enabled").checked,
          artist_scan_on_change: document.getElementById("cfg-scan-on-change").checked,
        }),
      });
      if (r.ok) {
        fb.textContent = "\u2713 Saved";
        fb.className = "save-feedback save-ok";
      } else {
        fb.textContent = "\u2717 Error";
        fb.className = "save-feedback save-err";
      }
    } catch (e) {
      fb.textContent = "\u2717 Network error";
      fb.className = "save-feedback save-err";
    }
    btn.disabled = false;
  }

  // ------------------------------------------------------------------
  // Lexicon
  // ------------------------------------------------------------------
  async function loadLexicon() {
    try {
      const r = await fetch(API + "/lexicon");
      if (!r.ok) throw new Error("HTTP " + r.status);
      fullLexicon = await r.json();
      renderLexiconSection();
    } catch (e) {
      console.error("Load lexicon:", e);
      const fb = document.getElementById("lexicon-feedback");
      if (fb) {
        fb.textContent = "\u2717 Failed to load lexicon";
        fb.className = "save-feedback save-err";
      }
    }
  }

  function renderLexiconSection() {
    const editor = document.getElementById("lexicon-editor");
    editor.classList.remove("invalid");

    if (currentSection === "full") {
      editor.value = JSON.stringify(fullLexicon, null, 2);
    } else {
      const section = fullLexicon[currentSection];
      editor.value = section !== undefined ? JSON.stringify(section, null, 2) : "{}";
    }
  }

  function saveCurrentEditsToMemory() {
    const editor = document.getElementById("lexicon-editor");
    try {
      const parsed = JSON.parse(editor.value);
      if (currentSection === "full") {
        fullLexicon = parsed;
      } else {
        fullLexicon[currentSection] = parsed;
      }
      editor.classList.remove("invalid");
    } catch (e) {
      // Don't update if invalid JSON
      editor.classList.add("invalid");
    }
  }

  async function saveLexicon() {
    saveCurrentEditsToMemory();
    const fb = document.getElementById("lexicon-feedback");
    const btn = document.getElementById("btn-save-lexicon");
    btn.disabled = true;
    fb.textContent = "Saving\u2026";
    fb.className = "save-feedback";

    try {
      const r = await fetch(API + "/lexicon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullLexicon),
      });
      if (r.ok) {
        fb.textContent = "\u2713 Saved";
        fb.className = "save-feedback save-ok";
      } else {
        const d = await r.json().catch(() => ({}));
        fb.textContent = "\u2717 " + (d.detail || "Error");
        fb.className = "save-feedback save-err";
      }
    } catch (e) {
      fb.textContent = "\u2717 Network error";
      fb.className = "save-feedback save-err";
    }
    btn.disabled = false;
  }

  async function resetLexicon() {
    if (!confirm("Reset lexicon to defaults? Current edits will be lost.")) return;
    const fb = document.getElementById("lexicon-feedback");
    try {
      // Save empty to trigger reset, then reload
      const r = await fetch(API + "/lexicon");
      fullLexicon = await r.json();
      renderLexiconSection();
      fb.textContent = "Reloaded from disk";
      fb.className = "save-feedback save-ok";
    } catch (e) {
      fb.textContent = "\u2717 Error";
      fb.className = "save-feedback save-err";
    }
  }

  function exportLexicon() {
    saveCurrentEditsToMemory();
    const blob = new Blob([JSON.stringify(fullLexicon, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "artist_lexicon.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importLexicon(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        fullLexicon = JSON.parse(reader.result);
        renderLexiconSection();
        document.getElementById("lexicon-feedback").textContent = "Imported \u2014 click Save to persist";
        document.getElementById("lexicon-feedback").className = "save-feedback save-ok";
      } catch (err) {
        document.getElementById("lexicon-feedback").textContent = "\u2717 Invalid JSON file";
        document.getElementById("lexicon-feedback").className = "save-feedback save-err";
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ------------------------------------------------------------------
  // Scan
  // ------------------------------------------------------------------
  async function triggerScan() {
    const btn = document.getElementById("btn-scan");
    btn.disabled = true;
    try {
      await fetch(API + "/scan", { method: "POST" });
      pollScanStatus();
    } catch (e) { btn.disabled = false; }
  }

  async function pollScanStatus() {
    clearInterval(scanPollTimer);
    const update = async () => {
      try {
        const r = await fetch(API + "/scan/status");
        const d = await r.json();
        const el = document.getElementById("scan-status");
        const btn = document.getElementById("btn-scan");
        const info = document.getElementById("scan-info");
        if (d.is_scanning) {
          el.textContent = "Scanning\u2026";
          btn.disabled = true;
        } else {
          btn.disabled = false;
          if (d.last_run) {
            const s = d.last_run.stats;
            el.textContent = d.last_run.status === "completed"
              ? `Last: ${s?.artists || 0} artists`
              : `Last: ${d.last_run.status}`;
            info.textContent = d.last_run.finished_at
              ? `Finished: ${d.last_run.finished_at}`
              : "";
            clearInterval(scanPollTimer);
          } else {
            el.textContent = "No scans yet";
            clearInterval(scanPollTimer);
          }
        }
      } catch (e) {
        const el = document.getElementById("scan-status");
        if (el) el.textContent = "Unable to load scan status";
        clearInterval(scanPollTimer);
      }
    };
    await update();
    scanPollTimer = setInterval(update, 5000);
  }
})();
