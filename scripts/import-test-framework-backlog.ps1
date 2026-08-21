param(
    [string]$TasksPath = (Join-Path $PSScriptRoot '..\project\tasks.json')
)

$ErrorActionPreference = 'Stop'

$epics = @{
    '1' = 'Foundation & Stack Confirmation'
    '2' = 'Unit Testing'
    '3' = 'Container Testing'
    '4' = 'API Testing'
    '5' = 'Service Testing'
    '6' = 'System Testing'
    '7' = 'System Integration Testing (SIT)'
    '8' = 'GUI / Frontend / E2E Testing'
    '9' = 'Security Testing'
    '10' = 'Performance Testing'
    '11' = 'Endurance / Soak / Stability Testing'
    '12' = 'Rolling Upgrade Testing'
    '13' = 'CI/CD Gating & Governance'
}

$ownerKeys = @{
    'Implementation Manager' = 'implementation-manager'
    'DevOps/SRE Agent' = 'devops-engineer'
    'Dev Agent (per service owner)' = 'backend-engineer'
    'Security Agent' = 'security-engineer'
    'QA Agent' = 'qa-engineer'
    'Frontend Dev Agent' = 'frontend-engineer'
    'Performance Engineer Agent' = 'performance-engineer'
    'DevOps/SRE Agent, QA Agent' = 'devops-engineer'
}

# ref, title, assigned role, dependency refs
$definitions = @(
    @('1.1', 'Confirm actual backend stack(s) (Java/Node/Python) and frontend stack for Aisina', 'Implementation Manager', ''),
    @('1.2', 'Finalize tooling selection per test level based on confirmed stack', 'Implementation Manager', '1.1'),
    @('1.3', 'Set up shared test management tool (Xray/TestRail) and link to Jira', 'DevOps/SRE Agent', ''),
    @('1.4', 'Set up result aggregation dashboard (Allure/ReportPortal)', 'DevOps/SRE Agent', ''),
    @('2.1', 'Set up unit test framework + coverage tooling per service', 'Dev Agent (per service owner)', '1.2'),
    @('2.2', 'Define and enforce 80% coverage gate in CI', 'DevOps/SRE Agent', '2.1'),
    @('2.3', 'Write unit tests for existing core business logic (backfill)', 'Dev Agent (per service owner)', '2.1'),
    @('3.1', 'Add Dockerfile linting (Hadolint) to CI', 'DevOps/SRE Agent', '1.3'),
    @('3.2', 'Add image vulnerability scanning (Trivy/Grype) to CI', 'Security Agent', '3.1'),
    @('3.3', 'Write container-structure-tests per service image', 'Dev Agent (per service owner)', '3.1'),
    @('3.4', 'Add health/readiness probe smoke tests', 'DevOps/SRE Agent', '3.1'),
    @('4.1', 'Author/validate OpenAPI specs for all services', 'Dev Agent (per service owner)', '1.2'),
    @('4.2', 'Set up schema lint + Dredd validation in CI', 'QA Agent', '4.1'),
    @('4.3', 'Build Postman/Newman or REST Assured functional test suites per API', 'QA Agent', '4.1'),
    @('4.4', 'Set up Pact consumer-driven contract tests between services', 'QA Agent', '4.1'),
    @('5.1', "Set up Testcontainers for each service's real dependencies (DB, Kafka, cache)", 'Dev Agent (per service owner)', '1.2'),
    @('5.2', 'Set up WireMock/Mountebank for downstream service virtualization', 'QA Agent', '5.1'),
    @('5.3', 'Write service-level test suites per microservice', 'QA Agent', '5.1'),
    @('6.1', 'Stand up prod-like staging environment', 'DevOps/SRE Agent', '1.1'),
    @('6.2', 'Author BDD/Gherkin end-to-end functional scenarios', 'QA Agent', '6.1'),
    @('6.3', 'Automate scenarios via Selenium/Playwright/Robot Framework', 'QA Agent', '6.2'),
    @('6.4', 'Link scenarios to requirements for traceability', 'QA Agent', '1.3,6.2'),
    @('7.1', 'Stand up ephemeral SIT environment (Compose/Helm)', 'DevOps/SRE Agent', '1.1'),
    @('7.2', 'Identify and simulate all third-party/external integrations (WireMock/LocalStack)', 'QA Agent', '7.1'),
    @('7.3', 'Script cross-service business-flow tests (Postman/Newman or Playwright API mode)', 'QA Agent', '7.1,7.2'),
    @('7.4', 'Validate event/message flows across services (Kafka test harness)', 'QA Agent', '7.1'),
    @('8.1', 'Set up Playwright/Cypress E2E framework', 'QA Agent', '6.1'),
    @('8.2', 'Set up cross-browser grid (BrowserStack/Sauce Labs)', 'QA Agent', '8.1'),
    @('8.3', 'Set up visual regression testing (Percy/Applitools)', 'QA Agent', '8.1'),
    @('8.4', 'Set up accessibility testing (axe-core, Lighthouse)', 'QA Agent', '8.1'),
    @('8.5', 'Set up component-level tests (Storybook + Chromatic, RTL)', 'Frontend Dev Agent', '8.1'),
    @('9.1', 'Integrate SAST (SonarQube/Semgrep) into CI', 'Security Agent', '1.3'),
    @('9.2', 'Integrate SCA/dependency scanning (Snyk/Dependabot) into CI', 'Security Agent', '1.3'),
    @('9.3', 'Integrate DAST (OWASP ZAP) against staging', 'Security Agent', '6.1'),
    @('9.4', 'Integrate secrets scanning (Gitleaks/TruffleHog) into CI', 'Security Agent', '1.3'),
    @('9.5', 'Add IaC scanning (Checkov/tfsec) if applicable', 'Security Agent', '1.3'),
    @('9.6', 'Schedule and coordinate first penetration test', 'Security Agent', '6.1'),
    @('10.1', 'Provision dedicated performance test environment', 'DevOps/SRE Agent', '1.1'),
    @('10.2', 'Build k6/JMeter/Gatling load test scripts for key flows', 'Performance Engineer Agent', '10.1'),
    @('10.3', 'Define load, stress, spike, and scalability test scenarios', 'Performance Engineer Agent', '10.2'),
    @('10.4', 'Wire up APM/metrics capture during tests (Prometheus/Grafana)', 'DevOps/SRE Agent', '10.1'),
    @('10.5', 'Set up frontend performance testing (Lighthouse CI)', 'Frontend Dev Agent', '8.1'),
    @('11.1', 'Extend load scripts to long-duration soak profiles (48-72h)', 'Performance Engineer Agent', '10.2'),
    @('11.2', 'Set up resource/leak monitoring dashboards (memory, GC, connections, queue depth)', 'DevOps/SRE Agent', '10.4'),
    @('11.3', 'Set up log/disk growth monitoring (ELK/EFK or Loki)', 'DevOps/SRE Agent', '10.1'),
    @('11.4', 'Configure drift/degradation alerting (p95/p99 latency thresholds)', 'DevOps/SRE Agent', '11.2'),
    @('11.5', 'Schedule recurring soak test cadence (pre-release + quarterly)', 'Implementation Manager', '11.1,11.2,11.3,11.4'),
    @('12.1', 'Configure Kubernetes rolling update strategy / Argo Rollouts / Flagger', 'DevOps/SRE Agent', '6.1'),
    @('12.2', 'Set up canary traffic-shifting with Prometheus-based gating', 'DevOps/SRE Agent', '12.1'),
    @('12.3', 'Set up backward-compatibility contract checks (openapi-diff / buf breaking)', 'QA Agent', '4.4'),
    @('12.4', 'Set up DB migration expand/contract validation (Liquibase/Flyway)', 'Dev Agent (per service owner)', '1.2'),
    @('12.5', 'Automate rollback trigger + smoke suite re-run on failed health check', 'DevOps/SRE Agent', '12.1'),
    @('12.6', 'Integrate chaos testing during rollout (Chaos Mesh/Litmus)', 'DevOps/SRE Agent', '12.1'),
    @('12.7', 'Script and rehearse N-1 to N live-traffic upgrade scenario', 'DevOps/SRE Agent, QA Agent', '12.1,12.2,12.3,12.4,12.5,12.6'),
    @('13.1', 'Wire pre-commit and PR-level gates (lint, fast unit, SAST, SCA)', 'DevOps/SRE Agent', '2.1,9.1,9.2'),
    @('13.2', 'Wire merge-to-main gates (full unit, API, service, container tests)', 'DevOps/SRE Agent', '2.1,2.2,2.3,3.1,3.2,3.3,3.4,4.1,4.2,4.3,4.4,5.1,5.2,5.3'),
    @('13.3', 'Wire nightly pipeline (system, SIT, GUI/E2E, DAST)', 'DevOps/SRE Agent', '6.1,6.2,6.3,6.4,7.1,7.2,7.3,7.4,8.1,8.2,8.3,8.4,8.5,9.1,9.2,9.3,9.4,9.5,9.6'),
    @('13.4', 'Wire pre-release gate (performance, pentest checklist, rolling upgrade rehearsal)', 'DevOps/SRE Agent', '10.1,10.2,10.3,10.4,10.5,9.6,12.7'),
    @('13.5', 'Wire major-release gate (endurance/soak)', 'DevOps/SRE Agent', '11.1,11.2,11.3,11.4,11.5'),
    @('13.6', 'Define and get sign-off on non-functional SLAs/thresholds', 'Implementation Manager', '10.1,10.2,10.3,10.4,10.5,11.1,11.2,11.3,11.4,11.5')
)

$tasks = if (Test-Path $TasksPath) { @(Get-Content $TasksPath -Raw | ConvertFrom-Json) } else { @() }
$existingByRef = @{}
foreach ($task in $tasks) {
    foreach ($tag in @($task.tags)) {
        if ($tag -like 'strategy-task:*') {
            $existingByRef[$tag.Substring('strategy-task:'.Length)] = $task
        }
    }
}

$maxId = ($tasks | ForEach-Object { if ($_.id -match '^TASK-(\d+)$') { [int]$Matches[1] } } | Measure-Object -Maximum).Maximum
if ($null -eq $maxId) { $maxId = 0 }

$idByRef = @{}
foreach ($definition in $definitions) {
    $ref = $definition[0]
    if ($existingByRef.ContainsKey($ref)) {
        $idByRef[$ref] = $existingByRef[$ref].id
    } else {
        $maxId++
        $idByRef[$ref] = 'TASK-{0:D4}' -f [int]$maxId
    }
}

$now = [DateTimeOffset]::UtcNow.ToString('o')
$added = 0
foreach ($definition in $definitions) {
    $ref, $title, $assignedRole, $dependencyList = $definition
    if ($existingByRef.ContainsKey($ref)) { continue }

    $epicNumber = $ref.Split('.')[0]
    $dependencyRefs = @($dependencyList.Split(',') | Where-Object { $_ })
    $dependencyIds = @($dependencyRefs | ForEach-Object { $idByRef[$_] })
    $description = @(
        "Strategy task: $ref"
        "Epic ${epicNumber}: $($epics[$epicNumber])"
        "Assigned role: $assignedRole"
        "Depends on: $(if ($dependencyRefs.Count) { $dependencyRefs -join ', ' } else { 'None' })"
        'Source: Aisina_Test_Strategy.md'
        'Planning only - no implementation has been performed.'
    ) -join "`n"

    $task = [ordered]@{
        id = $idByRef[$ref]
        title = "[$ref] $title"
        description = $description
        owner = $ownerKeys[$assignedRole]
        status = 'Backlog'
        priority = 'Medium'
        dependency = if ($dependencyIds.Count) { $dependencyIds[0] } else { $null }
        next_checkpoint = 'Confirm scope, acceptance criteria, and tooling decision.'
        tags = @('test-framework', ('epic-{0:D2}' -f [int]$epicNumber), "strategy-task:$ref", 'planning-only')
        created_at = $now
        updated_at = $now
        comments = @()
        activity_log = @([ordered]@{
            timestamp = $now
            actor = 'implementation-manager'
            action = 'created'
            details = 'Imported from Aisina Test Framework implementation task backlog as planning-only work.'
        })
    }
    $tasks += [pscustomobject]$task
    $added++
}

$json = $tasks | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText((Resolve-Path $TasksPath), $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "Added $added task(s). Total task count: $($tasks.Count)."