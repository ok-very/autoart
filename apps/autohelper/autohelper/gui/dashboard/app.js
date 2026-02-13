/* AutoHelper Dashboard — vanilla JS client for config + contacts API */

const API = "";  // Same origin

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  return res.json();
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

let _toastTimer = null;
function toast(msg, type) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast visible " + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = "toast"; }, 3000);
}

function fmtTime(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleString();
}

// ---------------------------------------------------------------------------
// Service Status
// ---------------------------------------------------------------------------

async function loadStatus() {
  try {
    const [health, status] = await Promise.all([
      api("GET", "/health"),
      api("GET", "/status"),
    ]);

    const rows = [
      ["Service", health.status === "ok" ? "ok" : "error",
       health.status === "ok" ? "Running" : "Error"],
      ["Database", status.database?.accessible ? "ok" : "error",
       status.database?.accessible ? "Connected" : "Unreachable"],
      ["Migrations", "ok", status.database?.migration_count + " applied"],
      ["Uptime", "ok", health.uptime || "\u2014"],
    ];

    const container = $("#status-rows");
    container.innerHTML = rows.map(([label, dot, value]) =>
      `<div class="status-row">
        <span class="label"><span class="status-dot ${dot}"></span>${label}</span>
        <span class="value">${value}</span>
      </div>`
    ).join("");
  } catch (e) {
    $("#status-rows").innerHTML =
      `<div class="status-row">
        <span class="label"><span class="status-dot error"></span>Service</span>
        <span class="value">Unreachable</span>
      </div>`;
  }
}

// ---------------------------------------------------------------------------
// Config (General Settings)
// ---------------------------------------------------------------------------

let _config = {};

async function loadConfig() {
  try {
    _config = await api("GET", "/config");
    populateGeneralSettings();
    populateContactSettings();
    populateMailSettings();
    populatePairingStatus();
  } catch (e) {
    toast("Failed to load config", "error");
  }
}

function populateGeneralSettings() {
  const rootsEl = $("#cfg-allowed-roots");
  const excludesEl = $("#cfg-excludes");
  const logLevelEl = $("#cfg-log-level");

  if (rootsEl) rootsEl.value = (_config.allowed_roots || []).join("\n");
  if (excludesEl) excludesEl.value = (_config.excludes || []).join(", ");
  if (logLevelEl) logLevelEl.value = _config.log_level || "INFO";
}

async function saveGeneralSettings() {
  const rootsVal = $("#cfg-allowed-roots").value.trim();
  const excludesVal = $("#cfg-excludes").value.trim();

  const patch = {
    allowed_roots: rootsVal ? rootsVal.split("\n").map(s => s.trim()).filter(Boolean) : [],
    excludes: excludesVal ? excludesVal.split(",").map(s => s.trim()).filter(Boolean) : [],
    log_level: $("#cfg-log-level").value,
  };

  try {
    _config = await api("PUT", "/config", patch);
    toast("Settings saved", "success");
  } catch (e) {
    toast("Failed to save settings", "error");
  }
}

// ---------------------------------------------------------------------------
// Contact Sync Settings
// ---------------------------------------------------------------------------

function populateContactSettings() {
  $("#cfg-contact-enabled").checked = _config.contact_sync_enabled || false;
  $("#cfg-contact-csv-path").value = _config.contact_sync_csv_path || "";
  $("#cfg-contact-interval").value = _config.contact_sync_interval_minutes || 30;
  $("#cfg-contact-hours-start").value = _config.contact_sync_work_hours_start || 8;
  $("#cfg-contact-hours-end").value = _config.contact_sync_work_hours_end || 18;
  $("#cfg-contact-timezone").value = _config.contact_sync_timezone || "America/Los_Angeles";
  $("#cfg-contact-upn").value = _config.contact_sync_exchange_upn || "";
  $("#cfg-contact-org").value = _config.contact_sync_exchange_org || "";
  $("#cfg-contact-app-id").value = _config.contact_sync_exchange_app_id || "";
  $("#cfg-contact-cert-thumb").value = _config.contact_sync_exchange_cert_thumbprint || "";
  $("#cfg-contact-dry-run").checked = _config.contact_sync_dry_run || false;
  $("#cfg-contact-batch-size").value = _config.contact_sync_batch_size || 50;
  $("#cfg-contact-prefix").value = _config.contact_sync_managed_prefix || "BFA-";
}

async function saveContactSettings() {
  const patch = {
    contact_sync_enabled: $("#cfg-contact-enabled").checked,
    contact_sync_csv_path: $("#cfg-contact-csv-path").value.trim(),
    contact_sync_interval_minutes: parseInt($("#cfg-contact-interval").value, 10) || 30,
    contact_sync_work_hours_start: parseInt($("#cfg-contact-hours-start").value, 10) || 8,
    contact_sync_work_hours_end: parseInt($("#cfg-contact-hours-end").value, 10) || 18,
    contact_sync_timezone: $("#cfg-contact-timezone").value.trim() || "America/Los_Angeles",
    contact_sync_exchange_upn: $("#cfg-contact-upn").value.trim(),
    contact_sync_exchange_org: $("#cfg-contact-org").value.trim(),
    contact_sync_exchange_app_id: $("#cfg-contact-app-id").value.trim(),
    contact_sync_exchange_cert_thumbprint: $("#cfg-contact-cert-thumb").value.trim(),
    contact_sync_dry_run: $("#cfg-contact-dry-run").checked,
    contact_sync_batch_size: parseInt($("#cfg-contact-batch-size").value, 10) || 50,
    contact_sync_managed_prefix: $("#cfg-contact-prefix").value.trim() || "BFA-",
  };

  try {
    _config = await api("PUT", "/config", patch);
    toast("Contact sync settings saved", "success");
  } catch (e) {
    toast("Failed to save contact settings", "error");
  }
}

// ---------------------------------------------------------------------------
// Contact Sync Status
// ---------------------------------------------------------------------------

async function loadContactStatus() {
  try {
    const status = await api("GET", "/contacts/status");
    const rows = [
      ["Enabled", status.enabled ? "ok" : "warn",
       status.enabled ? "Yes" : "No"],
      ["Last Sync", "ok", fmtTime(status.last_sync)],
      ["Next Sync", "ok", fmtTime(status.next_sync)],
      ["Last Result", status.last_status === "failed" ? "error" : "ok",
       status.last_status || "\u2014"],
    ];

    $("#contact-status-rows").innerHTML = rows.map(([label, dot, value]) =>
      `<div class="status-row">
        <span class="label"><span class="status-dot ${dot}"></span>${label}</span>
        <span class="value">${value}</span>
      </div>`
    ).join("");
  } catch {
    $("#contact-status-rows").innerHTML =
      `<div class="status-row">
        <span class="label">Status</span>
        <span class="value empty">Module not available</span>
      </div>`;
  }
}

async function loadContactHistory() {
  try {
    const data = await api("GET", "/contacts/history");
    const rows = data.entries || [];

    if (rows.length === 0) {
      $("#contact-history-body").innerHTML =
        `<tr><td colspan="5" class="empty">No sync history</td></tr>`;
      return;
    }

    $("#contact-history-body").innerHTML = rows.map(r =>
      `<tr>
        <td>${fmtTime(r.started_at)}</td>
        <td>${r.status}</td>
        <td>${r.created ?? 0}</td>
        <td>${r.updated ?? 0}</td>
        <td>${r.deleted ?? 0}</td>
      </tr>`
    ).join("");
  } catch {
    $("#contact-history-body").innerHTML =
      `<tr><td colspan="5" class="empty">Unavailable</td></tr>`;
  }
}

async function triggerManualSync() {
  const btn = $("#btn-manual-sync");
  btn.disabled = true;
  btn.textContent = "Syncing...";

  try {
    const result = await api("POST", "/contacts/sync");
    toast(result.message || "Sync triggered", "success");
    await loadContactStatus();
    await loadContactHistory();
  } catch (e) {
    toast("Sync failed: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sync Now";
  }
}

// ---------------------------------------------------------------------------
// Mail Settings
// ---------------------------------------------------------------------------

function populateMailSettings() {
  $("#cfg-mail-enabled").checked = _config.mail_enabled || false;
  $("#cfg-mail-interval").value = _config.mail_poll_interval || 30;
}

async function saveMailSettings() {
  const patch = {
    mail_enabled: $("#cfg-mail-enabled").checked,
    mail_poll_interval: parseInt($("#cfg-mail-interval").value, 10) || 30,
  };

  try {
    _config = await api("PUT", "/config", patch);
    toast("Mail settings saved", "success");
  } catch (e) {
    toast("Failed to save mail settings", "error");
  }
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

function populatePairingStatus() {
  const key = _config.autoart_link_key;
  const paired = !!key;
  $("#pairing-status").textContent = paired ? "Paired" : "Not paired";
  $("#pairing-dot").className = "status-dot " + (paired ? "ok" : "warn");
  $("#btn-unpair").style.display = paired ? "" : "none";
  // Pair button visible only when not paired and frontend URL is configured
  const hasFrontend = _config.autoart_frontend_url || _config.autoart_api_url;
  $("#btn-pair").style.display = (!paired && hasFrontend) ? "" : "none";
}

async function doPair() {
  const code = prompt("Enter 6-character pairing code:");
  if (!code || code.length !== 6) return;

  try {
    // Redeem pairing code via backend
    const apiUrl = _config.autoart_api_url || "http://localhost:3001";
    const res = await fetch(apiUrl + "/api/pair/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    if (!res.ok) throw new Error("Invalid code or expired");
    const data = await res.json();

    // Store key
    _config = await api("PUT", "/config", { autoart_link_key: data.key });
    populatePairingStatus();
    toast("Paired successfully", "success");
  } catch (e) {
    toast("Pairing failed: " + e.message, "error");
  }
}

async function doUnpair() {
  if (!confirm("Unpair from AutoArt backend?")) return;

  try {
    // Notify backend (best-effort)
    const apiUrl = _config.autoart_api_url || "http://localhost:3001";
    const key = _config.autoart_link_key;
    if (key) {
      fetch(apiUrl + "/api/autohelper/unpair", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-autohelper-key": key,
        },
      }).catch(() => {});
    }

    // Clear local key
    _config = await api("PUT", "/config", { autoart_link_key: "" });
    populatePairingStatus();
    toast("Unpaired", "success");
  } catch (e) {
    toast("Unpair failed: " + e.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Load all data
  loadStatus();
  loadConfig();
  loadContactStatus();
  loadContactHistory();

  // Bind save buttons
  $("#btn-save-general").addEventListener("click", saveGeneralSettings);
  $("#btn-save-contacts").addEventListener("click", saveContactSettings);
  $("#btn-save-mail").addEventListener("click", saveMailSettings);

  // Contact sync actions
  $("#btn-manual-sync").addEventListener("click", triggerManualSync);

  // Pairing
  $("#btn-pair").addEventListener("click", doPair);
  $("#btn-unpair").addEventListener("click", doUnpair);

  // Refresh status every 30s
  setInterval(() => {
    loadStatus();
    loadContactStatus();
  }, 30000);
});
