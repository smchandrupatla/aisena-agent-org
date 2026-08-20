// Client-side SDLC plan generator for the "Start a Project" intake wizard.
// Everything runs in the browser and maps answers to the real /agents roster.

const ENGINEERING_MAP = {
  web: { label: "Web / UI implementation", agent: "Frontend Engineer / Frontend GUI Developer" },
  mobile: { label: "Mobile client implementation (iOS & Android)", agent: "Mobile App Engineer" },
  api: { label: "Backend services and APIs", agent: "Backend Engineer" },
  data: { label: "Data pipeline, storage, and reporting", agent: "Data Architecture & Database SME / Database Engineer" },
  desktop: { label: "Local / desktop tooling", agent: "Backend Engineer with Infrastructure/Platform Engineer support" },
};

const APP_TYPE_LABELS = {
  web: "Website / Web App",
  mobile: "Mobile App",
  api: "Backend Service / API",
  data: "Data & Analytics Pipeline",
  desktop: "Desktop / Local Tool",
};

const DEPLOY_LABELS = {
  local: "Local only",
  cloud: "Cloud only",
  hybrid: "Hybrid (local + cloud)",
};

function collectFormData() {
  const name = document.getElementById("projectName").value.trim() || "Untitled Project";
  const githubRepoName = document.getElementById("githubRepoName").value.trim() || slugify(name);
  const domain = document.getElementById("projectDomain").value.trim() || "general business";
  const description = document.getElementById("projectDescription").value.trim();
  const constraints = document.getElementById("projectConstraints").value.trim();
  const appTypes = Array.from(document.querySelectorAll('input[name="appType"]:checked')).map((el) => el.value);
  const deployTarget = (document.querySelector('input[name="deployTarget"]:checked') || {}).value || "local";
  const uploadedFile = window._uploadedProjectFile || null;
  return { name, githubRepoName, domain, description, constraints, appTypes, deployTarget, uploadedFile };
}

function initFileUpload() {
  const fileInput = document.getElementById("projectFile");
  const uploadArea = document.getElementById("fileUploadArea");
  const fileInfo = document.getElementById("fileInfo");
  const uploadLabel = document.getElementById("fileUploadLabel");

  if (!fileInput || !uploadArea) {
    return;
  }

  uploadArea.addEventListener("click", () => {
    fileInput.click();
  });

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  function handleFileSelect(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      fileInfo.style.display = "block";
      fileInfo.innerHTML = `<span class="file-error">File too large. Maximum size is 5MB.</span>`;
      window._uploadedProjectFile = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      window._uploadedProjectFile = {
        name: file.name,
        type: file.type,
        size: file.size,
        content: content,
      };

      const sizeStr = file.size < 1024
        ? `${file.size} B`
        : file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      fileInfo.style.display = "block";
      fileInfo.innerHTML = `
        <div class="file-selected">
          <span class="file-name">${file.name}</span>
          <span class="file-size">${sizeStr}</span>
          <button type="button" id="removeFile" class="ghost" style="margin-left: 8px; font-size: 11px; padding: 3px 8px;">✕</button>
        </div>
      `;

      uploadLabel.style.display = "none";

      const removeBtn = document.getElementById("removeFile");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          window._uploadedProjectFile = null;
          fileInfo.style.display = "none";
          uploadLabel.style.display = "block";
          fileInput.value = "";
        });
      }
    };
    reader.readAsText(file);
  }
}

function parseUploadedFile(fileData) {
  if (!fileData) {
    return null;
  }

  const ext = fileData.name.split(".").pop().toLowerCase();
  const content = fileData.content;

  try {
    if (ext === "json") {
      return JSON.parse(content);
    }
    if (ext === "yaml" || ext === "yml") {
      // Simple YAML parsing for basic key-value pairs
      const result = {};
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes(":")) {
          const [key, ...valueParts] = trimmed.split(":");
          const value = valueParts.join(":").trim();
          result[key.trim()] = value;
        }
      }
      return result;
    }
    // For .md and .txt, return as plain text
    return { content: content };
  } catch (e) {
    console.error("Failed to parse uploaded file:", e);
    return { content: content, parseError: e.message };
  }
}

function deployAgents(target) {
  if (target === "cloud") {
    return ["Cloud & AWS SME", "DevOps/Release Engineer", "Infrastructure/Platform Engineer"];
  }
  if (target === "hybrid") {
    return ["Infrastructure/Platform Engineer", "Cloud & AWS SME", "DevOps/Release Engineer"];
  }
  return ["Infrastructure/Platform Engineer", "DevOps/Release Engineer"];
}

function deployDetail(target) {
  if (target === "cloud") {
    return "Provision managed cloud infrastructure (containers, managed DB/search, IAM-scoped secrets) and automate release via CI/CD.";
  }
  if (target === "hybrid") {
    return "Prove the flow locally with Docker Compose or Minikube first, then promote the same containers/Helm charts to cloud infrastructure.";
  }
  return "Run the stack locally with Docker Compose or Minikube; document the path to cloud if needed later.";
}

function buildPhases(data) {
  const engineeringLines = data.appTypes.map((t) => ENGINEERING_MAP[t]).filter(Boolean);
  const apiOnly = data.appTypes.length === 1 && data.appTypes[0] === "api";

  return [
    {
      title: "Discovery & Requirements",
      agents: ["Domain Analyst", "Business Analyst", "Implementation Manager"],
      detail: `Capture the ${data.domain} problem statement, actors, and success measures, and turn "${data.description || "the goal you described"}" into user stories and acceptance criteria.`,
    },
    {
      title: "UX & Product Design",
      agents: apiOnly ? ["Solution Architect"] : ["UI/UX Designer", "Case Management & UX SME (if workflow-driven)"],
      detail: apiOnly
        ? "API-only scope: design request/response contracts and developer-facing documentation instead of screen UX."
        : "Design user flows, wireframes, and the interaction model across the selected application types.",
    },
    {
      title: "Architecture & Technology Selection",
      agents: ["Solution Architect", "Implementation Pattern Specialist"],
      detail: "Define component boundaries, data flow, integration contracts, and reusable implementation patterns suited to this domain.",
    },
    {
      title: "Engineering & Build",
      agents: engineeringLines.length ? engineeringLines.map((e) => e.agent) : ["Backend Engineer"],
      detail: engineeringLines.length
        ? engineeringLines.map((e) => e.label).join("; ")
        : "Select at least one application type above to see specific build guidance.",
    },
    {
      title: "Quality Assurance",
      agents: ["QA Engineer", "Test Automation Engineer", "Performance Engineer"],
      detail: "Automated test coverage, functional validation, and performance/load checks appropriate to the selected platforms.",
    },
    {
      title: "Security & Compliance",
      agents: ["Security Engineer", "Security & Compliance Engineer", "Security & Identity SME"],
      detail: `Threat review, access control, secrets handling, and any domain-specific compliance checks${data.constraints ? ` (noted constraints: ${data.constraints})` : ""}.`,
    },
    {
      title: "DevOps, Release & Deployment",
      agents: deployAgents(data.deployTarget),
      detail: deployDetail(data.deployTarget),
    },
    {
      title: "Documentation & Handoff",
      agents: ["Documentation Engineer", "Technical Writer"],
      detail: "Runbooks, API docs, architecture docs, and onboarding material for maintainers.",
    },
    {
      title: "Release & Ongoing Operations",
      agents: ["Release Manager", "Product Owner"],
      detail: "Release packaging, rollback plan, and backlog grooming for the next incremental delivery stage.",
    },
  ];
}

function buildDeploymentTracks(data) {
  const tracks = [];
  if (data.deployTarget === "local" || data.deployTarget === "hybrid") {
    tracks.push({
      title: "Local Deployment",
      detail: "docker compose up (see /infra) or Minikube for Kubernetes-shaped local proofs. Good for fast iteration, demos, and offline environments.",
    });
  }
  if (data.deployTarget === "cloud" || data.deployTarget === "hybrid") {
    tracks.push({
      title: "Cloud Deployment",
      detail: "Container registry plus managed Kubernetes or PaaS, managed database/search, IAM-scoped secrets, and a CI/CD promotion pipeline.",
    });
  }
  if (data.appTypes.includes("mobile")) {
    tracks.push({
      title: "Mobile Distribution",
      detail: "Cross-platform build (React Native or Flutter), emulator/simulator validation, then app store or enterprise distribution via the Release Manager.",
    });
  }
  return tracks;
}

function buildBacklog(data) {
  let n = 0;
  const pad = () => String((n += 1)).padStart(3, "0");
  const epics = [
    { id: `EPIC-${pad()}`, desc: `${data.domain} discovery and requirements capture`, agent: "Domain Analyst" },
    { id: `EPIC-${pad()}`, desc: `Architecture and technology selection for ${data.name}`, agent: "Solution Architect" },
  ];
  data.appTypes.forEach((t) => {
    const map = ENGINEERING_MAP[t];
    epics.push({
      id: `EPIC-${pad()}`,
      desc: `${map ? map.label : APP_TYPE_LABELS[t] || t} for ${data.domain}`,
      agent: map ? map.agent : "Backend Engineer",
    });
  });
  epics.push({ id: `EPIC-${pad()}`, desc: "Automated test coverage and quality hardening", agent: "QA Engineer" });
  epics.push({ id: `EPIC-${pad()}`, desc: "Security review and compliance checks", agent: "Security Engineer" });
  epics.push({ id: `EPIC-${pad()}`, desc: `Deployment readiness (${DEPLOY_LABELS[data.deployTarget]})`, agent: "DevOps/Release Engineer" });
  epics.push({ id: `EPIC-${pad()}`, desc: "Documentation and release handoff", agent: "Documentation Engineer" });
  return epics;
}

function renderPlan(data, phases, tracks, epics) {
  document.getElementById("planTitle").textContent = `Delivery Plan — ${data.name}`;

  const pillsRoot = document.getElementById("planSummaryPills");
  const typePills = data.appTypes.length
    ? data.appTypes.map((t) => `<span class="pill">${APP_TYPE_LABELS[t] || t}</span>`).join("")
    : `<span class="pill">No application type selected</span>`;
  pillsRoot.innerHTML = `<span class="pill">${data.domain}</span>${typePills}<span class="pill">${DEPLOY_LABELS[data.deployTarget]}</span>`;

  const phasesRoot = document.getElementById("planPhases");
  phasesRoot.innerHTML = phases
    .map(
      (phase, i) => `
      <div class="plan-phase">
        <h4><span class="phase-index">Phase ${i + 1}</span>${phase.title}</h4>
        <p>${phase.detail}</p>
        <div class="pill-list">${phase.agents.map((a) => `<span class="pill">${a}</span>`).join("")}</div>
      </div>`
    )
    .join("");

  const tracksRoot = document.getElementById("deploymentTracks");
  tracksRoot.innerHTML = tracks
    .map((t) => `<div class="deploy-track"><h4>${t.title}</h4><p>${t.detail}</p></div>`)
    .join("");

  const backlogRoot = document.getElementById("backlogRows");
  backlogRoot.innerHTML = epics
    .map((e) => `<tr><td>${e.id}</td><td>${e.desc}</td><td>${e.agent}</td></tr>`)
    .join("");

  document.getElementById("planOutput").classList.add("visible");
}

function buildBriefText(data, phases, tracks, epics) {
  const lines = [];
  lines.push(`# Project Brief — ${data.name}`);
  lines.push("");
  lines.push(`**GitHub repository:** ${data.githubRepoName || slugify(data.name)}`);
  lines.push(`**Domain:** ${data.domain}`);
  lines.push(`**Application type(s):** ${data.appTypes.map((t) => APP_TYPE_LABELS[t] || t).join(", ") || "Not specified"}`);
  lines.push(`**Deployment target:** ${DEPLOY_LABELS[data.deployTarget]}`);
  if (data.uploadedFile) {
    lines.push(`**Uploaded file:** ${data.uploadedFile.name} (${(data.uploadedFile.size / 1024).toFixed(1)} KB)`);
  }
  lines.push("");
  lines.push(`## Description`);
  lines.push(data.description || "(no description provided)");
  if (data.constraints) {
    lines.push("");
    lines.push(`## Constraints / Notes`);
    lines.push(data.constraints);
  }
  lines.push("");
  lines.push(`## SDLC Delivery Plan`);
  phases.forEach((phase, i) => {
    lines.push(`${i + 1}. **${phase.title}** — ${phase.agents.join(", ")}`);
    lines.push(`   ${phase.detail}`);
  });
  lines.push("");
  lines.push(`## Deployment Path`);
  tracks.forEach((t) => {
    lines.push(`- **${t.title}:** ${t.detail}`);
  });
  lines.push("");
  lines.push(`## Starter Backlog`);
  epics.forEach((e) => {
    lines.push(`- ${e.id}: ${e.desc} (owner: ${e.agent})`);
  });
  lines.push("");
  lines.push(`_Generated by the AISENA "Start a Project" intake wizard._`);
  return lines.join("\n");
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "project"
  );
}

function getChatKey(agentKey) {
  return `agent-chat-${agentKey}`;
}

function inferProjectSuggestion(prompt) {
  const normalized = prompt.trim();
  const lower = normalized.toLowerCase();
  const name = normalized.replace(/^(build|create|make|develop|i want|we need)\s+(an?\s+|a\s+)?/i, "").replace(/[.!?]+$/, "").trim() || "New AI Application";
  const domain = lower.match(/health|clinic|medical/) ? "healthcare" : lower.match(/food|restaurant|delivery|shop|retail/) ? "retail and logistics" : lower.match(/finance|payment|bank|invoice/) ? "fintech" : lower.match(/school|learn|course|student/) ? "education" : "general business";
  const appTypes = [];
  if (lower.match(/mobile|ios|android/)) appTypes.push("mobile");
  if (lower.match(/api|backend|service/)) appTypes.push("api");
  if (lower.match(/data|analytics|report|pipeline/)) appTypes.push("data");
  if (!appTypes.length || lower.match(/web|website|dashboard|portal/)) appTypes.unshift("web");
  return { name: name.charAt(0).toUpperCase() + name.slice(1), githubRepoName: slugify(name), domain, description: normalized, appTypes: [...new Set(appTypes)], deployTarget: lower.match(/cloud|aws|azure|gcp/) ? "cloud" : lower.match(/hybrid/) ? "hybrid" : "local" };
}

function initProjectAiAssistant() {
  const input = document.getElementById("projectAiInput");
  const messages = document.getElementById("projectAiMessages");
  const sendButton = document.getElementById("sendProjectAi");
  const applyButton = document.getElementById("applyProjectAi");
  const fillButton = document.getElementById("aiFillForm");
  const panel = document.querySelector(".ai-chat-panel");
  if (!input || !messages || !sendButton || !applyButton || !panel) return;
  let suggestion = null;
  const ask = () => {
    if (!input.value.trim()) return;
    suggestion = inferProjectSuggestion(input.value);
    messages.innerHTML = `<div class="msg user">${input.value.trim()}</div><div class="msg assistant"><strong>Suggested setup</strong><br>Project: ${suggestion.name}<br>GitHub repository: ${suggestion.githubRepoName}<br>Domain: ${suggestion.domain}<br>App type: ${suggestion.appTypes.map((type) => APP_TYPE_LABELS[type]).join(", ")}<br>Deployment: ${DEPLOY_LABELS[suggestion.deployTarget]}<br><br>Review these values, then apply them to the form.</div>`;
    applyButton.disabled = false;
  };
  const apply = () => {
    if (!suggestion) return;
    document.getElementById("projectName").value = suggestion.name;
    document.getElementById("githubRepoName").value = suggestion.githubRepoName;
    document.getElementById("projectDomain").value = suggestion.domain;
    document.getElementById("projectDescription").value = suggestion.description;
    document.querySelectorAll('input[name="appType"]').forEach((field) => { field.checked = suggestion.appTypes.includes(field.value); });
    const deploy = document.querySelector(`input[name="deployTarget"][value="${suggestion.deployTarget}"]`);
    if (deploy) deploy.checked = true;
    messages.insertAdjacentHTML("beforeend", `<div class="msg system">Applied. Check the form and generate your delivery plan when you are happy.</div>`);
  };
  sendButton.addEventListener("click", ask);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(); } });
  applyButton.addEventListener("click", apply);
  if (fillButton) fillButton.addEventListener("click", () => panel.scrollIntoView({ behavior: "smooth", block: "center" }));
}

function seedImplementationManagerChat(briefText) {
  const key = getChatKey("implementation-manager");
  const messages = [
    { role: "system", text: "Implementation Manager ready. Reviewing the incoming project brief." },
    { role: "user", text: briefText },
  ];
  localStorage.setItem(key, JSON.stringify(messages));
}

function initStartProjectPage() {
  const form = document.getElementById("projectForm");
  if (!form) {
    return;
  }

  let lastBrief = "";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = collectFormData();

    // Parse uploaded file if present and merge into form data
    if (data.uploadedFile) {
      const parsed = parseUploadedFile(data.uploadedFile);
      if (parsed) {
        // Merge parsed file data into form data
        if (parsed.name && !data.name || data.name === "Untitled Project") {
          data.name = parsed.name;
        }
        if (parsed.domain && !data.domain || data.domain === "general business") {
          data.domain = parsed.domain;
        }
        if (parsed.description && !data.description) {
          data.description = parsed.description;
        }
        if (parsed.constraints && !data.constraints) {
          data.constraints = parsed.constraints;
        }
        if (Array.isArray(parsed.appTypes) && parsed.appTypes.length > 0) {
          data.appTypes = parsed.appTypes;
        }
        if (parsed.deployTarget && ["local", "cloud", "hybrid"].includes(parsed.deployTarget)) {
          data.deployTarget = parsed.deployTarget;
        }
        // Store raw parsed content for reference
        data.parsedFileContent = parsed;
      }
    }

    const phases = buildPhases(data);
    const tracks = buildDeploymentTracks(data);
    const epics = buildBacklog(data);
    renderPlan(data, phases, tracks, epics);
    lastBrief = buildBriefText(data, phases, tracks, epics);
    document.getElementById("briefPreview").textContent = lastBrief;
    document.getElementById("planOutput").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("reset", () => {
    document.getElementById("planOutput").classList.remove("visible");
    lastBrief = "";
  });

  const downloadButton = document.getElementById("downloadBrief");
  if (downloadButton) {
    downloadButton.addEventListener("click", () => {
      if (!lastBrief) {
        return;
      }
      const data = collectFormData();
      const blob = new Blob([lastBrief], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(data.name)}-project-brief.md`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  const sendButton = document.getElementById("sendToManager");
  if (sendButton) {
    sendButton.addEventListener("click", () => {
      if (!lastBrief) {
        return;
      }
      seedImplementationManagerChat(lastBrief);
      window.location.href = "agents-chat.html?agent=implementation-manager";
    });
  }
}

initStartProjectPage();
initFileUpload();
initProjectAiAssistant();
