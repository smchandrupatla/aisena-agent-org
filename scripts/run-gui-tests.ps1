# Build the capabilities site, start Selenium Chrome, run HTML screen suite, tear down.
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
