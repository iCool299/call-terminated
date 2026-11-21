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
$m = (Get-Content (Join-Path $dir "$Id.manifest.json") -Raw).TrimStart([char]0xFEFF) | ConvertFrom-Json
$a = $m.animations.walk; $s = $m.strips.($a.strip)
if ($a.strip -ne 'w') { Write-Host "$Id walk is not a 'w' strip - nothing to do"; exit }
$cw = $m.cell.w; $ch = $m.cell.h; $n = $a.to - $a.from + 1; $cols = $s.cols
$path = Join-Path $dir $s.file
$w = 0; $h = 0; $px = [WalkOrder]::Load($path, [ref]$w, [ref]$h)
$D = New-Object 'double[,]' $n, $n
for ($i = 0; $i -lt $n; $i++) { for ($j = 0; $j -lt $n; $j++) { if ($i -ne $j) { $D[$i,$j] = [WalkOrder]::Diff($px, $w, $cw, $ch, $cols, $i, $j) } } }
$orig = 0..($n - 1); $origCost = [WalkOrder]::Cost($D, [int[]]$orig)
$tour = [int[]][WalkOrder]::BestTour($D, $n); $tourCost = [WalkOrder]::Cost($D, $tour)
# direction: keep the one that follows the generated order more often
$inc = 0; $dec = 0; for ($k = 0; $k -lt $n; $k++) { $x = $tour[$k]; $y = $tour[($k + 1) % $n]; if ($y -eq (($x + 1) % $n)) { $inc++ } elseif ($x -eq (($y + 1) % $n)) { $dec++ } }
$score = 0; for ($k = 0; $k -lt $n; $k++) { $x = $tour[$k]; $y = $tour[($k + 1) % $n]; $score += [math]::Sign($y - $x) }
if ($dec -gt $inc -or ($dec -eq $inc -and $score -lt 0)) { [array]::Reverse($tour) }
Write-Host ("{0}: current order cost {1:0.0}, smoothest loop cost {2:0.0}  (order {3})" -f $Id, $origCost, $tourCost, ($tour -join ' '))
if (-not $Force -and $tourCost -gt 0.9 * $origCost) { Write-Host "  current order is already within 10% of the smoothest - kept"; exit }
$src = [Drawing.Bitmap]::FromFile($path); $dst = New-Object Drawing.Bitmap $src.Width, $src.Height
$g = [Drawing.Graphics]::FromImage($dst); $g.CompositingMode = 'SourceCopy'
for ($k = 0; $k -lt $n; $k++) {
    $f = $tour[$k]
    $sr = [Drawing.Rectangle]::new(($f % $cols) * $cw, [int][math]::Floor($f / $cols) * $ch, $cw, $ch)
    $dr = [Drawing.Rectangle]::new(($k % $cols) * $cw, [int][math]::Floor($k / $cols) * $ch, $cw, $ch)
    $g.DrawImage($src, $dr, $sr, 'Pixel')
}
$g.Dispose(); $src.Dispose(); $tmp = "$path.tmp.png"; $dst.Save($tmp); $dst.Dispose(); Move-Item $tmp $path -Force
Write-Host "  walk strip reordered into the smoothest loop"
