# Leg analysis for every frame of an enemy's walk strip (built strip 'w'): which foot is in front / lifted, and whether the FRONT leg is the
# near leg (drawn brighter) or the far leg (drawn darker). Used to assemble a two-step loop where the legs really alternate.
# Output per frame: spread (front-rear foot distance, px), lift of each foot (px above floor), brightness difference front-rear (+ = front leg is the near leg)
param([Parameter(Mandatory)][string]$Id, [string]$Strip = 'w', [int]$Frames = 12)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging;
public static class LegId {
  public static byte[] Load(string path, out int w, out int h) {
    using (var b = new Bitmap(path)) { w = b.Width; h = b.Height;
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var r = new byte[w*h*4]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0, r, 0, r.Length); b.UnlockBits(d); return r; } }
  // returns [frontX, rearX, frontLift, rearLift, brightnessFront, brightnessRear, height]
  public static double[] Analyse(byte[] a, int w, int cw, int ch, int cols, int i) {
    int ax = (i % cols) * cw, ay = (i / cols) * ch, y0 = ch, y1 = -1;
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) if (a[((ay+y)*w + ax+x)*4+3] > 128) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    int h = y1 - y0 + 1;
    // lower leg zone = bottom 28% of the figure; split its pixels into two feet at the largest x-gap of the column occupancy (or the median if overlapping)
    int zy0 = y1 - (int)(0.28 * h);
    int[] occ = new int[cw]; for (int y = zy0; y <= y1; y++) for (int x = 0; x < cw; x++) if (a[((ay+y)*w + ax+x)*4+3] > 128) occ[x]++;
    int mn = cw, mx = -1; for (int x = 0; x < cw; x++) if (occ[x] > 0) { if (x < mn) mn = x; if (x > mx) mx = x; }
    // find the split: widest empty gap inside [mn,mx]; if none, split at the middle
    int bestGap = 0, split = (mn + mx) / 2, run = 0, runStart = -1;
    for (int x = mn; x <= mx; x++) { if (occ[x] == 0) { if (run == 0) runStart = x; run++; if (run > bestGap) { bestGap = run; split = runStart + run / 2; } } else run = 0; }
    double[] res = new double[7]; double[] fx = new double[2], ly = new double[2], br = new double[2]; int[] cnt = new int[2];
    for (int s = 0; s < 2; s++) { ly[s] = y1; }
    int[] low = { y0, y0 };
    long[] sx = new long[2], n = new long[2]; double[] sb = new double[2]; long[] nb = new long[2];
    for (int y = zy0; y <= y1; y++) for (int x = mn; x <= mx; x++) {
      int p = ((ay+y)*w + ax+x)*4; if (a[p+3] <= 128) continue; int s = x < split ? 0 : 1;
      sx[s] += x; n[s]++; if (y > low[s]) low[s] = y;
      double L = 0.3 * a[p+2] + 0.59 * a[p+1] + 0.11 * a[p];   // BGRA
      if (L > 45) { sb[s] += L; nb[s]++; }
    }
    for (int s = 0; s < 2; s++) { fx[s] = n[s] > 0 ? (double)sx[s] / n[s] : 0; br[s] = nb[s] > 0 ? sb[s] / nb[s] : 0; }
    // s=0 is the left half (rear foot when walking right), s=1 the right half (front foot)
    res[0] = fx[1]; res[1] = fx[0]; res[2] = y1 - low[1]; res[3] = y1 - low[0]; res[4] = br[1]; res[5] = br[0]; res[6] = h;
    return res;
  }
}
'@
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "assets\characters\$Id"
$m = (Get-Content (Join-Path $dir "$Id.manifest.json") -Raw).TrimStart([char]0xFEFF) | ConvertFrom-Json
$s = $m.strips.$Strip; $cw = $m.cell.w; $ch = $m.cell.h
$w = 0; $h = 0; $px = [LegId]::Load((Join-Path $dir $s.file), [ref]$w, [ref]$h)
for ($i = 0; $i -lt $Frames; $i++) {
    $r = [LegId]::Analyse($px, $w, $cw, $ch, $s.cols, $i)
    "{0,2}: spread {1,4:0}  lift(front/rear) {2,3:0}/{3,3:0}  bright(front/rear) {4,4:0}/{5,4:0}  d={6,5:0}  {7}" -f ($i + 1), ($r[0] - $r[1]), $r[2], $r[3], $r[4], $r[5], ($r[4] - $r[5]), $(if (($r[4] - $r[5]) -gt 6) { 'FRONT=near' } elseif (($r[4] - $r[5]) -lt -6) { 'FRONT=far' } else { '?' })
}
