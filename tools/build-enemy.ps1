# Builds one enemy's game-ready strips + manifest from its raw ChatGPT sheets, with the same finishing pipeline as Zee
# (edge-preserving smoothing, palette locked to the enemy's master, texture stabiliser, temporal consensus).
# Usage: powershell -ExecutionPolicy Bypass -File tools\build-enemy.ps1 -Id navy
param([Parameter(Mandatory)][string]$Id)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Add-Type -ReferencedAssemblies System.Drawing -Path (Join-Path $PSScriptRoot 'ZeePipeline.cs')
. (Join-Path $PSScriptRoot 'enemies.ps1')
$e = $enemies[$Id]; if (-not $e) { throw "unknown enemy id '$Id' (use: $($enemies.Keys -join ', '))" }

# cell geometry from the character's height: standing = 2x game height in px, with head/foot room; wide for kicks and throws
$H = [double]$e.H; $stand = 2 * $H
$ch = [int]([Math]::Ceiling($stand * 1.2 / 8) * 8); $cw = [int]([Math]::Ceiling($ch * 1.25 / 16) * 16)
if ($e.cell) { $cw = $e.cell[0]; $ch = $e.cell[1] }       # grabbers get a taller cell: Zee is lifted overhead inside their sheet
[Zee2.Pipe]::Configure($cw, $ch, [int]($cw / 2), $ch - 24, $stand)
[Zee2.Pipe]::Prefix = "${Id}_"

$sheets = @()
$sheetList = if ($e.v2) { Get-EnemySheetsV2 $e.grab ([bool]$e.flex) $e.frames } else { Get-EnemySheets $e.grab $(if ($e.wRows) { $e.wRows } else { 3 }) ([bool]$e.flex) }
foreach ($s in $sheetList) {
    $raw = "sprites\agents\raw\${Id}_$($s.name).png"
    if (-not (Test-Path (Join-Path $root $raw))) { Write-Host "missing $raw - skipped"; continue }
    $c = New-Object Zee2.SheetCfg
    $c.Name = $s.name; $c.Path = $raw; $c.N = $s.n; $c.Rows = $s.rows; $c.StandH = -1      # -1 = calibrate from the neutral first frame
    if ($s.feet) { $c.FeetAnchor = $true }
    if ($s.median) { $c.StandH = 0 }                                                          # 0 = scale by the median frame height (walk sheets have no standing frame)
    if ($s.standH) { $c.StandH = $s.standH }                                                  # explicit standing height (source px) when frame 1 can't calibrate it
    $anchFile = Join-Path $PSScriptRoot "anchors-$Id-$($s.name).txt"                          # optional per-frame x anchors (source px), one per line, blank = auto
    if (Test-Path $anchFile) { $c.Anchors = @(Get-Content $anchFile | ForEach-Object { if ($_.Trim() -eq '') { [double]::NaN } else { [double]$_ } }) }
    $sheets += $c
}
if ($sheets.Count -eq 0) { throw "no raw sheets found for $Id" }

$out = Join-Path $root "assets\characters\$Id"
New-Item -ItemType Directory -Force $out | Out-Null
$dbg = Join-Path $root 'tools\debug'; New-Item -ItemType Directory -Force $dbg | Out-Null
$masterPath = Join-Path $root $e.master; $palN = 32
if ($e.grab) {
    # grabbers' sheet also contains Zee, so the palette must hold her colours too: build a side-by-side master (enemy + Zee)
    Add-Type -AssemblyName System.Drawing
    $a = [Drawing.Bitmap]::FromFile($masterPath); $z = [Drawing.Bitmap]::FromFile((Join-Path $root 'sprites\zee\master\zee_master_idle_v2.png'))
    $both = New-Object Drawing.Bitmap ($a.Width + $z.Width), ([Math]::Max($a.Height, $z.Height))
    $g = [Drawing.Graphics]::FromImage($both); $g.Clear([Drawing.Color]::FromArgb(0, 255, 0)); $g.DrawImage($a, 0, 0, $a.Width, $a.Height); $g.DrawImage($z, $a.Width, 0, $z.Width, $z.Height); $g.Dispose()
    $masterPath = Join-Path $root "tools\debug\palette-master-$Id.png"; $both.Save($masterPath); $a.Dispose(); $z.Dispose(); $both.Dispose(); $palN = 46
}
if ($e.v2) {
    # v2: the palette is taken from his own drawings (model sheet + idle + walk sheets, + Zee for grabbers) with many more colours,
    # so the suit, skin and shading keep their real tones instead of snapping to a few shared shades
    Add-Type -AssemblyName System.Drawing
    $parts = @((Join-Path $root $e.master), (Join-Path $root "sprites\agents\raw\${Id}_idle.png"), (Join-Path $root "sprites\agents\raw\${Id}_walk.png"))
    if ($e.grab) { $parts += (Join-Path $root 'sprites\zee\master\zee_master_idle_v2.png') }
    $imgs = @($parts | Where-Object { Test-Path $_ } | ForEach-Object { [Drawing.Bitmap]::FromFile($_) })
    $pw = 0; $ph = 0; foreach ($im in $imgs) { $pw += $im.Width; $ph = [Math]::Max($ph, $im.Height) }
    $all = New-Object Drawing.Bitmap $pw, $ph; $g = [Drawing.Graphics]::FromImage($all); $g.Clear([Drawing.Color]::FromArgb(0, 255, 0)); $x = 0
    foreach ($im in $imgs) { $g.DrawImage($im, $x, 0, $im.Width, $im.Height); $x += $im.Width; $im.Dispose() }
    $g.Dispose(); $masterPath = Join-Path $root "tools\debug\palette-master-$Id.png"; $all.Save($masterPath); $all.Dispose(); $palN = 128
}
$log = [Zee2.Pipe]::Run($root, $masterPath, $out, '', $sheets, $palN, @())
$log | Out-File (Join-Path $dbg "enemy-$Id.log") -Encoding utf8

$have = @($sheets | % { $_.Name })
$strips = [ordered]@{}
foreach ($s in $sheets) { $strips[$s.Name] = [ordered]@{ file = "${Id}_$($s.Name).png"; frames = $s.N; cols = [Math]::Min($s.N, [Zee2.Pipe]::MAX_COLS) } }
$anims = [ordered]@{}
$counts = @{}; foreach ($s in $sheets) { $counts[$s.Name] = $s.N }
$animList = if ($e.v2) { Get-EnemyAnimsV2 $e.grab $have $counts } else { Get-EnemyAnims $e.grab ($have -contains 'w') ($have -contains 'f') }
foreach ($a in $animList) {
    if ($have -notcontains $a.strip) { continue }
    $x = [ordered]@{ strip = $a.strip; from = $a.from; to = $a.to; fps = $a.fps; loop = [bool]$a.loop }
    if ($a.pingpong) { $x.pingpong = $true }
    if ($a.active)  { $x.active = @($a.active) }
    if ($a.release) { $x.release = @($a.release) }
    $anims[$a.name] = $x
}
$manifest = [ordered]@{
    character = $Id; grab = [bool]$e.grab; gameHeight = $H
    cell = [ordered]@{ w = $cw; h = $ch }
    anchor = [ordered]@{ x = [int]($cw / 2); y = $ch - 24 }
    drawScale = 0.5
    facing = 'right'; strips = $strips; animations = $anims
}
$manifest | ConvertTo-Json -Depth 6 | Out-File (Join-Path $out "$Id.manifest.json") -Encoding ascii
if ($have -contains 'w') { & (Join-Path $PSScriptRoot 'order-walk.ps1') -Id $Id }
# head lock: one clean head pasted on every walk / idle frame (stops the face redrawing slightly differently each frame)
foreach ($an in 'walk', 'idle') { & (Join-Path $PSScriptRoot 'lock-head.ps1') -Id $Id -Anim $an | Out-Null }            # smoothest walk loop (always run after a build)
Write-Host "built $Id :$($sheets.Count) strips, $($anims.Count) animations (cell ${cw}x${ch}) -> $out"

if ($e.v2) {      # every animation in the idle's colours, so nothing changes colour between moves
    & (Join-Path $PSScriptRoot "match-hue.ps1") -Id $Id | Out-Null                               # per hue group: overall brightness / saturation
    1..2 | ForEach-Object { & (Join-Path $PSScriptRoot "match-colors.ps1") -Id $Id | Out-Null }   # per colour region (last): catches hue shifts (a garment drawn a different shade)
}
