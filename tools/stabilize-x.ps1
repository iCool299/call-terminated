# Walk / run stabiliser: each generated frame is drawn at a slightly different spot in its cell, so after building, the body
# jumps sideways by a few pixels from frame to frame (reads as judder while walking). For every walk / run strip this measures
# each frame's head centre (top 18% of the body) and shifts the whole frame sideways so all heads sit on the strip's median.
# Usage: powershell -ExecutionPolicy Bypass -File tools\stabilize-x.ps1 -Id navy
param([Parameter(Mandatory)][string]$Id)
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class StabX {
  public static string Run(string path, int cw, int ch, int frames, int cols) {
    int w, h; int[] px;
    using (var b = new Bitmap(path)) { w = b.Width; h = b.Height; var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      px = new int[w*h]; Marshal.Copy(d.Scan0, px, 0, px.Length); b.UnlockBits(d); }
    var hx = new double[frames];
    for (int f = 0; f < frames; f++) {
      int ox = (f % cols) * cw, oy = (f / cols) * ch, top = -1, bot = -1;
      for (int y = 0; y < ch && top < 0; y++) for (int x = 0; x < cw; x++) if (((px[(oy+y)*w+ox+x] >> 24) & 255) > 128) { top = y; break; }
      for (int y = ch - 1; y >= 0 && bot < 0; y--) for (int x = 0; x < cw; x++) if (((px[(oy+y)*w+ox+x] >> 24) & 255) > 128) { bot = y; break; }
      double s = 0; int n = 0; int y1 = top + (int)((bot - top) * 0.18);
      for (int y = top; y <= y1; y++) for (int x = 0; x < cw; x++) if (((px[(oy+y)*w+ox+x] >> 24) & 255) > 128) { s += x; n++; }
      hx[f] = n > 0 ? s / n : cw / 2.0;
    }
    var sorted = (double[])hx.Clone(); Array.Sort(sorted); double med = sorted[frames / 2];
    var log = new System.Text.StringBuilder(); var outPx = new int[px.Length];
    Array.Copy(px, outPx, px.Length);
    for (int f = 0; f < frames; f++) {
      int ox = (f % cols) * cw, oy = (f / cols) * ch, dx = (int)Math.Round(med - hx[f]);
      log.Append(dx).Append(' ');
      if (dx == 0) continue;
      for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) {
        int sx = x - dx; outPx[(oy+y)*w+ox+x] = (sx >= 0 && sx < cw) ? px[(oy+y)*w+ox+sx] : 0; }
    }
    using (var b = new Bitmap(w, h, PixelFormat.Format32bppArgb)) { var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      Marshal.Copy(outPx, 0, d.Scan0, outPx.Length); b.UnlockBits(d); b.Save(path, ImageFormat.Png); }
    return log.ToString();
  }
}
'@
$dir = Join-Path (Split-Path -Parent $PSScriptRoot) "assets\characters\$Id"
$m = Get-Content (Join-Path $dir "$Id.manifest.json") -Raw | ConvertFrom-Json
foreach ($name in 'walk', 'run', 'walk_front', 'run_front', 'walk_back', 'run_back') {
    $s = $m.strips.$name; if (-not $s) { continue }
    $shifts = [StabX]::Run((Join-Path $dir $s.file), [int]$m.cell.w, [int]$m.cell.h, [int]$s.frames, [int]$s.cols)
    Write-Host "  $Id $name shifted: $shifts"
}
