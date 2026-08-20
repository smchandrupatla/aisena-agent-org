$ErrorActionPreference = 'Stop'

$gatewayPort = if ($env:HSFS_API_GATEWAY_PORT) { $env:HSFS_API_GATEWAY_PORT } else { '13000' }
$casePort = if ($env:HSFS_CASE_MANAGEMENT_PORT) { $env:HSFS_CASE_MANAGEMENT_PORT } else { '13003' }
$auditPort = if ($env:HSFS_AUDIT_NOTIFICATION_PORT) { $env:HSFS_AUDIT_NOTIFICATION_PORT } else { '13005' }

$gatewayUrl = "http://localhost:$gatewayPort"
$caseUrl = "http://localhost:$casePort"
$auditUrl = "http://localhost:$auditPort"

function Wait-ForEndpoint {
    param([string]$Url, [int]$Attempts = 60)

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri $Url -TimeoutSec 3
            if ($response.status -eq 'ok') { return }
        } catch {
            if ($attempt -eq $Attempts) { throw "Endpoint did not become ready: $Url" }
        }
        [System.Threading.Thread]::Sleep(2000)
    }
}

Write-Host 'Waiting for HSFS services...'
Wait-ForEndpoint "$gatewayUrl/health"
Wait-ForEndpoint "$caseUrl/health"
Wait-ForEndpoint "$auditUrl/health"

$marker = [Guid]::NewGuid().ToString('N')
$body = @{
    amount = 15000
    currency = 'USD'
    originAccount = "ACC-ORIGIN-$marker"
    beneficiaryAccount = "ACC-BENEFICIARY-$marker"
    beneficiaryName = 'John Doe'
    beneficiaryCountry = 'US'
    transactionType = 'WIRE_TRANSFER'
    customerId = "CUST-$marker"
    customerName = 'Smoke Test Customer'
    customerCountry = 'US'
    riskRating = 'HIGH'
} | ConvertTo-Json

$submission = Invoke-RestMethod `
    -Method Post `
    -Uri "$gatewayUrl/api/transactions" `
    -Headers @{ Authorization = 'Bearer mock-smoke-test' } `
    -ContentType 'application/json' `
    -Body $body

$transactionId = $submission.transactionId
Write-Host "Submitted transaction $transactionId"

for ($attempt = 1; $attempt -le 60; $attempt++) {
    $casesResponse = Invoke-RestMethod -Uri "$caseUrl/api/cases" -TimeoutSec 5
    $auditResponse = Invoke-RestMethod -Uri "$auditUrl/api/audit" -TimeoutSec 5

    $case = @($casesResponse.cases) | Where-Object { $_.transactionId -eq $transactionId } | Select-Object -First 1
    $events = @($auditResponse.entries) | Where-Object { $_.transactionId -eq $transactionId }
    $eventTypes = @($events | ForEach-Object { $_.eventType })

    if ($case -and $eventTypes -contains 'screening.completed' -and $eventTypes -contains 'case.created') {
        $caseCount = docker compose -f backend/docker-compose.yml exec -T postgres psql -U aisena -d case_management -tAc "SELECT count(*) FROM cases WHERE transaction_id='$transactionId'"
        $auditCount = docker compose -f backend/docker-compose.yml exec -T postgres psql -U aisena -d audit_log -tAc "SELECT count(*) FROM audit_log WHERE transaction_id='$transactionId' AND event_type IN ('screening.completed','case.created')"
        if ($caseCount.Trim() -ne '1' -or [int]$auditCount.Trim() -lt 2) {
            throw "API flow completed, but PostgreSQL persistence was incomplete for transaction $transactionId."
        }
        Write-Host "PASS: transaction $transactionId produced screening.completed, case.created, and case $($case.caseId)."
        Write-Host "PASS: PostgreSQL contains $($caseCount.Trim()) case and $($auditCount.Trim()) required audit events."
        exit 0
    }

    [System.Threading.Thread]::Sleep(2000)
}

throw "Timed out waiting for transaction $transactionId to complete screening and case creation."
