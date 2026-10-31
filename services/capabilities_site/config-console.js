/* Configuration console — talks to runtime_ops API when present. */
(function () {
  const API_BASE = window.AISENA_RUNTIME_API || "/api/runtime";

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json();
  }

  async function loadDiagnostics() {
    const el = document.getElementById("diagnostics");
    try {
      const data = await fetchJson(API_BASE + "/diagnostics");
      el.textContent = JSON.stringify(data, null, 2);
      el.className = "ok";
      renderFlags(data.flags || {});
    } catch (err) {
      el.className = "err";
      el.textContent =
        "Diagnostics API not reachable yet.\n" +
        "Wire Flask routes to services.runtime_ops and set AISENA_RUNTIME_API if needed.\n" +
        String(err);
      renderFlags({
        "screening.enabled": true,
        "operator.remediation_enabled": true,
        "ui.show_diagnostics": true,
        "tenant.isolation_enforced": true,
      });
    }
  }

  function renderFlags(flags) {
    const root = document.getElementById("flags");
    root.innerHTML = "";
    Object.keys(flags)
      .sort()
      .forEach(function (key) {
        const row = document.createElement("div");
        row.className = "flag-row";
        const label = document.createElement("span");
        label.textContent = key + " = " + String(flags[key]);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Toggle";
        btn.addEventListener("click", function () {
          const next = !flags[key];
          fetchJson(API_BASE + "/flags", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key, value: next }),
          })
            .then(function () {
              return loadDiagnostics();
            })
            .catch(function (err) {
              alert("Could not update flag: " + err);
            });
        });
        row.appendChild(label);
        row.appendChild(btn);
        root.appendChild(row);
      });
  }

  function renderActions() {
    const actions = [
      { id: "clear_cache", label: "Clear cache" },
      { id: "reset_feature_defaults", label: "Reset feature defaults" },
      { id: "disable_screening", label: "Disable screening" },
      { id: "enable_screening", label: "Enable screening" },
    ];
    const root = document.getElementById("actions");
    root.innerHTML = "";
    actions.forEach(function (a) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = a.label;
      btn.addEventListener("click", function () {
        const resultEl = document.getElementById("action-result");
        fetchJson(API_BASE + "/remediate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: a.id }),
        })
          .then(function (data) {
            resultEl.className = data.ok ? "ok" : "err";
            resultEl.textContent = data.message + " — " + data.next_steps;
            return loadDiagnostics();
          })
          .catch(function (err) {
            resultEl.className = "err";
            resultEl.textContent = String(err);
          });
      });
      root.appendChild(btn);
    });
  }

  document.getElementById("btn-refresh").addEventListener("click", loadDiagnostics);
  renderActions();
  loadDiagnostics();
})();
