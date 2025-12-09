param(
  [string]$ProjectPath = (Split-Path -Parent $PSScriptRoot),
  [switch]$Publish = $true
)

function Ensure-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' not found. Ensure it is installed and on PATH."
  }
}

if (-not (Test-Path $ProjectPath)) {
  throw "Project path '$ProjectPath' does not exist."
}

Set-Location $ProjectPath

Ensure-Command npm

Write-Host "Using project path: $ProjectPath"

if (-not $env:GH_TOKEN) {
  Write-Warning "GH_TOKEN is not set. Publishing to GitHub Releases will fail."
}

Write-Host "`n=== Installing dependencies ==="
npm install
if ($LASTEXITCODE -ne 0) {
  throw "npm install failed."
}

Write-Host "`n=== Building renderer and electron bundles ==="
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "npm run build failed."
}

$publishFlag = if ($Publish.IsPresent) { "--publish=always" } else { "--publish=never" }
Write-Host "`n=== Packaging Windows installer ($publishFlag) ==="
npx electron-builder --win --x64 $publishFlag
if ($LASTEXITCODE -ne 0) {
  throw "electron-builder failed."
}

Write-Host "`nBuild complete. Artifacts are in the 'release' folder."
