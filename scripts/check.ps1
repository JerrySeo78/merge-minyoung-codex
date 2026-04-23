$ErrorActionPreference = "Stop"

node --check game.js

$html = Get-Content -Raw index.html
$missing = @()

foreach ($match in [regex]::Matches($html, 'src="([^"]+)"')) {
  $assetPath = $match.Groups[1].Value
  if ($assetPath -like "assets/*" -and -not (Test-Path $assetPath)) {
    $missing += $assetPath
  }
}

if ($missing.Count -gt 0) {
  throw "Missing assets: $($missing -join ', ')"
}

Write-Host "Checks passed."
