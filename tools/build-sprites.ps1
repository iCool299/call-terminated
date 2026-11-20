# Rebuilds Zee's game-ready sprite strips from the raw sheets in sprites/main-character.
# Usage: powershell -File tools\build-sprites.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Add-Type -ReferencedAssemblies System.Drawing, PresentationCore, WindowsBase, System.Xaml -Path (Join-Path $PSScriptRoot 'SpritePipeline.cs')

function Cfg($name, $file, $n, $fps, $loop, $standH, $isRef, $clean) {
    $c = New-Object Zee.StripCfg
    $c.Name = $name; $c.Path = "sprites\main-character\$file"; $c.N = $n; $c.Fps = $fps; $c.Loop = $loop
    $c.StandH = $standH; $c.IsRef = $isRef; $c.CleanFrame = $clean
    return $c
}

# standH = how many SOURCE pixels tall a standing Zee would be in that sheet (calibrates scale per sheet).
$cfgs = @(
    (Cfg 'idle'        'Idle.png'        8  6 $true  0 $true  -1),
    (Cfg 'idle_makeup' 'Idle Makeup.png' 8  8 $false 0 $true  -1),
    (Cfg 'walk'        'Walk.png'        6 10 $true  0 $true  -1),
    (Cfg 'run'         'Run.webp'        6 14 $true  0 $false -1),
    (Cfg 'punch_1'     'Punch 1.webp'    4 14 $false 0 $false 2),
    (Cfg 'punch_2'     'Punch 2.webp'    4 14 $false 0 $false -1),
    (Cfg 'hurt'        'Hurt.webp'       2  6 $false 0 $false -1)
)
if (Test-Path (Join-Path $PSScriptRoot 'calibration.ps1')) { . (Join-Path $PSScriptRoot 'calibration.ps1') }

$out = Join-Path $root 'assets\characters\zee'
$sheetDir = Join-Path $root 'tools\debug'
New-Item -ItemType Directory -Force $sheetDir | Out-Null
$log = [Zee.Pipeline]::Run($root, $out, (Join-Path $sheetDir 'sheet.png'), $cfgs, 40)
$log
