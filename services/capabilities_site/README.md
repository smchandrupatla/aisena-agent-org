# Capabilities Site

This folder contains a static multi-page website that describes the capabilities of the AI development shop.

## Pages
- `index.html` - overview and service map
- `start-project.html` - domain-agnostic intake wizard: describe any application (web, mobile, backend/API, data pipeline, desktop), any deployment target (local, cloud, hybrid), and generate a full SDLC delivery plan, starter backlog, and downloadable project brief
- `capabilities.html` - detailed capability catalog
- `documentation.html` - documentation template catalog and Word template downloads
- `tasks.html` - task menu for execution tracking and ownership
- `issues.html` - issue menu for blockers, risks, and mitigation status
- `workflow.html` - delivery lifecycle and execution model
- `guardrails.html` - safety controls and escalation gates
- `agents-chat.html` - full agent directory and per-agent interaction chat console (supports `?agent=<key>` to preselect an agent)

## Run locally
You can open the html files directly in a browser, or serve them with Python:

```bash
cd services/capabilities_site
python3 -m http.server 8081
```

Then visit `http://localhost:8081`.

## Sync with real agents
The agent directory/chat is wired to `agents.json`, generated from real folders in `/agents`.

```bash
cd services/capabilities_site
python3 sync_agents.py
```

This refreshes names, focus text, agent file paths, and runner commands.

## Sync Word templates
Copy generated `.docx` templates into this site and rebuild downloadable catalog:

```bash
cd services/capabilities_site
python3 sync_word_templates.py
```

