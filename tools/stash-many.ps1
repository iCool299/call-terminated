# Moves the N newest PNGs from Downloads (oldest first) into sprites/agents/raw as <Prefix>_<name>.png.
# Usage: stash-many.ps1 -Prefix polo -Names a,b,c,d      (download the sheets in that same order first)
param([Parameter(Mandatory)][string]$Prefix, [Parameter(Mandatory)][string[]]$Names, [string]$Dir = 'agents\raw')
$Names = @($Names | ForEach-Object { $_ -split ',' } | Where-Object { $_ })      # accept "a,b,c" passed through -File
$dl = Join-Path $env:USERPROFILE 'Downloads'
$files = $null
for ($t = 0; $t -lt 20; $t++) {
    $files = @(Get-ChildItem $dl -Filter *.png | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-10) } | Sort-Object LastWriteTime -Descending | Select-Object -First $Names.Count | Sort-Object LastWriteTime)
    if ($files.Count -ge $Names.Count) { break }
    Start-Sleep -Milliseconds 750
}
if ($files.Count -lt $Names.Count) { Write-Host "only $($files.Count) fresh downloads found, expected $($Names.Count)"; exit 1 }
$dstDir = Join-Path (Split-Path -Parent $PSScriptRoot) "sprites\$Dir"; New-Item -ItemType Directory -Force $dstDir | Out-Null
Add-Type -AssemblyName System.Drawing
for ($i = 0; $i -lt $Names.Count; $i++) {
    $dst = Join-Path $dstDir "${Prefix}_$($Names[$i]).png"
    Move-Item $files[$i].FullName $dst -Force
    $im = [Drawing.Image]::FromFile($dst); Write-Host ("saved {0}  {1}x{2}" -f $dst, $im.Width, $im.Height); $im.Dispose()
}
