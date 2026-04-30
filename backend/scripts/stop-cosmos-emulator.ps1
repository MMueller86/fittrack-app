# Stop and remove the local Cosmos DB Emulator container.
$ErrorActionPreference = 'SilentlyContinue'

$ContainerName = 'fittrack-cosmos-emulator'

$running = docker ps --filter "name=^/$ContainerName$" --format '{{.Names}}'
if ($running -eq $ContainerName) {
    Write-Host "Stopping $ContainerName..."
    docker stop $ContainerName | Out-Null
}

$exists = docker ps -a --filter "name=^/$ContainerName$" --format '{{.Names}}'
if ($exists -eq $ContainerName) {
    Write-Host "Removing $ContainerName..."
    docker rm $ContainerName | Out-Null
}

Write-Host 'Cosmos Emulator stopped.' -ForegroundColor Green
