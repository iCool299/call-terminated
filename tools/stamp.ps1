# Stamps every module import, asset URL root and the entry script with a fresh ?v=<timestamp> (so browsers/phones never serve stale files).
# release.ps1 runs the same thing before committing; run this alone to test locally with a fresh cache.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ver = Get-Date -Format 'yyyyMMddHHmm'
$utf8 = New-Object System.Text.UTF8Encoding($false)      # always read/write UTF-8 (the default PowerShell encoding corrupts files)
foreach ($f in 'src\main.js', 'src\zee.js', 'src\assets.js', 'src\input.js', 'src\enemy.js', 'src\game.js', 'src\sfx.js', 'src\hud.js', 'src\level.js', 'src\camera.js') {
    $p = Join-Path $root $f
    $t = [IO.File]::ReadAllText($p, $utf8)
    $t = [regex]::Replace($t, "from '(\./(?:config|assets|input|zee|enemy|game|sfx|hud|level|camera))\.js(\?v=[0-9a-z]+)?'", "from '`$1.js?v=$ver'")
    [IO.File]::WriteAllText($p, $t, $utf8)
}
$p = Join-Path $root 'index.html'
$h = [IO.File]::ReadAllText($p, $utf8)
$h = [regex]::Replace($h, 'src="src/main\.js(\?v=[0-9a-z]+)?"', "src=`"src/main.js?v=$ver`"")
[IO.File]::WriteAllText($p, $h, $utf8)
Write-Host "stamped version $ver"
