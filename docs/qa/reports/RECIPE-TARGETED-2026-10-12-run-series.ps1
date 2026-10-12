# QA helper: runs bounded live-eval series sequentially; no retries, no extension. Raw outputs are saved per run.
param([string]$Name, [int]$Count, [string]$File, [string]$Filter = '')
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$reports = Join-Path $root 'docs\qa\reports'
$files = 'backend\src\lib\openai.ts', 'backend\src\lib\prompts\recipeAnalyze.ts', 'backend\src\lib\recipeImportCookingCheck.ts', 'backend\src\lib\recipePreparationOrder.ts', 'backend\src\lib\recipeTotalTimeGuard.ts', 'backend\src\lib\recipeAnalyzeValidation.ts'
function Get-CandidateHash {
  ($files | ForEach-Object { (Get-FileHash (Join-Path $root $_) -Algorithm SHA256).Hash }) -join ''
}
$before = Get-CandidateHash
$runs = @()
Push-Location (Join-Path $root 'backend')
for ($i = 1; $i -le $Count; $i++) {
  $n = '{0:D2}' -f $i
  $out = Join-Path $reports "RECIPE-TARGETED-2026-10-12-$Name-run$n-Output.txt"
  $args = @('scripts/run-eval.mjs', $File, '--reporter=verbose')
  if ($Filter) { $args += @('-t', $Filter) }
  $start = Get-Date
  & node @args *> $out
  $exit = $LASTEXITCODE
  $text = Get-Content $out -Raw
  $tests = [regex]::Match($text, 'Tests\s+([^\r\n]+)').Groups[1].Value.Trim() -replace '\x1b\[[0-9;]*m', ''
  $runs += [pscustomobject]@{ run = $i; exit = $exit; tests = $tests; seconds = [int]((Get-Date) - $start).TotalSeconds }
}
Pop-Location
$after = Get-CandidateHash
[pscustomobject]@{ series = $Name; file = $File; filter = $Filter; count = $Count; candidateStable = ($before -eq $after); runs = $runs } |
  ConvertTo-Json -Depth 5 | Set-Content (Join-Path $reports "RECIPE-TARGETED-2026-10-12-$Name-summary.json") -Encoding utf8
"SERIES $Name DONE"
