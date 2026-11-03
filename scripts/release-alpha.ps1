<#
  Alpha release: clean build, verified staging, ZIP upload with remote build, verification.
  Backend deploy and EAS build are separate approvals; -IncludeAndroidPreview only after explicit request.
  Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\release-alpha.ps1 [-SkipDeploy] [-IncludeAndroidPreview]
#>
[CmdletBinding()]
param(
    [switch]$SkipDeploy,
    [switch]$IncludeAndroidPreview,
    [int]$UploadTimeoutSeconds = 900,
    [int]$MaxZipMb = 25
)

$ErrorActionPreference = 'Continue'
$SubscriptionId = 'dd7539ab-c638-44f8-9173-8bcd28cdbae3'
$ResourceGroup = 'rg-fittrack-alpha'
$FunctionApp = 'func-fittrack-alpha-wcobsd'
$ApiBase = "https://$FunctionApp.azurewebsites.net/api"
$Root = Split-Path -Parent $PSScriptRoot
$Staging = Join-Path $Root '_deploy_staging'

$report = [ordered]@{
    FunctionsDeployed = 'NO'
    Health            = 'N/A'
    AndroidPreview    = 'N/A'
}

function Write-Step([string]$Text) { Write-Host ""; Write-Host "=== $Text ===" }

function Stop-Release([string]$Reason) {
    Write-Host "STOP: $Reason" -ForegroundColor Red
    Write-Host "Previous Function App version stays active; nothing was released."
    exit 1
}

function Get-RegisteredFunctionNames([string]$DistDir) {
    $names = @()
    foreach ($file in Get-ChildItem (Join-Path $DistDir 'backend\src') -Recurse -Filter *.js) {
        foreach ($m in [regex]::Matches((Get-Content -LiteralPath $file.FullName -Raw), "functions_1\.app\.\w+\(\s*'([^']+)'")) {
            $names += $m.Groups[1].Value
        }
    }
    return @($names | Sort-Object -Unique)
}

function Get-DeployedFunctionNames {
    $names = @(az functionapp function list --subscription $SubscriptionId --resource-group $ResourceGroup --name $FunctionApp --query "[].name" -o tsv 2>$null |
        ForEach-Object { ($_ -split '/')[-1].Trim() } | Where-Object { $_ })
    if ($LASTEXITCODE -eq 0 -and $names.Count -gt 0) { return $names }
    Push-Location $Staging
    try {
        $text = (& func azure functionapp list-functions $FunctionApp 2>&1 | Out-String)
    } finally { Pop-Location }
    return @([regex]::Matches($text, '(?m)^\s{4}([\w-]+) - \[') | ForEach-Object { $_.Groups[1].Value })
}

function Get-HttpStatus([string]$Url) {
    try { return [int](Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30).StatusCode }
    catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

# --- 1. Toolchain ---------------------------------------------------------
Write-Step 'Toolchain'
$nodeTools = Join-Path $env:USERPROFILE 'tools\node-v24.22.1-win-x64'
if (Test-Path -LiteralPath $nodeTools) { $env:PATH = "$nodeTools;$env:PATH" }
$expectedNode = (Get-Content -LiteralPath (Join-Path $Root '.nvmrc') -Raw).Trim()
$actualNode = (& node --version 2>$null)
if ("$actualNode".Trim() -ne "v$expectedNode") { Stop-Release "Node $actualNode active, expected v$expectedNode (.nvmrc)" }
Write-Host "node $actualNode, npm $(& npm.cmd --version 2>$null)"
if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) { Stop-Release 'tar.exe not found (needed to build the ZIP)' }

# --- 2. Azure context -----------------------------------------------------
Write-Step 'Azure context'
$null = az account show --subscription $SubscriptionId --query id -o tsv 2>$null
if ($LASTEXITCODE -ne 0) { Stop-Release "Azure session invalid; run 'az login' and retry" }
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { Stop-Release 'az account set failed' }

# --- 3. Clean build -------------------------------------------------------
Write-Step 'Clean build (build:verify)'
Remove-Item -Recurse -Force (Join-Path $Root 'backend\dist') -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $Root 'backend\tsconfig.tsbuildinfo') -ErrorAction SilentlyContinue
Push-Location (Join-Path $Root 'backend')
try { npm.cmd run build:verify; $buildExit = $LASTEXITCODE } finally { Pop-Location }
if ($buildExit -ne 0) { Stop-Release "build:verify failed (exit $buildExit)" }

# --- 4. Sync + verify staging --------------------------------------------
Write-Step 'Sync staging'
$srcDist = Join-Path $Root 'backend\dist'
$dstDist = Join-Path $Staging 'dist'
robocopy $srcDist $dstDist /MIR /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { Stop-Release "robocopy failed (exit $LASTEXITCODE)" }

$srcFiles = @(Get-ChildItem $srcDist -Recurse -File)
$dstFiles = @(Get-ChildItem $dstDist -Recurse -File)
if ($srcFiles.Count -ne $dstFiles.Count) { Stop-Release "staging file count $($dstFiles.Count) differs from build output $($srcFiles.Count)" }
foreach ($f in $srcFiles) {
    $target = Join-Path $dstDist $f.FullName.Substring($srcDist.Length)
    if (-not (Test-Path -LiteralPath $target) -or (Get-FileHash -LiteralPath $f.FullName).Hash -ne (Get-FileHash -LiteralPath $target).Hash) {
        Stop-Release "staging differs from build output: $($f.FullName.Substring($srcDist.Length))"
    }
}

$required = @(
    'backend\src\functions\instagramRecipe.js',
    'backend\src\lib\instagramRenderer\assets\branding\fittrack-wordmark.png',
    'backend\src\lib\instagramRenderer\assets\branding\micha-logo-writing.svg',
    'backend\src\lib\instagramRenderer\assets\fonts\Inter-Medium.ttf',
    'backend\src\lib\instagramRenderer\assets\fonts\Inter-MediumItalic.ttf',
    'backend\src\lib\instagramRenderer\assets\fonts\Inter-SemiBold.ttf',
    'backend\src\lib\instagramRenderer\assets\fonts\InterDisplay-Bold.ttf',
    'backend\src\lib\instagramRenderer\assets\fonts\LICENSE.txt',
    'backend\src\lib\instagramRenderer\assets\nutrition\barbell-header-frame.svg',
    'backend\src\lib\instagramRenderer\assets\nutrition-highlights\high-protein.png',
    'backend\src\lib\instagramRenderer\assets\nutrition-highlights\low-fat.png'
)
$missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $dstDist $_)) })
if ($missing.Count -gt 0) { Stop-Release "required staged files missing: $($missing -join ', ')" }
foreach ($name in 'host.json', 'package.json', 'package-lock.json') {
    if (-not (Test-Path -LiteralPath (Join-Path $Staging $name))) { Stop-Release "_deploy_staging\$name missing" }
}
if (Test-Path -LiteralPath (Join-Path $Staging 'local.settings.json')) { Stop-Release 'local.settings.json must not be in _deploy_staging' }

$expectedFunctions = Get-RegisteredFunctionNames $dstDist
if ($expectedFunctions.Count -eq 0 -or $expectedFunctions -notcontains 'health') { Stop-Release 'no function registrations (or no health) found in compiled output' }
Write-Host "Staging verified: $($dstFiles.Count) files byte-identical, $($expectedFunctions.Count) functions registered, 11 required files present."

# --- 5. ZIP (no node_modules; Oryx installs Linux dependencies) -----------
Write-Step 'Build deployment ZIP'
$zip = Join-Path ([IO.Path]::GetTempPath()) ("fittrack-alpha-{0}.zip" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
tar.exe -a -cf $zip -C $Staging dist host.json package.json package-lock.json
if ($LASTEXITCODE -ne 0) { Stop-Release 'ZIP creation failed' }
$entries = @(tar.exe -tf $zip)
$sizeMb = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
if ($entries | Where-Object { $_ -like 'node_modules*' }) { Stop-Release 'ZIP contains node_modules' }
if ($entries | Where-Object { $_ -like '*\*' }) { Stop-Release 'ZIP entries contain backslashes (not Linux-safe)' }
if ($entries -notcontains 'dist/backend/src/functions/instagramRecipe.js') { Stop-Release 'ZIP misses the instagramRecipe handler' }
if ($sizeMb -gt $MaxZipMb) { Stop-Release "ZIP is $sizeMb MB (limit $MaxZipMb MB); unexpected content" }
Write-Host "ZIP ok: $sizeMb MB, $($entries.Count) entries ($zip)"

if ($SkipDeploy) {
    Write-Host 'SkipDeploy set: stopping before upload.'
    Remove-Item -LiteralPath $zip -ErrorAction SilentlyContinue
    exit 0
}

# --- 6. Upload with remote build -----------------------------------------
Write-Step 'Deploy (az config-zip, remote build)'
$outFile = Join-Path $env:TEMP 'fittrack-deploy.out'
$errFile = Join-Path $env:TEMP 'fittrack-deploy.err'
$azArgs = "/c az functionapp deployment source config-zip --subscription $SubscriptionId --resource-group $ResourceGroup --name $FunctionApp --src `"$zip`" --build-remote true --timeout $UploadTimeoutSeconds"
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $azArgs -NoNewWindow -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
$null = $proc.Handle
if (-not $proc.WaitForExit(($UploadTimeoutSeconds + 120) * 1000)) {
    taskkill.exe /PID $proc.Id /T /F | Out-Null
    Stop-Release "upload made no result within $($UploadTimeoutSeconds + 120) s and was aborted"
}
$proc.WaitForExit()
Get-Content -LiteralPath $errFile -ErrorAction SilentlyContinue | Select-Object -Last 10
if ($proc.ExitCode -ne 0) {
    Get-Content -LiteralPath $outFile -ErrorAction SilentlyContinue | Select-Object -Last 20
    Stop-Release "az config-zip failed (exit $($proc.ExitCode))"
}
Remove-Item -LiteralPath $zip, $outFile, $errFile -ErrorAction SilentlyContinue
$report.FunctionsDeployed = 'YES'

# --- 7. Verification ------------------------------------------------------
Write-Step 'Verify deployed functions'
$deployed = @()
$absent = $expectedFunctions
for ($i = 1; $i -le 6; $i++) {
    $deployed = Get-DeployedFunctionNames
    $absent = @($expectedFunctions | Where-Object { $deployed -notcontains $_ })
    if ($absent.Count -eq 0) { break }
    Write-Host "Attempt $i/6: $($absent.Count) functions not listed yet; waiting 20 s"
    Start-Sleep -Seconds 20
}
if ($absent.Count -gt 0) { Write-Host "FAIL: not deployed: $($absent -join ', ')" -ForegroundColor Red }
else { Write-Host "OK: all $($expectedFunctions.Count) registered functions are deployed." }

Write-Step 'Health check'
$healthStatus = 0
for ($i = 1; $i -le 6; $i++) {
    $healthStatus = Get-HttpStatus "$ApiBase/health"
    if ($healthStatus -eq 200) { break }
    Start-Sleep -Seconds 10
}
$authStatus = Get-HttpStatus "$ApiBase/diary/meals"
$healthOk = ($healthStatus -eq 200 -and $authStatus -eq 401)
$report.Health = if ($healthOk) { "PASS (health $healthStatus, diary/meals $authStatus)" } else { "FAIL (health $healthStatus, diary/meals $authStatus)" }
Write-Host "health=$healthStatus (expect 200), diary/meals=$authStatus (expect 401)"

# --- 8. Optional EAS preview build ---------------------------------------
if ($IncludeAndroidPreview) {
    Write-Step 'EAS Android preview build'
    $null = eas whoami 2>$null
    if ($LASTEXITCODE -ne 0) { $report.AndroidPreview = 'NO (eas not logged in)' }
    else {
        Push-Location (Join-Path $Root 'mobile')
        try { eas build --profile preview --platform android --non-interactive; $easExit = $LASTEXITCODE } finally { Pop-Location }
        $report.AndroidPreview = if ($easExit -eq 0) { 'YES' } else { "NO (exit $easExit)" }
    }
}

Write-Step 'FitTrack Release Report'
Write-Host "Azure Functions deployed:   $($report.FunctionsDeployed) ($($deployed.Count) functions live)"
Write-Host "Health check:               $($report.Health)"
Write-Host "Expo Alpha Build created:   $($report.AndroidPreview)"
if ($absent.Count -gt 0 -or -not $healthOk -or $report.AndroidPreview -like 'NO*') { exit 1 }
exit 0
