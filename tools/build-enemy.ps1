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
[Zee2.Pipe]::Configure($cw, $ch, [int]($cw / 2), $ch - 24, $stand)
[Zee2.Pipe]::Prefix = "${Id}_"

$sheets = @()
foreach ($s in (Get-EnemySheets $e.grab)) {
    $raw = "sprites\agents\raw\${Id}_$($s.name).png"
    if (-not (Test-Path (Join-Path $root $raw))) { Write-Host "missing $raw - skipped"; continue }
    $c = New-Object Zee2.SheetCfg
    $c.Name = $s.name; $c.Path = $raw; $c.N = $s.n; $c.Rows = $s.rows; $c.StandH = -1      # -1 = calibrate from the neutral first frame
    $sheets += $c
}
if ($sheets.Count -eq 0) { throw "no raw sheets found for $Id" }

$out = Join-Path $root "assets\characters\$Id"
New-Item -ItemType Directory -Force $out | Out-Null
$dbg = Join-Path $root 'tools\debug'; New-Item -ItemType Directory -Force $dbg | Out-Null
$log = [Zee2.Pipe]::Run($root, (Join-Path $root $e.master), $out, '', $sheets, 32, @())
$log | Out-File (Join-Path $dbg "enemy-$Id.log") -Encoding utf8

$have = @($sheets | % { $_.Name })
$strips = [ordered]@{}
foreach ($s in $sheets) { $strips[$s.Name] = [ordered]@{ file = "${Id}_$($s.Name).png"; frames = $s.N; cols = [Math]::Min($s.N, [Zee2.Pipe]::MAX_COLS) } }
$anims = [ordered]@{}
foreach ($a in (Get-EnemyAnims $e.grab)) {
    if ($have -notcontains $a.strip) { continue }
    $x = [ordered]@{ strip = $a.strip; from = $a.from; to = $a.to; fps = $a.fps; loop = [bool]$a.loop }
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
Write-Host "built $Id : $($sheets.Count) strips, $($anims.Count) animations (cell ${cw}x${ch}) -> $out"
