# Makes a contact sheet of every frame of one built enemy (tools\debug\review-<id>.png) so the result can be checked by eye.
param([Parameter(Mandatory)][string]$Id, [int]$Cell = 150)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "assets\characters\$Id"
$m = (Get-Content (Join-Path $dir "$Id.manifest.json") -Raw).TrimStart([char]0xFEFF) | ConvertFrom-Json
$cw = $m.cell.w; $ch = $m.cell.h; $dh = [int]($Cell * $ch / $cw)
$strips = @($m.strips.PSObject.Properties.Name)
$out = New-Object Drawing.Bitmap ($Cell * 16), ($dh * $strips.Count)
$g = [Drawing.Graphics]::FromImage($out); $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear([Drawing.Color]::FromArgb(122, 114, 134))
for ($r = 0; $r -lt $strips.Count; $r++) {
    $s = $m.strips.($strips[$r]); $src = [Drawing.Bitmap]::FromFile((Join-Path $dir $s.file))
    for ($i = 0; $i -lt $s.frames; $i++) {
        $sr = [Drawing.Rectangle]::new(($i % $s.cols) * $cw, [int][math]::Floor($i / $s.cols) * $ch, $cw, $ch)
        $g.DrawImage($src, [Drawing.Rectangle]::new($i * $Cell, $r * $dh, $Cell, $dh), $sr, 'Pixel')
    }
    $src.Dispose()
}
New-Item -ItemType Directory -Force (Join-Path $root 'tools\debug') | Out-Null
$path = Join-Path $root "tools\debug\review-$Id.png"; $out.Save($path); $g.Dispose(); $out.Dispose(); $path
