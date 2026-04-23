(function () {
  const form = document.getElementById("probe-form");
  if (!form) return;

  const shell = form.closest(".probe-shell");
  const isCompact = shell?.dataset.compact === "true";
  const handoffPath = shell?.dataset.handoffPath || "/port-checker/";
  const targetInput = document.getElementById("target");
  const portInput = document.getElementById("port");
  const tokenInput = document.getElementById("turnstileToken");
  const submitBtn = form.querySelector(".probe-submit");
  const statusNode = document.getElementById("probe-status");
  const statusAction = document.getElementById("probe-status-action");
  const resultBadge = document.getElementById("result-status-badge");
  const statusDot = document.getElementById("result-status-dot");
  const resultLatency = document.getElementById("result-latency");
  const resultExplanation = document.getElementById("result-explanation");
  const resultVantage = document.getElementById("result-vantage");
  const resultAddress = document.getElementById("result-address");
  const resultCheckType = document.getElementById("result-check-type");
  const resultService = document.getElementById("result-service");
  const resultModules = document.getElementById("result-modules");
  const commandCurl = document.getElementById("command-curl");
  const commandCli = document.getElementById("command-cli");
  const commandPowershell = document.getElementById("command-powershell");
  const commandTelnet = document.getElementById("command-telnet");
  const commandPython = document.getElementById("command-python");
  const commandNode = document.getElementById("command-node");
  const commandGo = document.getElementById("command-go");
  const commandRuby = document.getElementById("command-ruby");
  const commandPhp = document.getElementById("command-php");
  const loadingPanel = document.getElementById("probe-loading");
  const logNode = document.getElementById("probe-log");
  const resultPanel = document.getElementById("probe-result");
  const historyToggle = shell ? shell.querySelector("[data-history-toggle]") : null;
  const historyPanel = document.getElementById("probe-history-panel");
  const useIpBtn = shell ? shell.querySelector("[data-use-ip]") : null;
  const turnstileContainer = document.getElementById("probe-turnstile-container");
  const presetTrigger = document.getElementById("probe-preset-trigger");
  const presetPanel = document.getElementById("probe-preset-panel");
  const presetSearch = document.getElementById("probe-preset-search");
  const presetClose = document.getElementById("probe-preset-close");
  const presetCategoriesEl = document.getElementById("probe-preset-categories");
  const presetListEl = document.getElementById("probe-preset-list");
  const presetCountEl = document.getElementById("probe-preset-count");
  const presetDataEl = document.getElementById("probe-preset-data");
  const presetCategories = presetDataEl ? JSON.parse(presetDataEl.textContent) : [];

  const serviceNames = {
    22: "SSH", 80: "HTTP", 443: "HTTPS", 3389: "RDP",
    5432: "Postgres", 25565: "Minecraft", 8080: "HTTP", 8443: "HTTPS"
  };

  const readyToRunPresentation2 = {
    badge: "Ready to run",
    dotStatus: "open",
    latency: "n/a",
    explanation: "Enter a target and hit Check to run the live connectivity probe.",
    vantage: "Cloudflare edge",
    address: "No result yet",
    checkType: "Live check",
    service: "Pending",
    modules: "TCP, DNS, HTTP, IP"
  };

  const compactPreviewPresentation = {
    badge: "Start on the full checker",
    dotStatus: "open",
    latency: "n/a",
    explanation: "Open the dedicated checker page to verify and run the live request.",
    vantage: "Cloudflare edge",
    address: "No result yet",
    checkType: "Live check",
    service: "Pending",
    modules: "TCP, DNS, HTTP, IP"
  };

  const unavailablePresentation = {
    badge: "Unavailable",
    dotStatus: "closed",
    latency: "n/a",
    explanation: "Live website checks are temporarily unavailable.",
    vantage: "Cloudflare edge",
    address: "No result yet",
    checkType: "Live check",
    service: "Pending",
    modules: "TCP, DNS, HTTP, IP"
  };

  const verificationFailedPresentation = {
    badge: "Retry needed",
    dotStatus: "timeout",
    latency: "n/a",
    explanation: "Security verification failed. Click Check again to retry.",
    vantage: "Cloudflare edge",
    address: "No result yet",
    checkType: "Live check",
    service: "Pending",
    modules: "TCP, DNS, HTTP, IP"
  };

  let turnstileWidgetId = null;
  let turnstileReadyPromise = null;

  function setPresentation(presentation) {
    resultBadge.textContent = presentation.badge;
    statusDot.dataset.status = presentation.dotStatus;
    resultLatency.textContent = presentation.latency;
    resultExplanation.textContent = presentation.explanation;
    if (resultVantage) resultVantage.textContent = presentation.vantage;
    resultAddress.textContent = presentation.address;
    resultCheckType.textContent = presentation.checkType;
    resultService.textContent = presentation.service;
    if (resultModules) resultModules.textContent = presentation.modules;
  }

  function buildHandoffUrl() {
    const url = new URL(handoffPath, window.location.origin);
    const target = targetInput && targetInput.value ? targetInput.value.trim() : "";
    const port = portInput && portInput.value ? portInput.value.trim() : "";

    if (target) url.searchParams.set("target", target);
    if (port) url.searchParams.set("port", port);

    return url.toString();
  }

  function navigateToFullChecker() {
    window.location.href = buildHandoffUrl();
  }

  function setStatusAction(mode) {
    if (!statusAction) return;

    if (mode === "hidden") {
      statusAction.hidden = true;
      return;
    }

    statusAction.hidden = false;
    statusAction.textContent =
      mode === "retry" ? "Try again" :
      mode === "start" ? "Start checking" :
      "Run check";
  }

  function formatModules(modules) {
    return Array.isArray(modules) && modules.length > 0
      ? modules.map((moduleName) => String(moduleName).toUpperCase()).join(", ")
      : "TCP";
  }

  function formatVantage(label) {
    if (!label) return "Cloudflare edge";

    return label
      .replace(/^Canonical Cloudflare vantage near /i, "Cloudflare edge near ")
      .replace(/^Canonical Cloudflare vantage/i, "Cloudflare edge")
      .trim();
  }

  function waitForTurnstile() {
    if (window.turnstile && typeof window.turnstile.render === "function") {
      return Promise.resolve(window.turnstile);
    }

    if (!turnstileReadyPromise) {
      turnstileReadyPromise = new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const interval = window.setInterval(() => {
          if (window.turnstile && typeof window.turnstile.render === "function") {
            window.clearInterval(interval);
            resolve(window.turnstile);
            return;
          }

          if (Date.now() - startedAt > 8000) {
            window.clearInterval(interval);
            reject(new Error("Turnstile failed to load."));
          }
        }, 120);
      });
    }

    return turnstileReadyPromise;
  }

  async function ensureTurnstileWidget() {
    if (!turnstileContainer) return null;

    const turnstile = await waitForTurnstile();

    if (turnstileWidgetId !== null) {
      return turnstile;
    }

    turnstileWidgetId = turnstile.render("#probe-turnstile-container", {
      sitekey: turnstileContainer.dataset.sitekey,
      action: "probe",
      size: "invisible",
      callback(token) {
        tokenInput.value = token;
      },
      "expired-callback"() {
        tokenInput.value = "";
      },
      "error-callback"() {
        tokenInput.value = "";
      }
    });

    return turnstile;
  }

  async function obtainToken() {
    try {
      await ensureTurnstileWidget();
      if (turnstileWidgetId !== null && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId);
      }
      // Wait for the invisible challenge to resolve
      const start = Date.now();
      while (!tokenInput.value && Date.now() - start < 12000) {
        await new Promise(r => setTimeout(r, 150));
      }
      return !!tokenInput.value;
    } catch (e) {
      return false;
    }
  }

  function clearVerificationToken() {
    tokenInput.value = "";
    if (turnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  function derivePresentation(body, portValue) {
    const tcp = body && body.results ? body.results.tcp : null;
    const http = body && body.results ? body.results.http : null;
    const dns = body && body.results ? body.results.dns : null;
    const ip = body && body.results ? body.results.ip : null;
    const resolved = (body && body.resolvedAddresses && body.resolvedAddresses[0]) || (ip && ip.ip) || "No public IP";
    const vantage = formatVantage(body && body.vantage && body.vantage.label);
    const modules = formatModules(body && body.modules);

    if (tcp) {
      return {
        badge: tcp.status === "open" ? "Open" : tcp.status === "closed" ? "Closed" : "Timeout",
        dotStatus: tcp.status,
        latency: tcp.latencyMs + " ms",
        explanation: tcp.explanation,
        vantage,
        address: resolved,
        checkType: "Port check",
        service: serviceNames[portValue] || ("Port " + portValue),
        modules
      };
    }

    if (http) {
      return {
        badge: http.status === "ok" ? ("HTTP " + (http.statusCode || "")).trim() : http.status === "timeout" ? "HTTP timeout" : "HTTP failed",
        dotStatus: http.status === "timeout" ? "timeout" : http.ok ? "open" : "closed",
        latency: http.latencyMs ? (http.latencyMs + " ms") : "n/a",
        explanation:
          http.status === "ok"
            ? "HTTP " + (http.statusCode || "response") + " received from " + (http.finalUrl || http.url) + "."
            : http.status === "timeout"
              ? "The HTTP request timed out before the endpoint responded."
              : "The HTTP request could not be completed from the probe vantage.",
        vantage,
        address: resolved,
        checkType: "Website check",
        service: http.scheme.toUpperCase(),
        modules
      };
    }

    if (dns) {
      const recordCount =
        dns.records.a.length +
        dns.records.aaaa.length +
        dns.records.cname.length +
        dns.records.mx.length +
        dns.records.ns.length +
        dns.records.txt.length;

      return {
        badge: "Resolved",
        dotStatus: "open",
        latency: "n/a",
        explanation:
          recordCount > 0
            ? "Resolved " + recordCount + " DNS records for " + ((body.normalized && body.normalized.hostname) || body.target) + "."
            : "DNS lookup completed, but no public records were returned.",
        vantage,
        address: resolved,
        checkType: "DNS lookup",
        service: "DNS records",
        modules
      };
    }

    return {
      badge: "Checked",
      dotStatus: "open",
      latency: "n/a",
      explanation: "The connectivity check completed.",
      vantage,
      address: resolved,
      checkType: "IP lookup",
      service: (ip && ip.ipVersion) || "Connectivity",
      modules
    };
  }

  function appendLog(line, variant) {
    if (!logNode) return;
    const span = document.createElement("span");
    if (variant) span.className = "log-" + variant;
    span.textContent = line + "\n";
    logNode.appendChild(span);
    logNode.parentElement.scrollTop = logNode.parentElement.scrollHeight;
  }

  function resetLog() {
    if (logNode) logNode.textContent = "";
  }

  function showLoading() {
    if (loadingPanel) loadingPanel.hidden = false;
  }

  function hideLoading() {
    if (loadingPanel) loadingPanel.hidden = true;
  }

  async function streamLogLines(target, port) {
    const portLabel = port ? ":" + port : " (no port)";
    const lines = [
      { t: 100, text: "$ probe " + target + portLabel, v: "cmd" },
      { t: 220, text: "[edge] Resolving " + target + "...", v: "info" },
      { t: 420, text: "[edge] Selecting nearest Cloudflare vantage...", v: "info" },
      { t: 640, text: port ? "[edge] Dialing " + target + ":" + port + "..." : "[edge] Probing DNS + HTTP modules...", v: "info" },
    ];
    for (const line of lines) {
      await new Promise((r) => setTimeout(r, line.t));
      appendLog(line.text, line.v);
    }
  }

  // Port pill clicks
  document.querySelectorAll("[data-port]").forEach((button) => {
    button.addEventListener("click", () => {
      portInput.value = button.dataset.port || "";
      portInput.focus();
      button.classList.add("is-pressed");
      setTimeout(() => button.classList.remove("is-pressed"), 220);
    });
  });

  // Use my IP
  if (useIpBtn) {
    useIpBtn.addEventListener("click", async () => {
      const labelEl = useIpBtn.querySelector(".probe-chip-label");
      const original = labelEl ? labelEl.textContent : "Use my IP";
      useIpBtn.disabled = true;
      if (labelEl) labelEl.textContent = "Fetching...";
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        const body = await r.json();
        if (body && body.ip && targetInput) {
          targetInput.value = body.ip;
          if (labelEl) labelEl.textContent = "Filled";
        }
      } catch (e) {
        if (labelEl) labelEl.textContent = "Failed";
      } finally {
        setTimeout(() => {
          if (labelEl) labelEl.textContent = original;
          useIpBtn.disabled = false;
        }, 1400);
      }
    });
  }

  if (statusAction) {
    statusAction.addEventListener("click", () => {
      if (isCompact) {
        navigateToFullChecker();
        return;
      }
      form.requestSubmit();
    });
  }



  // History toggle
  if (historyToggle && historyPanel) {
    historyToggle.addEventListener("click", () => {
      const open = historyPanel.hidden;
      historyPanel.hidden = !open;
      historyToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Copy buttons
  document.querySelectorAll(".probe-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.dataset.copyTarget;
      const field = targetId ? document.getElementById(targetId) : null;
      if (!field) return;
      try {
        await navigator.clipboard.writeText(field.value);
        const prev = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
        setTimeout(() => {
          btn.textContent = prev;
          btn.classList.remove("is-copied");
        }, 1200);
      } catch (e) {
        btn.textContent = "Ctrl+C";
      }
    });
  });

  function resetToVerificationState(message) {
    if (isCompact) {
      setPresentation(compactPreviewPresentation);
      if (statusNode) statusNode.textContent = "Canonical flow";
      setStatusAction("start");
      return;
    }

    clearVerificationToken();
    setPresentation(verificationFailedPresentation);
    setStatusAction("retry");
    if (statusNode) statusNode.textContent = message || "Click Check to try again.";
  }

  if (isCompact) {
    setPresentation(compactPreviewPresentation);
    if (statusNode) statusNode.textContent = "Canonical flow";
    if (statusAction) statusAction.hidden = false;
    setStatusAction("start");
  } else {
    setPresentation(readyToRunPresentation2);
    setStatusAction("hidden");
    if (statusNode) statusNode.textContent = "Ready";

    const searchParams = new URL(window.location.href).searchParams;
    const presetTarget = searchParams.get("target");
    const presetPort = searchParams.get("port");

    if (presetTarget && targetInput && !targetInput.value) {
      targetInput.value = presetTarget;
    }

    if (presetPort && portInput && !portInput.value) {
      portInput.value = presetPort;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isCompact) {
      navigateToFullChecker();
      return;
    }

    if (!tokenInput.value) {
      submitBtn.classList.add("is-loading");
      if (statusNode) statusNode.textContent = "Verifying…";
      const ok = await obtainToken();
      if (!ok) {
        submitBtn.classList.remove("is-loading");
        resetToVerificationState("Verification could not complete. Try again.");
        return;
      }
    }

    const target = targetInput.value.trim();
    const rawPort = portInput.value.trim();
    const port = rawPort ? Number(rawPort) : undefined;
    const payload = {
      target,
      timeoutMs: 3000,
      turnstileToken: tokenInput.value
    };

    if (typeof port === "number" && Number.isFinite(port)) {
      payload.port = port;
    } else if (/[a-z]/i.test(target)) {
      payload.http = { scheme: "https", method: "HEAD" };
    }

    // Reveal full result section on first check
    if (resultPanel) resultPanel.classList.remove("is-initial");
    if (statusAction) statusAction.hidden = false;

    submitBtn.classList.add("is-loading");
    if (statusNode) statusNode.textContent = "Running connectivity check…";
    resetLog();
    showLoading();
    const logPromise = streamLogLines(target, port);

    try {
      const response = await fetch("/api/check/web", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const body = await response.json();
      await logPromise;

      if (!response.ok) {
        appendLog("[edge] ✗ " + ((body && body.error && body.error.message) || "check failed"), "err");
        const errorCode = body && body.error && body.error.code;

        if (errorCode === "turnstile_invalid") {
          resetToVerificationState("Verification expired. Complete it again.");
          return;
        }

        if (errorCode === "configuration_error") {
          clearVerificationToken();
          setPresentation(unavailablePresentation);
          if (statusNode) statusNode.textContent = "Website checks are temporarily unavailable.";
          setStatusAction("hidden");
          return;
        }

        clearVerificationToken();
        if (statusNode) statusNode.textContent = "The check could not be completed.";
        return;
      }

      const presentation = derivePresentation(body, port);
      appendLog("[edge] ✓ " + presentation.badge + " — " + presentation.latency, "ok");
      appendLog("$ done", "cmd");

      await new Promise((r) => setTimeout(r, 420));

      setPresentation(presentation);
      if (statusNode) statusNode.textContent = "Checked just now";
      setStatusAction("hidden");
      clearVerificationToken();

      if (commandCurl) {
        commandCurl.value =
          (body && body.commands && body.commands.tcp && body.commands.tcp.curl) ||
          (body && body.commands && body.commands.http && body.commands.http.curl) ||
          ("dig +short " + target);
      }
      if (commandCli) {
        commandCli.value =
          (body && body.commands && body.commands.tcp && body.commands.tcp.netcat) ||
          ("dig +short " + target);
      }
      if (commandPowershell) {
        commandPowershell.value =
          (body && body.commands && body.commands.tcp && body.commands.tcp.powershell) ||
          (body && body.commands && body.commands.http && body.commands.http.powershell) ||
          ("Resolve-DnsName -Name " + target);
      }
      if (commandTelnet && port) commandTelnet.value = "telnet " + target + " " + port;
      if (commandPython && port) commandPython.value = "python -c \"import socket; socket.create_connection(('" + target + "', " + port + "), timeout=5)\"";
      if (commandNode && port) commandNode.value = "node -e \"require('net').createConnection({host:'" + target + "',port:" + port + ",timeout:5000},()=>console.log('open')).on('error',e=>console.log(e.code))\"";
      if (commandGo && port) commandGo.value = "conn, err := net.DialTimeout(\"tcp\", \"" + target + ":" + port + "\", 5*time.Second)\nif err != nil { fmt.Println(err); return }\nconn.Close()";
      if (commandRuby && port) commandRuby.value = "ruby -rsocket -e \"TCPSocket.new('" + target + "', " + port + ").close; puts 'open'\"";
      if (commandPhp && port) commandPhp.value = "php -r '$s=@fsockopen(\"" + target + "\", " + port + ", $errno, $errstr, 5);\nif($s){fclose($s); echo \"open\\\\n\";} else {fwrite(STDERR, \"$errstr\\\\n\"); exit(1);}'";

      hideLoading();
    } catch (error) {
      await logPromise.catch(() => {});
      appendLog("[edge] ✗ network error: could not reach Kordu Probe", "err");
      clearVerificationToken();
      if (statusNode) statusNode.textContent = "The request failed before the check completed.";
      console.error(error);
    } finally {
      submitBtn.classList.remove("is-loading");
    }
  });

  // ─── Preset selector ───────────────────────────────────────
  let activeCategory = null;

  function flattenPresets(cats, filter) {
    const q = (filter || "").toLowerCase();
    const out = [];
    for (const cat of cats) {
      for (const item of cat.items) {
        if (!q || item.name.toLowerCase().includes(q) || String(item.port).includes(q) || cat.label.toLowerCase().includes(q)) {
          out.push({ ...item, category: cat.label, categoryId: cat.id });
        }
      }
    }
    return out;
  }

  function renderPresetCategories(cats, active) {
    if (!presetCategoriesEl) return;
    presetCategoriesEl.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "probe-preset-cat" + (!active ? " is-active" : "");
    allBtn.textContent = "All";
    allBtn.addEventListener("click", () => { activeCategory = null; renderPresets(); });
    presetCategoriesEl.appendChild(allBtn);
    for (const cat of cats) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "probe-preset-cat" + (active === cat.id ? " is-active" : "");
      btn.textContent = cat.label;
      btn.addEventListener("click", () => { activeCategory = cat.id; renderPresets(); });
      presetCategoriesEl.appendChild(btn);
    }
  }

  function renderPresets() {
    if (!presetListEl) return;
    const q = presetSearch ? presetSearch.value : "";
    let filtered = flattenPresets(presetCategories, q);
    if (activeCategory) filtered = filtered.filter(p => p.categoryId === activeCategory);
    renderPresetCategories(presetCategories, activeCategory);

    presetListEl.innerHTML = "";
    const maxVisible = 60;
    const visible = filtered.slice(0, maxVisible);
    for (const item of visible) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "probe-preset-item";
      row.innerHTML = '<span class="probe-preset-name">' + item.name + '</span>' +
        '<span class="probe-preset-port">' + item.port + '</span>' +
        '<span class="probe-preset-proto">' + item.proto + '</span>';
      row.addEventListener("click", () => {
        if (portInput) portInput.value = item.port;
        closePresets();
      });
      presetListEl.appendChild(row);
    }

    if (presetCountEl) {
      presetCountEl.textContent = filtered.length + " preset" + (filtered.length !== 1 ? "s" : "") + (filtered.length > maxVisible ? " · showing first " + maxVisible : "");
    }
  }

  function openPresets() {
    if (!presetPanel) return;
    presetPanel.hidden = false;
    if (presetTrigger) presetTrigger.setAttribute("aria-expanded", "true");
    renderPresets();
    if (presetSearch) { presetSearch.value = ""; presetSearch.focus(); }
  }

  function closePresets() {
    if (!presetPanel) return;
    presetPanel.hidden = true;
    if (presetTrigger) presetTrigger.setAttribute("aria-expanded", "false");
    activeCategory = null;
  }

  if (presetTrigger) presetTrigger.addEventListener("click", () => presetPanel && !presetPanel.hidden ? closePresets() : openPresets());
  if (presetClose) presetClose.addEventListener("click", closePresets);
  if (presetSearch) presetSearch.addEventListener("input", renderPresets);

  // Close preset panel on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && presetPanel && !presetPanel.hidden) closePresets();
  });

  // Pre-warm invisible Turnstile on page load (non-compact only)
  if (!isCompact) {
    ensureTurnstileWidget().catch(() => {});
  }
})();

