# Builds Zee's game-ready strips + manifest from the generated green-screen sheets in sprites/zee/raw.
# Usage: powershell -ExecutionPolicy Bypass -File tools\build-zee.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Add-Type -ReferencedAssemblies System.Drawing -Path (Join-Path $PSScriptRoot 'ZeePipeline.cs')

function Cfg($name, $file, $n, $rows, $standH) {
    $c = New-Object Zee2.SheetCfg
    $c.Name = $name; $c.Path = "sprites\zee\raw\$file"; $c.N = $n; $c.Rows = $rows; $c.StandH = $standH
    return $c
}

. (Join-Path $PSScriptRoot 'zee-sheets.ps1')
. (Join-Path $PSScriptRoot 'zee-anims.ps1')

# Extra palette colors for props that are not on the master (compact mirror, lipstick, red pen, scorecard stars).
$extras = @(0xC98B8B, 0x9E6670, 0xE6B5B0, 0x8A3F4A, 0xD13438, 0x8F1D22, 0xF5C542, 0xC99A2E)
$master = Join-Path $root 'sprites\zee\master\zee_master_idle_v1.png'
$out = Join-Path $root 'assets\characters\zee'
$dbg = Join-Path $root 'tools\debug'
New-Item -ItemType Directory -Force $dbg | Out-Null
$log = [Zee2.Pipe]::Run($root, $master, $out, (Join-Path $dbg 'zee-sheet.png'), $sheets, 28, $extras)
$log | Out-File (Join-Path $dbg 'zee-build.log') -Encoding utf8

# Manifest
$strips = [ordered]@{}
foreach ($s in $sheets) { $strips[$s.Name] = [ordered]@{ file = "zee_$($s.Name).png"; frames = $s.N } }
$animTable = [ordered]@{}
foreach ($a in $anims) {
    $e = [ordered]@{ strip = $a.strip; from = $a.from; to = $a.to; fps = $a.fps; loop = [bool]$a.loop }
    if ($a.loopFrom) { $e.loopFrom = $a.loopFrom }
    if ($a.active)   { $e.active = @($a.active) }
    if ($a.iframes)  { $e.iframes = @($a.iframes) }
    $animTable[$a.name] = $e
}
$manifest = [ordered]@{
    character = 'zee'
    cell      = [ordered]@{ w = [Zee2.Pipe]::CELL; h = [Zee2.Pipe]::CELL }
    anchor    = [ordered]@{ x = [Zee2.Pipe]::ANCHOR_X; y = [Zee2.Pipe]::BASE_Y }
    standingHeightPx = [int][Zee2.Pipe]::TARGET_STAND
    facing    = 'right'
    strips    = $strips
    animations = $animTable
}
$json = $manifest | ConvertTo-Json -Depth 6
$json | Out-File (Join-Path $out 'zee.manifest.json') -Encoding utf8
("window.ZEE_MANIFEST = " + $json + ";") | Out-File (Join-Path $out 'zee.manifest.js') -Encoding utf8
Write-Host "built $($sheets.Count) strips, $($anims.Count) animations -> $out"
