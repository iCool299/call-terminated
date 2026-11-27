# Keeps Zee's makeup idle consistent with her idle: her legs (and the first and last frame) are the idle's own pixels, the upper body
# (head, jacket, arms, compact, lipstick) comes from the makeup strip, plus any moving part that reaches below the hips.
# "Moving parts" = the pixels where a makeup frame differs from the makeup strip's own first frame (her resting pose), grown by a few pixels.
# Runs after build-zee.ps1 (it calls this), on the built strips in assets/characters/zee.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'assets\characters\zee'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class MakeupFix {
  static int[] Read(Bitmap b) { var d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb); var a = new int[b.Width * b.Height]; Marshal.Copy(d.Scan0, a, 0, a.Length); b.UnlockBits(d); return a; }
  static void Write(Bitmap b, int[] a) { var d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb); Marshal.Copy(a, 0, d.Scan0, a.Length); b.UnlockBits(d); }
  static bool Diff(int p, int q) {
    int ap = (p >> 24) & 255, aq = (q >> 24) & 255;
    if ((ap > 127) != (aq > 127)) return true;
    if (ap <= 127) return false;
    int dr = ((p >> 16) & 255) - ((q >> 16) & 255), dg = ((p >> 8) & 255) - ((q >> 8) & 255), db = (p & 255) - (q & 255);
    return dr * dr + dg * dg + db * db > 60 * 60;
  }
  // idlePath/idleCols: the idle strip; mkPath/mkCols/mkFrames: the makeup strip (rewritten in place). Returns the share of each frame replaced.
  public static string Run(string idlePath, int idleCols, string mkPath, int mkCols, int frames, int cw, int ch, int grow) {
    var idleBmp = new Bitmap(idlePath); var idle = Read(idleBmp); int iw = idleBmp.Width; idleBmp.Dispose();
    var mkBmp = new Bitmap(mkPath); int mw = mkBmp.Width, mh = mkBmp.Height; var mk = Read(mkBmp); mkBmp.Dispose();
    var outA = (int[])mk.Clone(); var log = "";
    // her hip line in the idle: 55% of the way down from the top of her head to her feet
    int top = ch, bot = 0; for (int i = 0; i < cw * ch; i++) { int x = i % cw, y = i / cw; if (((idle[y * iw + x] >> 24) & 255) > 127) { if (y < top) top = y; if (y > bot) bot = y; } }
    int hip = top + (int)((bot - top) * 0.55);
    // reference frames: the idle's frame 0 and the makeup strip's frame 0
    Func<int[], int, int, int, int, int> px = (arr, stride, cols, f, i) => { int x = i % cw, y = i / cw; int ox = (f % cols) * cw, oy = (f / cols) * ch; return arr[(oy + y) * stride + ox + x]; };
    for (int f = 0; f < frames; f++) {
      var mask = new bool[cw * ch];
      for (int i = 0; i < cw * ch; i++) mask[i] = Diff(px(mk, mw, mkCols, f, i), px(mk, mw, mkCols, 0, i));
      // drop the thin outlines caused by the generator redrawing the body a pixel off (erode), keep only real moving blobs (arms, props)
      for (int g = 0; g < 3; g++) { var m2 = (bool[])mask.Clone(); for (int y = 1; y < ch - 1; y++) for (int x = 1; x < cw - 1; x++) { int i = y * cw + x; if (!mask[i]) continue; if (!mask[i - 1] || !mask[i + 1] || !mask[i - cw] || !mask[i + cw]) m2[i] = false; } mask = m2; }
      // keep only moving parts that reach above her hips (an arm that hangs down still counts); blobs only on her legs are redraw noise
      { var keep = new bool[cw * ch]; var stack = new System.Collections.Generic.Stack<int>();
        for (int i = 0; i < hip * cw; i++) if (mask[i] && !keep[i]) { keep[i] = true; stack.Push(i); }
        while (stack.Count > 0) { int i = stack.Pop(); int x = i % cw; foreach (int j in new[] { i - 1, i + 1, i - cw, i + cw }) { if (j < 0 || j >= cw * ch) continue; if ((j == i - 1 && x == 0) || (j == i + 1 && x == cw - 1)) continue; if (mask[j] && !keep[j]) { keep[j] = true; stack.Push(j); } } }
        mask = keep; }
      // the whole upper body (head, jacket, arms) comes from the makeup drawing so the arms join the body naturally; legs stay the idle's.
      // The first and last frames stay pure idle so the switch in and out never pops.
      if (f > 0 && f < frames - 1) for (int i = 0; i < hip * cw; i++) mask[i] = true;
      // grow the mask so the edges of the moving parts come along with them
      for (int g = 0; g < grow; g++) { var m2 = (bool[])mask.Clone(); for (int y = 1; y < ch - 1; y++) for (int x = 1; x < cw - 1; x++) { int i = y * cw + x; if (mask[i]) continue; if (mask[i - 1] || mask[i + 1] || mask[i - cw] || mask[i + cw]) m2[i] = true; } mask = m2; }
      int n = 0, ox = (f % mkCols) * cw, oy = (f / mkCols) * ch;
      for (int i = 0; i < cw * ch; i++) { int x = i % cw, y = i / cw; int v = mask[i] ? px(mk, mw, mkCols, f, i) : px(idle, iw, idleCols, 0, i); if (mask[i]) n++; outA[(oy + y) * mw + ox + x] = v; }
      log += string.Format("f{0}:{1:0.0}% ", f, 100.0 * n / (cw * ch));
    }
    var outBmp = new Bitmap(mw, mh, PixelFormat.Format32bppArgb); Write(outBmp, outA); outBmp.Save(mkPath, ImageFormat.Png); outBmp.Dispose();
    return log;
  }
}
'@
$man = Get-Content (Join-Path $dir 'zee.manifest.json') -Raw | ConvertFrom-Json
foreach ($v in '', '_front', '_back') {
    $i = $man.strips.('idle' + $v); $m = $man.strips.('idle_makeup' + $v)
    if (-not $i -or -not $m) { continue }
    $r = [MakeupFix]::Run((Join-Path $dir $i.file), $i.cols, (Join-Path $dir $m.file), $m.cols, $m.frames, $man.cell.w, $man.cell.h, 6)
    Write-Host "idle_makeup$v : $r"
}
