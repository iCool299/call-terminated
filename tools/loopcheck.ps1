# Loop / stability report for every enemy: per-frame silhouette box (height, feet y, centre x) and the pixel difference between neighbouring frames.
# A looping animation is good when the seam (last -> first) is no bigger than the other steps.
param([string[]]$Ids = @('navy','polo','plum','cream','fighter','gangly','curvy','sporty'))
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging;
public static class LC {
  public static byte[] Load(string path, out int w, out int h) {
    using (var b = new Bitmap(path)) { w = b.Width; h = b.Height;
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var r = new byte[w*h*4]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0, r, 0, r.Length); b.UnlockBits(d); return r; } }
  // mean abs colour difference over pixels that are opaque in either frame (alpha mismatch counts as 255)
  public static double Diff(byte[] a, byte[] b, int w, int h, int cw, int ch, int cols, int i, int j) {
    long sum = 0, n = 0;
    int ax = (i % cols) * cw, ay = (i / cols) * ch, bx = (j % cols) * cw, by = (j / cols) * ch;
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) {
      int p = ((ay+y)*w + ax+x)*4, q = ((by+y)*w + bx+x)*4;
      bool oa = a[p+3] > 128, ob = b[q+3] > 128; if (!oa && !ob) continue; n++;
      if (oa != ob) { sum += 255; continue; }
      sum += (Math.Abs(a[p]-b[q]) + Math.Abs(a[p+1]-b[q+1]) + Math.Abs(a[p+2]-b[q+2])) / 3;
    }
    return n == 0 ? 0 : (double)sum / n;
  }
  // centroid x of the opaque pixels, and of the lowest 25% (the legs)
  public static double[] Cent(byte[] a, int w, int cw, int ch, int cols, int i) {
    int ax = (i % cols) * cw, ay = (i / cols) * ch, y1 = -1, y0 = ch;
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) if (a[((ay+y)*w + ax+x)*4+3] > 128) { if (y<y0) y0=y; if (y>y1) y1=y; }
    int cut = y1 - (y1 - y0) / 4; double sa = 0, na = 0, sl = 0, nl = 0;
    for (int y = y0; y <= y1; y++) for (int x = 0; x < cw; x++) if (a[((ay+y)*w + ax+x)*4+3] > 128) { sa += x; na++; if (y >= cut) { sl += x; nl++; } }
    return new double[]{ na == 0 ? 0 : sa/na, nl == 0 ? 0 : sl/nl };
  }
  public static int[] Box(byte[] a, int w, int cw, int ch, int cols, int i) {
    int ax = (i % cols) * cw, ay = (i / cols) * ch, x0 = cw, x1 = -1, y0 = ch, y1 = -1;
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) if (a[((ay+y)*w + ax+x)*4+3] > 128) { if (x<x0) x0=x; if (x>x1) x1=x; if (y<y0) y0=y; if (y>y1) y1=y; }
    return new int[]{x0,x1,y0,y1};
  }
}
'@ -ReferencedAssemblies System.Drawing
$root = Split-Path -Parent $PSScriptRoot
foreach ($id in $Ids) {
  $dir = Join-Path $root "assets\characters\$id"
  $m = (Get-Content (Join-Path $dir "$id.manifest.json") -Raw).TrimStart([char]0xFEFF) | ConvertFrom-Json
  $cw = $m.cell.w; $ch = $m.cell.h
  Write-Host "=== $id (cell ${cw}x${ch})"
  foreach ($an in 'idle','walk') {
    $a = $m.animations.$an; $s = $m.strips.($a.strip)
    $w = 0; $h = 0; $px = [LC]::Load((Join-Path $dir $s.file), [ref]$w, [ref]$h)
    $n = $a.to - $a.from + 1; $d = @(); $boxes = @(); $cx = @(); $lx = @()
    for ($k = 0; $k -lt $n; $k++) {
      $i = $a.from + $k; $j = $a.from + (($k + 1) % $n)
      $d += [math]::Round([LC]::Diff($px, $px, $w, $h, $cw, $ch, $s.cols, $i, $j), 1)
      $bx = [LC]::Box($px, $w, $cw, $ch, $s.cols, $i); $boxes += ("{0}x{1}@{2}" -f ($bx[1]-$bx[0]), ($bx[3]-$bx[2]), $bx[3])
      $c = [LC]::Cent($px, $w, $cw, $ch, $s.cols, $i); $cx += [int]($c[0] - $cw/2); $lx += [int]($c[1] - $cw/2)
    }
    Write-Host ("        body cx offset: {0}   | legs cx offset: {1}" -f ($cx -join ' '), ($lx -join ' '))
    Write-Host ("  {0,-5} step diffs (last = seam): {1}" -f $an, ($d -join ' '))
    Write-Host ("        boxes wxh@feet: {0}" -f ($boxes -join ' '))
  }
}
