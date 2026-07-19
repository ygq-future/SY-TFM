param(
  [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$portableRoot = Join-Path $projectRoot "src-tauri\target\release\bundle\portable"
$targetDirectory = Join-Path $portableRoot "SY-TFM_portable_$Version"
$archivePath = Join-Path $portableRoot "SY-TFM_portable_$Version.zip"

& (Join-Path $PSScriptRoot "generate-nsis-assets.ps1")
Push-Location $projectRoot
try {
  bun run tauri build -- --no-bundle
  New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null
  Remove-Item -Recurse -Force $targetDirectory -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  Copy-Item "src-tauri\target\release\sy-tfm.exe" (Join-Path $targetDirectory "SY-TFM.exe")
  New-Item -ItemType File -Force -Path (Join-Path $targetDirectory "SY-TFM.portable") | Out-Null
  @'
SY-TFM Portable

This folder is self-contained for application data. Keep SY-TFM.portable beside SY-TFM.exe.
The app writes its settings to .\data. Saved connection passwords remain protected by Windows
Credential Manager on this device. To transfer credentials to another computer, use Settings >
Storage > Portable encrypted backup and restore it with the same backup password.
'@ | Set-Content -NoNewline -Encoding utf8 (Join-Path $targetDirectory "README.txt")
  Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
  Compress-Archive -Path $targetDirectory -DestinationPath $archivePath -CompressionLevel Optimal
  Write-Host "Portable package: $archivePath"
}
finally {
  Pop-Location
}
