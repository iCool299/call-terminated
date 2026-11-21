# Makes an enemy's walk strip a smooth closed loop: measures how different neighbouring frames are (silhouette + colour), finds the
# smoothest cyclic order of the frames (Held-Karp), keeps the direction closest to the order they were generated in, and rewrites the
# strip only if that is clearly smoother than the current order.
# Usage: powershell -ExecutionPolicy Bypass -File tools\order-walk.ps1 -Id fighter [-Force]
param([Parameter(Mandatory)][string]$Id, [switch]$Force)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Collections.Generic;
public static class WalkOrder {
  public static byte[] Load(string path, out int w, out int h) {
    using (var b = new Bitmap(path)) { w = b.Width; h = b.Height;
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var r = new byte[w*h*4]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0, r, 0, r.Length); b.UnlockBits(d); return r; } }
  public static double Diff(byte[] a, int w, int cw, int ch, int cols, int i, int j) {
    long sum = 0, n = 0; int ax = (i % cols) * cw, ay = (i / cols) * ch, bx = (j % cols) * cw, by = (j / cols) * ch;
    for (int y = 0; y < ch; y += 2) for (int x = 0; x < cw; x += 2) {
      int p = ((ay+y)*w + ax+x)*4, q = ((by+y)*w + bx+x)*4; bool oa = a[p+3] > 128, ob = a[q+3] > 128; if (!oa && !ob) continue; n++;
      if (oa != ob) { sum += 255; continue; }
      sum += (Math.Abs(a[p]-a[q]) + Math.Abs(a[p+1]-a[q+1]) + Math.Abs(a[p+2]-a[q+2])) / 3; }
    return n == 0 ? 0 : (double)sum / n; }
  // feet-band stats: width of the lowest 7% of the figure, its pixel count, and the figure height
  public static double[] Foot(byte[] a, int w, int cw, int ch, int cols, int i) {
    int ax = (i % cols) * cw, ay = (i / cols) * ch, y0 = ch, y1 = -1;
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) if (a[((ay+y)*w + ax+x)*4+3] > 128) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    double h = y1 - y0 + 1; int band = (int)Math.Max(3, 0.07 * h), mn = cw, mx = -1; long cnt = 0;
    for (int y = Math.Max(0, y1 - band); y <= y1; y++) for (int x = 0; x < cw; x++) if (a[((ay+y)*w + ax+x)*4+3] > 128) { cnt++; if (x < mn) mn = x; if (x > mx) mx = x; }
    return new double[]{ mx - mn + 1, cnt, h };
  }
  public static double Cost(double[,] D, int[] order) { double c = 0; for (int k = 0; k < order.Length; k++) c += D[order[k], order[(k+1) % order.Length]]; return c; }
  // minimum-cost closed tour through all n frames, starting and ending at 0
  public static int[] BestTour(double[,] D, int n) {
    int S = 1 << n; double[,] dp = new double[S, n]; int[,] par = new int[S, n];
    for (int s = 0; s < S; s++) for (int i = 0; i < n; i++) { dp[s,i] = 1e18; par[s,i] = -1; }
    dp[1,0] = 0;
    for (int s = 1; s < S; s++) { if ((s & 1) == 0) continue;
      for (int i = 0; i < n; i++) { if ((s & (1<<i)) == 0 || dp[s,i] >= 1e17) continue;
        for (int j = 1; j < n; j++) { if ((s & (1<<j)) != 0) continue; int t = s | (1<<j); double v = dp[s,i] + D[i,j]; if (v < dp[t,j]) { dp[t,j] = v; par[t,j] = i; } } } }
    int full = S - 1, last = -1; double best = 1e18;
    for (int i = 1; i < n; i++) { double v = dp[full,i] + D[i,0]; if (v < best) { best = v; last = i; } }
    var rev = new List<int>(); int cur = last, mask = full;
    while (cur != -1) { rev.Add(cur); int p = par[mask,cur]; mask ^= (1<<cur); cur = p; }
    rev.Reverse(); return rev.ToArray(); }
}
'@
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "assets\characters\$Id"
$manPath = Join-Path $dir "$Id.manifest.json"
$m = (Get-Content $manPath -Raw).TrimStart([char]0xFEFF) | ConvertFrom-Json
$a = $m.animations.walk; $s = $m.strips.($a.strip)
if ($a.strip -ne 'w') { Write-Host "$Id walk is not a 'w' strip - nothing to do"; exit }
$cw = $m.cell.w; $ch = $m.cell.h; $n = 12; $cols = $s.cols
$path = Join-Path $dir $s.file
$w = 0; $h = 0; $px = [WalkOrder]::Load($path, [ref]$w, [ref]$h)
# 1) drop "standing still" frames (both feet together on the floor): a real walk cycle has none, they make it pause
$ext = @(); $cnt = @(); for ($i = 0; $i -lt $n; $i++) { $f = [WalkOrder]::Foot($px, $w, $cw, $ch, $cols, $i); $ext += $f[0]; $cnt += $f[1] }
$extMax = ($ext | Measure-Object -Maximum).Maximum; $cntMax = ($cnt | Measure-Object -Maximum).Maximum
Write-Host ("  ext/extMax: {0} | cnt/cntMax: {1}" -f (($ext | % { [math]::Round($_ / $extMax,2) }) -join " "), (($cnt | % { [math]::Round($_ / $cntMax,2) }) -join " "))
$keep = @(); $dropped = @(); for ($i = 0; $i -lt $n; $i++) { if ($ext[$i] -lt 0.66 * $extMax -and $cnt[$i] -ge 0.7 * $cntMax) { $dropped += $i } else { $keep += $i } }
$dropFile = Join-Path $PSScriptRoot "walk-drop-$Id.txt"          # optional: source frame numbers (0-based, comma separated) to drop by hand after a visual check
if (Test-Path $dropFile) { $extra = @((Get-Content $dropFile -Raw) -split '[,\s]+' | Where-Object { $_ -ne '' } | ForEach-Object { [int]$_ }); $keep = @($keep | Where-Object { $extra -notcontains $_ }); $dropped = @($dropped + ($extra | Where-Object { $_ -ge 0 -and $_ -lt $n })) | Sort-Object -Unique }
if ($keep.Count -lt 6) { $keep = 0..($n - 1); $dropped = @() }
$mm = $keep.Count
$D = New-Object 'double[,]' $mm, $mm
for ($i = 0; $i -lt $mm; $i++) { for ($j = 0; $j -lt $mm; $j++) { if ($i -ne $j) { $D[$i,$j] = [WalkOrder]::Diff($px, $w, $cw, $ch, $cols, $keep[$i], $keep[$j]) } } }
$orig = 0..($mm - 1); $origCost = [WalkOrder]::Cost($D, [int[]]$orig)
$tour = [int[]][WalkOrder]::BestTour($D, $mm); $tourCost = [WalkOrder]::Cost($D, $tour)
# direction: keep the one that follows the generated order more often
$inc = 0; $dec = 0; for ($k = 0; $k -lt $mm; $k++) { $x = $tour[$k]; $y = $tour[($k + 1) % $mm]; if ($keep[$y] -gt $keep[$x]) { $inc++ } else { $dec++ } }
if ($dec -gt $inc) { [array]::Reverse($tour) }
# 2) drop near-duplicate neighbours (the same pose twice makes the walk hitch): while two neighbours differ much less than a normal step, remove one
$st0 = @(); for ($k = 0; $k -lt $tour.Count; $k++) { $ia = [int]$tour[$k]; $ib = [int]$tour[($k + 1) % $tour.Count]; $st0 += $D[$ia, $ib] }
$med0 = @($st0 | Sort-Object)[[int]($st0.Count / 2)]
$t2 = New-Object System.Collections.ArrayList; foreach ($v in $tour) { [void]$t2.Add([int]$v) }
$dups = @()
while ($t2.Count -gt 6) {
    $bestK = -1; $bestV = 1e9
    for ($k = 0; $k -lt $t2.Count; $k++) { $ia = [int]$t2[$k]; $ib = [int]$t2[($k + 1) % $t2.Count]; $v = $D[$ia, $ib]; if ($v -lt $bestV) { $bestV = $v; $bestK = ($k + 1) % $t2.Count } }
    if ($bestV -ge 0.62 * $med0) { break }
    $dups += $keep[$t2[$bestK]]; $t2.RemoveAt($bestK)
}
if ($dups.Count) { Write-Host ("  near-duplicate frames dropped: [{0}]" -f ($dups -join ',')); $dropped = @($dropped + $dups) }
$tour = [int[]]$t2.ToArray(); $mm = $tour.Count
$final = @($tour | ForEach-Object { $keep[$_] })
$steps = @(); for ($k = 0; $k -lt $mm; $k++) { $ia = [int]$tour[$k]; $ib = [int]$tour[($k + 1) % $mm]; $dv = $D[$ia, $ib]; $steps += [math]::Round($dv, 1) }
$med = @($steps | Sort-Object)[[int]($mm / 2)]; $out = @($steps | Where-Object { $_ -gt 1.6 * $med }).Count
Write-Host ("{0}: {1} frames kept, standing frames dropped: [{2}]; smoothest loop (source frames) {3}" -f $Id, $mm, ($dropped -join ','), ($final -join ' '))
Write-Host ("  step diffs (last = seam): {0}   median {1}   outliers(>1.6x): {2}" -f ($steps -join ' '), $med, $out)
if ($dropped.Count -eq 0 -and -not $Force -and $tourCost -gt 0.9 * $origCost) { Write-Host "  current order is already within 10% of the smoothest - kept"; exit }
$src = [Drawing.Bitmap]::FromFile($path); $dst = New-Object Drawing.Bitmap $src.Width, $src.Height
$g = [Drawing.Graphics]::FromImage($dst); $g.CompositingMode = 'SourceCopy'
for ($k = 0; $k -lt $mm; $k++) {
    $f = $final[$k]
    $sr = [Drawing.Rectangle]::new(($f % $cols) * $cw, [int][math]::Floor($f / $cols) * $ch, $cw, $ch)
    $dr = [Drawing.Rectangle]::new(($k % $cols) * $cw, [int][math]::Floor($k / $cols) * $ch, $cw, $ch)
    $g.DrawImage($src, $dr, $sr, 'Pixel')
}
$g.Dispose(); $src.Dispose(); $tmp = "$path.tmp.png"; $dst.Save($tmp); $dst.Dispose(); Move-Item $tmp $path -Force
# the walk animation now has $mm frames; keep the same cycle duration
$m.animations.walk.from = 0; $m.animations.walk.to = $mm - 1; $m.animations.walk.fps = [math]::Round(14.0 * $mm / 12, 2)
$m | ConvertTo-Json -Depth 6 | Out-File $manPath -Encoding ascii
Write-Host "  walk strip rewritten: $mm frames at $($m.animations.walk.fps) fps"