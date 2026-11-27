# Builds Zee's game-ready strips + manifest from the generated green-screen sheets in sprites/zee/raw.
# Usage: powershell -ExecutionPolicy Bypass -File tools\build-zee.ps1
param([string]$Suffix = '')      # '' = original build, '-v2' = the higher frame-count redo (outputs to assets\characters\zee_v2)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Add-Type -ReferencedAssemblies System.Drawing -Path (Join-Path $PSScriptRoot 'ZeePipeline.cs')

function Cfg($name, $file, $n, $rows, $standH) {
    $c = New-Object Zee2.SheetCfg
    $c.Name = $name; $c.Path = "sprites\zee\raw\$file"; $c.N = $n; $c.Rows = $rows; $c.StandH = $standH
    return $c
}

. (Join-Path $PSScriptRoot "zee-sheets$Suffix.ps1")
. (Join-Path $PSScriptRoot "zee-anims$Suffix.ps1")

# Extra palette colors for props that are not on the master (compact mirror, lipstick, red pen, scorecard stars).
$extras = @()    # the master's own palette only: extra pink/red/gold entries attracted stray speckle pixels onto the pants
$master = Join-Path $root 'sprites\zee\master\zee_master_idle_v2.png'
$outName = 'zee' + ($Suffix -replace '-', '_')
$out = Join-Path $root "assets\characters\$outName"
$dbg = Join-Path $root 'tools\debug'
New-Item -ItemType Directory -Force $dbg | Out-Null
New-Item -ItemType Directory -Force $out | Out-Null
$log = [Zee2.Pipe]::Run($root, $master, $out, '', $sheets, 32, $extras)     # 32 colours + texture stabiliser = clean flat shading; no debug sheet (it would be huge at 2x)
$log | Out-File (Join-Path $dbg "zee-build$Suffix.log") -Encoding utf8
# The makeup idle is rebuilt on its own with gold + red palette entries, so the lipstick keeps its gold case and red tip
# (only this strip gets them, so no stray red/gold speckles appear on the other animations).
$mk = @($sheets | Where-Object { $_.Name -like 'idlemk*' })
if ($mk.Count) { [Zee2.Pipe]::Run($root, $master, $out, '', $mk, 32, @(0xF2C94C, 0xD49A2A, 0x8A5A1A, 0xD8283C, 0x8E1A2A)) | Out-Null }


# Manifest
$strips = [ordered]@{}
foreach ($s in $sheets) { $strips[$s.Name] = [ordered]@{ file = "zee_$($s.Name).png"; frames = $s.N; cols = [Math]::Min($s.N, [Zee2.Pipe]::MAX_COLS) } }
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
    cell      = [ordered]@{ w = [Zee2.Pipe]::CW; h = [Zee2.Pipe]::CH }
    anchor    = [ordered]@{ x = [Zee2.Pipe]::ANCHOR_X; y = [Zee2.Pipe]::BASE_Y }
    drawScale = 132.0 / [Zee2.Pipe]::TARGET_STAND     # game units per sprite pixel (frames are built at 2x)
    standingHeightPx = [int][Zee2.Pipe]::TARGET_STAND
    facing    = 'right'
    strips    = $strips
    animations = $animTable
}
$json = $manifest | ConvertTo-Json -Depth 6
$json | Out-File (Join-Path $out 'zee.manifest.json') -Encoding utf8
("window.ZEE_MANIFEST = " + $json + ";") | Out-File (Join-Path $out 'zee.manifest.js') -Encoding utf8
Write-Host "built $($sheets.Count) strips, $($anims.Count) animations -> $out"
