# Start the Azure Cosmos DB Linux Emulator (vNext preview) in Docker.
#
# Why this script:
#   - Single command for `npm run emulator:start`.
#   - Idempotent: if a container with the same name already runs, we keep it.
#   - Safe: never touches real Azure resources.
#
# Endpoint after start:
#   https://localhost:8081
#   key: C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==
#   (the well-known emulator master key — never use against real Cosmos)

$ErrorActionPreference = 'Stop'

$ContainerName = 'fittrack-cosmos-emulator'
$Image = 'mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview'

# Verify Docker is available.
try {
    docker version --format '{{.Server.Version}}' | Out-Null
} catch {
    Write-Error 'Docker is not running or not installed. Install Docker Desktop and start it before running contract tests.'
    exit 1
}

# Already running?
$existing = docker ps --filter "name=^/$ContainerName$" --format '{{.Names}}'
if ($existing -eq $ContainerName) {
    Write-Host "Cosmos Emulator is already running as '$ContainerName'." -ForegroundColor Green
    Write-Host '  Endpoint: https://localhost:8081'
    exit 0
}

# Stopped container with same name? Remove it.
$stopped = docker ps -a --filter "name=^/$ContainerName$" --format '{{.Names}}'
if ($stopped -eq $ContainerName) {
    Write-Host "Removing stopped container '$ContainerName'..."
    docker rm $ContainerName | Out-Null
}

Write-Host "Pulling $Image (first run may take a minute)..."
docker pull $Image | Out-Null

Write-Host "Starting Cosmos Emulator on port 8081..."
docker run --detach --name $ContainerName --publish 8081:8081 $Image | Out-Null

Write-Host 'Waiting for emulator to become ready (up to 120s)...'
$ready = $false
$deadline = (Get-Date).AddSeconds(120)
while (-not $ready -and (Get-Date) -lt $deadline) {
    try {
        $orig = $env:NODE_TLS_REJECT_UNAUTHORIZED
        $env:NODE_TLS_REJECT_UNAUTHORIZED = '0'
        # The emulator presents a self-signed cert; ignore that for the probe.
        Invoke-WebRequest -Uri 'https://localhost:8081/_explorer/emulator.pem' `
            -SkipCertificateCheck -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
        $ready = $true
    } catch {
        Start-Sleep -Seconds 2
    } finally {
        $env:NODE_TLS_REJECT_UNAUTHORIZED = $orig
    }
}

if (-not $ready) {
    Write-Error 'Emulator did not become ready in time. Check `docker logs fittrack-cosmos-emulator`.'
    exit 1
}

Write-Host ''
Write-Host 'Cosmos Emulator is ready.' -ForegroundColor Green
Write-Host '  Endpoint: https://localhost:8081'
Write-Host '  Key:      (well-known emulator master key — see backend/README.md)'
Write-Host ''
Write-Host 'Run contract tests with:  npm run test:contract'
