# Builds the crm-portal image, spins up a Selenium Grid + Chrome node, runs the
# GUI test suite against it, then tears everything down.
$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot\..
try {
    docker compose -f docker-compose.selenium.yml up --build --abort-on-container-exit --exit-code-from gui-tests
    $exitCode = $LASTEXITCODE
}
finally {
    docker compose -f docker-compose.selenium.yml down -v
    Pop-Location
}

exit $exitCode
