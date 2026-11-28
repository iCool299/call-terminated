# Colour match: every generated sheet comes back from ChatGPT a little brighter / darker / more saturated than the others,
# so the character visibly changes colour when he switches animation. This pulls every built strip of an enemy to the colours
# of his idle strip: pixels are grouped by colour family (hue bucket x light/dark), and each family is scaled so its average
# matches the same family in the idle. Outlines, transparent pixels and families too small to compare are left alone.
# Usage: powershell -ExecutionPolicy Bypass -File tools\match-hue.ps1 -Id navy [-Ref idle]
param([Parameter(Mandatory)][string]$Id, [string]$Ref = 'idle')
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class HueMatch {
  const int NB = 24;                                   // 12 hues x (dark, light)
  static int[] Load(string p, out int w, out int h) { using (var b = new Bitmap(p)) { w = b.Width; h = b.Height;
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var r = new int[w*h]; Marshal.Copy(d.Scan0, r, 0, r.Length); b.UnlockBits(d); return r; } }
  static void Save(string p, int[] px, int w, int h) { using (var b = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
      var d = b.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      Marshal.Copy(px, 0, d.Scan0, px.Length); b.UnlockBits(d); b.Save(p, ImageFormat.Png); } }
  static int Bucket(int c) {
    int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    int mx = Math.Max(r, Math.Max(g, b)), mn = Math.Min(r, Math.Min(g, b));
    double l = (r * 30 + g * 59 + b * 11) / 100.0;
    if (l < 32) return -1;                               // outline: never touched
    if (mx - mn < 18) return l < 128 ? 22 : 23;          // greys / whites
    double h; double d = mx - mn;
    if (mx == r) h = ((g - b) / d) % 6; else if (mx == g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    int hb = (int)(h / 36.0) % 10;                       // 10 hue buckets
    return hb * 2 + (l < 110 ? 0 : 1);
  }
  static double[,] Stats(int[] px) {
    var s = new double[NB, 4];
    foreach (int p in px) { if (((p >> 24) & 255) < 250) continue; int k = Bucket(p & 0xFFFFFF); if (k < 0) continue;
      s[k,0] += (p >> 16) & 255; s[k,1] += (p >> 8) & 255; s[k,2] += p & 255; s[k,3]++; }
    return s;
  }
  public static string Run(string refPath, string path) {
    int rw, rh, w, h; var rp = Load(refPath, out rw, out rh); var px = Load(path, out w, out h);
    var rs = Stats(rp); var ss = Stats(px);
    var gain = new double[NB, 3]; var log = new System.Text.StringBuilder();
    for (int k = 0; k < NB; k++) for (int c = 0; c < 3; c++) gain[k,c] = 1;
    for (int k = 0; k < NB; k++) {
      if (rs[k,3] < 400 || ss[k,3] < 400) continue;
      for (int c = 0; c < 3; c++) { double a = rs[k,c] / rs[k,3], b = ss[k,c] / ss[k,3]; if (b > 4) gain[k,c] = Math.Max(0.8, Math.Min(1.25, a / b)); }
      log.AppendFormat(" b{0}:{1:F2}/{2:F2}/{3:F2}", k, gain[k,0], gain[k,1], gain[k,2]);
    }
    for (int i = 0; i < px.Length; i++) { int p = px[i]; if (((p >> 24) & 255) == 0) continue; int k = Bucket(p & 0xFFFFFF); if (k < 0) continue;
      int r = (int)Math.Round(((p >> 16) & 255) * gain[k,0]), g = (int)Math.Round(((p >> 8) & 255) * gain[k,1]), b = (int)Math.Round((p & 255) * gain[k,2]);
      r = Math.Min(255, r); g = Math.Min(255, g); b = Math.Min(255, b);
      px[i] = (p & unchecked((int)0xFF000000)) | (r << 16) | (g << 8) | b; }
    Save(path, px, w, h); return log.ToString();
  }
}
'@
$dir = Join-Path (Split-Path -Parent $PSScriptRoot) "assets\characters\$Id"
$refPath = Join-Path $dir "${Id}_$Ref.png"
Get-ChildItem (Join-Path $dir "${Id}_*.png") | Where-Object { $_.FullName -ne $refPath } | ForEach-Object {
    $l = [HueMatch]::Run($refPath, $_.FullName); Write-Host "  $($_.Name) matched to $Ref"
}
