# Colour match: every generated sheet comes back from ChatGPT a little brighter / darker / more saturated (sometimes with a
# garment's hue shifted), so the character visibly changes colour when he switches animation. This pulls every built strip of
# an enemy to the colours of his idle strip:
#   1. the idle's colours and the strip's colours are each grouped into K clusters (k-means),
#   2. each strip cluster is paired with the nearest idle cluster and gets the offset between their average colours,
#   3. every pixel moves by a blend of the offsets of its two nearest clusters (smooth, no banding inside shading).
# Outlines and transparent pixels are never touched.
# Usage: powershell -ExecutionPolicy Bypass -File tools\match-colors.ps1 -Id navy [-Ref idle]
param([Parameter(Mandatory)][string]$Id, [string]$Ref = 'idle')
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class ColorMatch {
  const int K = 18;
  static int[] Load(string p, out int w, out int h) { using (var b = new Bitmap(p)) { w = b.Width; h = b.Height;
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var r = new int[w*h]; Marshal.Copy(d.Scan0, r, 0, r.Length); b.UnlockBits(d); return r; } }
  static void Save(string p, int[] px, int w, int h) { using (var b = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      Marshal.Copy(px, 0, d.Scan0, px.Length); b.UnlockBits(d); b.Save(p, ImageFormat.Png); } }
  static bool Use(int p) { if (((p >> 24) & 255) < 250) return false; int r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255; return (r * 30 + g * 59 + b * 11) / 100 >= 32; }
  static double D(double[] a, int p) { double dr = a[0] - ((p >> 16) & 255), dg = a[1] - ((p >> 8) & 255), db = a[2] - (p & 255); return dr * dr + dg * dg + db * db; }
  static double[][] KMeans(int[] px) {
    var pts = new List<int>(); for (int i = 0; i < px.Length; i += 2) if (Use(px[i])) pts.Add(px[i]);
    var c = new double[K][]; var rnd = new Random(7);
    // farthest-point init (deterministic) so small but distinct colours (badge, shoes) get their own cluster
    int f0 = pts[0]; c[0] = new double[] { (f0 >> 16) & 255, (f0 >> 8) & 255, f0 & 255 };
    var dmin = new double[pts.Count]; for (int i = 0; i < pts.Count; i++) dmin[i] = D(c[0], pts[i]);
    for (int k = 1; k < K; k++) { int bi = 0; double bd = -1; for (int i = 0; i < pts.Count; i++) if (dmin[i] > bd) { bd = dmin[i]; bi = i; }
      int p = pts[bi]; c[k] = new double[] { (p >> 16) & 255, (p >> 8) & 255, p & 255 };
      for (int i = 0; i < pts.Count; i++) dmin[i] = Math.Min(dmin[i], D(c[k], pts[i])); }
    for (int it = 0; it < 12; it++) {
      var s = new double[K, 4];
      foreach (int p in pts) { int bk = 0; double bd = double.MaxValue; for (int k = 0; k < K; k++) { double d = D(c[k], p); if (d < bd) { bd = d; bk = k; } }
        s[bk,0] += (p >> 16) & 255; s[bk,1] += (p >> 8) & 255; s[bk,2] += p & 255; s[bk,3]++; }
      for (int k = 0; k < K; k++) if (s[k,3] > 0) { c[k][0] = s[k,0] / s[k,3]; c[k][1] = s[k,1] / s[k,3]; c[k][2] = s[k,2] / s[k,3]; }
    }
    return c;
  }
  public static string Run(string refPath, string path) {
    int rw, rh, w, h; var rp = Load(refPath, out rw, out rh); var px = Load(path, out w, out h);
    var rc = KMeans(rp); var sc = KMeans(px);
    var off = new double[K][]; var log = new System.Text.StringBuilder();
    for (int k = 0; k < K; k++) {
      int bj = 0; double bd = double.MaxValue;
      for (int j = 0; j < K; j++) { double dr = rc[j][0] - sc[k][0], dg = rc[j][1] - sc[k][1], db = rc[j][2] - sc[k][2]; double d = dr * dr + dg * dg + db * db; if (d < bd) { bd = d; bj = j; } }
      off[k] = new double[3];
      if (bd < 60 * 60) for (int ch = 0; ch < 3; ch++) off[k][ch] = rc[bj][ch] - sc[k][ch];       // only pair genuinely matching colours
    }
    for (int i = 0; i < px.Length; i++) {
      int p = px[i]; if (!Use(p)) continue;
      int a = 0, b = 0; double da = double.MaxValue, db2 = double.MaxValue;
      for (int k = 0; k < K; k++) { double d = D(sc[k], p); if (d < da) { db2 = da; b = a; da = d; a = k; } else if (d < db2) { db2 = d; b = k; } }
      double wa = 1.0 / (da + 25), wb = 1.0 / (db2 + 25), s = wa + wb;
      int r = (int)Math.Round(((p >> 16) & 255) + (off[a][0] * wa + off[b][0] * wb) / s);
      int g = (int)Math.Round(((p >> 8) & 255) + (off[a][1] * wa + off[b][1] * wb) / s);
      int bl = (int)Math.Round((p & 255) + (off[a][2] * wa + off[b][2] * wb) / s);
      r = Math.Max(0, Math.Min(255, r)); g = Math.Max(0, Math.Min(255, g)); bl = Math.Max(0, Math.Min(255, bl));
      px[i] = (p & unchecked((int)0xFF000000)) | (r << 16) | (g << 8) | bl;
    }
    Save(path, px, w, h); return log.ToString();
  }
}
'@
$dir = Join-Path (Split-Path -Parent $PSScriptRoot) "assets\characters\$Id"
$refPath = Join-Path $dir "${Id}_$Ref.png"
Get-ChildItem (Join-Path $dir "${Id}_*.png") | Where-Object { $_.FullName -ne $refPath } | ForEach-Object {
    [void][ColorMatch]::Run($refPath, $_.FullName); Write-Host "  $($_.Name) matched to $Ref"
}
