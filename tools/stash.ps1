# Moves the newest PNG in Downloads (less than 3 minutes old) into sprites/zee/raw under the given name.
# Usage: powershell -File tools\stash.ps1 -Name idle_makeup_v1
param([Parameter(Mandatory)][string]$Name, [string]$Dir = 'zee\raw')
$dl = Join-Path $env:USERPROFILE 'Downloads'
$f = $null
for ($t = 0; $t -lt 20 -and -not $f; $t++) {
    $f = Get-ChildItem $dl -Filter *.png | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-3) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $f) { Start-Sleep -Milliseconds 750 }
}
if (-not $f) { Write-Host 'no fresh download found'; exit 1 }
$dstDir = Join-Path (Split-Path -Parent $PSScriptRoot) "sprites\$Dir"
New-Item -ItemType Directory -Force $dstDir | Out-Null
$dst = Join-Path $dstDir "$Name.png"
Move-Item $f.FullName $dst -Force
Add-Type -AssemblyName System.Drawing
$i = [Drawing.Image]::FromFile($dst); Write-Host "saved $dst  $($i.Width)x$($i.Height)"; $i.Dispose()
