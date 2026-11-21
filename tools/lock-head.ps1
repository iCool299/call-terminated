# Head lock: generated frames redraw the face/hair slightly differently every frame, which reads as "AI wobble".
# This takes ONE clean head (from a reference frame of the same animation) and pastes it onto every frame of that animation,
# at the position where that frame's own head is (found by matching), so the head moves with the body but never changes shape.
# Usage: powershell -ExecutionPolicy Bypass -File tools\lock-head.ps1 -Id navy -Anim walk [-Ref 0] [-HeadShare 0.17]
param([Parameter(Mandatory)][string]$Id, [Parameter(Mandatory)][string]$Anim, [int]$Ref = 0, [double]$HeadShare = 0.17)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging;
public static class HeadLock {
  public static int[] Load(string path, out int w, out int h) {
    using (var b = new Bitmap(path)) { w = b.Width; h = b.Height;
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var r = new int[w*h]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0, r, 0, r.Length); b.UnlockBits(d); return r; } }
  public static void Save(string path, int[] px, int w, int h) {
    using (var b = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(px, 0, d.Scan0, px.Length); b.UnlockBits(d); b.Save(path); } }
  static bool Op(int p) { return ((uint)p >> 24) > 128; }
  static int Top(int[] px, int w, int ox, int oy, int cw, int ch) {
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) if (Op(px[(oy+y)*w + ox+x])) return y; return 0; }
  static int Bot(int[] px, int w, int ox, int oy, int cw, int ch) {
    for (int y = ch - 1; y >= 0; y--) for (int x = 0; x < cw; x++) if (Op(px[(oy+y)*w + ox+x])) return y; return ch - 1; }
  // returns a log line; edits px in place
  public static string Run(int[] px, int w, int cw, int ch, int cols, int from, int n, int refIdx, double share) {
    int ri = from + refIdx, rx = (ri % cols) * cw, ry = (ri / cols) * ch;
    int rt = Top(px, w, rx, ry, cw, ch), rb = Bot(px, w, rx, ry, cw, ch);
    int hh = (int)((rb - rt + 1) * share);
    // reference head pixels
    int[] head = new int[cw * hh]; int hx0 = cw, hx1 = -1;
    for (int y = 0; y < hh; y++) for (int x = 0; x < cw; x++) { int p = px[(ry + rt + y)*w + rx + x]; head[y*cw + x] = p; if (Op(p)) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; } }
    var log = new System.Text.StringBuilder();
    for (int k = 0; k < n; k++) {
      if (k == refIdx) continue;
      int fi = from + k, fx = (fi % cols) * cw, fy = (fi / cols) * ch;
      int ft = Top(px, w, fx, fy, cw, ch);
      // find the offset where this frame's head best matches the reference head
      double best = double.MaxValue; int bdx = 0, bdy = 0;
      for (int dy = -6; dy <= 6; dy++) for (int dx = -14; dx <= 14; dx++) {
        double cost = 0; int cnt = 0;
        for (int y = 0; y < hh; y += 2) { int ty = ft + y + dy; if (ty < 0 || ty >= ch) { cost += 255 * cw; continue; }
          for (int x = hx0; x <= hx1; x += 2) { int tx = x + dx; if (tx < 0 || tx >= cw) continue;
            int a = head[y*cw + x], b = px[(fy + ty)*w + fx + tx]; bool oa = Op(a), ob = Op(b);
            if (!oa && !ob) continue; cnt++;
            if (oa != ob) { cost += 255; continue; }
            cost += (Math.Abs(((a>>16)&255)-((b>>16)&255)) + Math.Abs(((a>>8)&255)-((b>>8)&255)) + Math.Abs((a&255)-(b&255))) / 3.0; } }
        cost /= Math.Max(1, cnt); if (cost < best) { best = cost; bdx = dx; bdy = dy; } }
      // replace: clear this frame's head band (only near the head's columns), paste the reference head at the matched spot
      int y0 = ft + bdy, keepBand = 3;   // keep the bottom 3 rows of the band from the frame itself so the neck/collar joins cleanly
      for (int y = 0; y < hh - keepBand; y++) { int ty = y0 + y; if (ty < 0 || ty >= ch) continue;
        for (int x = Math.Max(0, hx0 + bdx - 4); x <= Math.Min(cw - 1, hx1 + bdx + 4); x++) px[(fy + ty)*w + fx + x] = 0; }
      for (int y = 0; y < hh; y++) { int ty = y0 + y; if (ty < 0 || ty >= ch) continue;
        for (int x = hx0; x <= hx1; x++) { int tx = x + bdx; if (tx < 0 || tx >= cw) continue; int a = head[y*cw + x];
          if (!Op(a)) continue; if (y >= hh - keepBand && Op(px[(fy + ty)*w + fx + tx])) continue; px[(fy + ty)*w + fx + tx] = a; } }
      log.AppendFormat("f{0}: offset ({1},{2}) match {3:0.0}\n", k + 1, bdx, bdy, best);
    }
    return log.ToString();
  }
}
'@
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "assets\characters\$Id"
$m = (Get-Content (Join-Path $dir "$Id.manifest.json") -Raw).TrimStart([char]0xFEFF) | ConvertFrom-Json
$a = $m.animations.$Anim; $s = $m.strips.($a.strip); $path = Join-Path $dir $s.file
$w = 0; $h = 0; $px = [HeadLock]::Load($path, [ref]$w, [ref]$h)
$log = [HeadLock]::Run($px, $w, $m.cell.w, $m.cell.h, $s.cols, $a.from, ($a.to - $a.from + 1), $Ref, $HeadShare)
[HeadLock]::Save("$path.tmp.png", $px, $w, $h); Move-Item "$path.tmp.png" $path -Force
Write-Host "$Id $Anim head locked to frame $($Ref + 1):"; Write-Host $log
