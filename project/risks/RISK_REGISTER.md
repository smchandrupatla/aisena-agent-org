# Risk Register

## RISK-0001 — Missing application source

Description:
The repository currently contains only a README, so the project lacks an existing codebase to bootstrap from.

Impact:
Delays in establishing the project scope and implementation plan.

Mitigation:
Create a discovery and onboarding path for the Implementation Manager and Definition roles. Use the repository as the source of truth for future work.

## RISK-0002 — Agent runtime availability

Description:
The Implementation Manager depends on the Copilot CLI runtime being available and usable for launching specialist agents.

Impact:
If the CLI cannot be used, agent execution scripts may be incomplete and the team may lack a standard invocation mechanism.

Mitigation:
Document the available runtime and create fallback instructions. Validate the CLI before relying on it.

## RISK-0003 — No CI / environment automation

Description:
The repository lacks existing CI workflows and devcontainer configuration.

Impact:
New developers and agents may take extra effort to become productive.

Mitigation:
Bootstrap minimal environment documentation and later add Codespaces/devcontainer support.
