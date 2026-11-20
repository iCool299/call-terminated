// Zee sprite pipeline: slices AI-generated sheets, removes backgrounds, unifies scale/baseline/palette,
// exports game-ready strips + manifest. Compiled via Add-Type (C# 5 compatible).
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;

namespace Zee
{
    public class StripCfg
    {
        public string Name; public string Path; public int N; public double Fps; public bool Loop;
        public double Scale;        // dest px per source px; <=0 => auto from median height
        public double StandH;       // if >0: source px height that equals a standing Zee (scale = Target/StandH)
        public int CleanFrame = -1; // frame index whose tiny detached blobs (spark lines) are removed
        public bool IsRef;          // contributes to the shared palette
    }

    public class StripOut
    {
        public StripCfg Cfg; public int[][] Frames; public double UsedScale; public int[] Bottoms; public int[] Heights;
    }

    public static class Pipeline
    {
        public const int CELL = 160;
        public const int ANCHOR_X = 80;
        public const int BASE_Y = 148;
        public const double TARGET_STAND = 112.0;

        public class Src { public int W; public int H; public int[] P; }

        public static Src Load(string path)
        {
            Src s = new Src();
            if (path.EndsWith(".webp", StringComparison.OrdinalIgnoreCase))
            {
                using (FileStream fs = File.OpenRead(path))
                {
                    var dec = System.Windows.Media.Imaging.BitmapDecoder.Create(fs,
                        System.Windows.Media.Imaging.BitmapCreateOptions.PreservePixelFormat,
                        System.Windows.Media.Imaging.BitmapCacheOption.OnLoad);
                    var conv = new System.Windows.Media.Imaging.FormatConvertedBitmap(dec.Frames[0],
                        System.Windows.Media.PixelFormats.Bgra32, null, 0);
                    s.W = conv.PixelWidth; s.H = conv.PixelHeight;
                    byte[] buf = new byte[s.W * s.H * 4];
                    conv.CopyPixels(buf, s.W * 4, 0);
                    s.P = new int[s.W * s.H];
                    for (int i = 0; i < s.P.Length; i++)
                        s.P[i] = (buf[i * 4 + 3] << 24) | (buf[i * 4 + 2] << 16) | (buf[i * 4 + 1] << 8) | buf[i * 4];
                }
            }
            else
            {
                using (Bitmap bmp = new Bitmap(path))
                {
                    s.W = bmp.Width; s.H = bmp.Height; s.P = new int[s.W * s.H];
                    BitmapData bd = bmp.LockBits(new Rectangle(0, 0, s.W, s.H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                    Marshal.Copy(bd.Scan0, s.P, 0, s.P.Length);
                    bmp.UnlockBits(bd);
                }
            }
            return s;
        }

        static bool IsBgLike(int p)
        {
            int r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255;
            int mn = Math.Min(r, Math.Min(g, b)), mx = Math.Max(r, Math.Max(g, b));
            return mn >= 215 && (mx - mn) <= 24;
        }

        static bool[] MakeMask(Src s, out bool usedAlpha)
        {
            int n = s.W * s.H, W = s.W, H = s.H;
            int semi = 0;
            for (int i = 0; i < n; i++) if (((s.P[i] >> 24) & 255) < 250) semi++;
            usedAlpha = semi > n * 0.02;
            bool[] m = new bool[n];
            if (usedAlpha)
            {
                for (int i = 0; i < n; i++) m[i] = ((s.P[i] >> 24) & 255) >= 128;
                return m;
            }
            bool[] bg = new bool[n];
            int[] stack = new int[n]; int sp = 0;
            for (int x = 0; x < W; x++)
            {
                int a = x, b = (H - 1) * W + x;
                if (!bg[a] && IsBgLike(s.P[a])) { bg[a] = true; stack[sp++] = a; }
                if (!bg[b] && IsBgLike(s.P[b])) { bg[b] = true; stack[sp++] = b; }
            }
            for (int y = 0; y < H; y++)
            {
                int a = y * W, b = y * W + W - 1;
                if (!bg[a] && IsBgLike(s.P[a])) { bg[a] = true; stack[sp++] = a; }
                if (!bg[b] && IsBgLike(s.P[b])) { bg[b] = true; stack[sp++] = b; }
            }
            while (sp > 0)
            {
                int i = stack[--sp]; int x = i % W, y = i / W;
                if (x > 0 && !bg[i - 1] && IsBgLike(s.P[i - 1])) { bg[i - 1] = true; stack[sp++] = i - 1; }
                if (x < W - 1 && !bg[i + 1] && IsBgLike(s.P[i + 1])) { bg[i + 1] = true; stack[sp++] = i + 1; }
                if (y > 0 && !bg[i - W] && IsBgLike(s.P[i - W])) { bg[i - W] = true; stack[sp++] = i - W; }
                if (y < H - 1 && !bg[i + W] && IsBgLike(s.P[i + W])) { bg[i + W] = true; stack[sp++] = i + W; }
            }
            for (int i = 0; i < n; i++) m[i] = !bg[i];
            // erode 1px to drop the light anti-alias fringe
            bool[] e = new bool[n];
            for (int y = 1; y < H - 1; y++)
                for (int x = 1; x < W - 1; x++)
                {
                    int i = y * W + x;
                    e[i] = m[i] && m[i - 1] && m[i + 1] && m[i - W] && m[i + W];
                }
            return e;
        }

        static bool[] Dilate(bool[] m, int w, int h, int r)
        {
            bool[] t = new bool[w * h]; bool[] o = new bool[w * h];
            int[] pre = new int[Math.Max(w, h) + 1];
            for (int y = 0; y < h; y++)
            {
                pre[0] = 0;
                for (int x = 0; x < w; x++) pre[x + 1] = pre[x] + (m[y * w + x] ? 1 : 0);
                for (int x = 0; x < w; x++) t[y * w + x] = pre[Math.Min(w, x + r + 1)] - pre[Math.Max(0, x - r)] > 0;
            }
            for (int x = 0; x < w; x++)
            {
                pre[0] = 0;
                for (int y = 0; y < h; y++) pre[y + 1] = pre[y] + (t[y * w + x] ? 1 : 0);
                for (int y = 0; y < h; y++) o[y * w + x] = pre[Math.Min(h, y + r + 1)] - pre[Math.Max(0, y - r)] > 0;
            }
            return o;
        }

        static int[] Label(bool[] m, int w, int h, out int count)
        {
            int[] lab = new int[w * h]; int[] stack = new int[w * h]; count = 0;
            for (int i0 = 0; i0 < w * h; i0++)
            {
                if (!m[i0] || lab[i0] != 0) continue;
                count++; int sp = 0; stack[sp++] = i0; lab[i0] = count;
                while (sp > 0)
                {
                    int i = stack[--sp]; int x = i % w, y = i / w;
                    for (int dy = -1; dy <= 1; dy++)
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            if (dx == 0 && dy == 0) continue;
                            int nx = x + dx, ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                            int j = ny * w + nx;
                            if (m[j] && lab[j] == 0) { lab[j] = count; stack[sp++] = j; }
                        }
                }
            }
            return lab;
        }

        static int Median(int[] a)
        {
            int[] b = (int[])a.Clone(); Array.Sort(b); return b[b.Length / 2];
        }

        public static StripOut ProcessStrip(StripCfg c, string root, StringBuilder log)
        {
            Src s = Load(System.IO.Path.Combine(root, c.Path));
            int W = s.W, H = s.H;
            bool usedAlpha; bool[] m = MakeMask(s, out usedAlpha);
            bool[] dil = Dilate(m, W, H, 7);
            int cnt; int[] lab = Label(dil, W, H, out cnt);
            long[] area = new long[cnt + 1]; double[] sx = new double[cnt + 1];
            for (int i = 0; i < W * H; i++) if (lab[i] > 0) { area[lab[i]]++; sx[lab[i]] += i % W; }
            List<int> order = Enumerable.Range(1, cnt).OrderByDescending(i => area[i]).ToList();
            log.AppendLine(string.Format("[{0}] {1}x{2} alpha={3} components={4} top areas: {5}", c.Name, W, H, usedAlpha, cnt,
                string.Join(",", order.Take(c.N + 2).Select(i => area[i].ToString()).ToArray())));
            if (cnt < c.N) throw new Exception(c.Name + ": found only " + cnt + " components, expected " + c.N);
            List<int> cores = order.Take(c.N).OrderBy(i => sx[i] / area[i]).ToList();
            int[] compFrame = new int[cnt + 1];
            for (int i = 0; i <= cnt; i++) compFrame[i] = -1;
            for (int k = 0; k < cores.Count; k++) compFrame[cores[k]] = k;
            // Anything that is not one of the N main figures (e.g. baked-in spark lines) is dropped.
            for (int i = 1; i <= cnt; i++)
                if (compFrame[i] < 0) log.AppendLine(string.Format("  dropped stray component #{0} (area {1}, x~{2:0})", i, area[i], sx[i] / area[i]));
            int[] frameOf = new int[W * H];
            for (int i = 0; i < W * H; i++) frameOf[i] = (m[i] && lab[i] > 0) ? compFrame[lab[i]] : -1;
            // note: the sparks' dilated blob is dropped, but their pixels may still sit inside a core's dilated area; re-check below

            if (c.CleanFrame >= 0)
            {
                bool[] fm = new bool[W * H];
                for (int i = 0; i < W * H; i++) fm[i] = frameOf[i] == c.CleanFrame;
                int cc; int[] l2 = Label(fm, W, H, out cc);
                long[] a2 = new long[cc + 1];
                for (int i = 0; i < W * H; i++) if (l2[i] > 0) a2[l2[i]]++;
                long big = a2.Max();
                int removed = 0;
                for (int i = 0; i < W * H; i++) if (l2[i] > 0 && a2[l2[i]] < big * 0.02) { frameOf[i] = -1; removed++; }
                log.AppendLine(string.Format("  cleaned frame {0}: removed {1} px of detached blobs", c.CleanFrame, removed));
            }

            int n = c.N;
            int[] minX = new int[n], maxX = new int[n], minY = new int[n], maxY = new int[n];
            for (int k = 0; k < n; k++) { minX[k] = int.MaxValue; minY[k] = int.MaxValue; maxX[k] = -1; maxY[k] = -1; }
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int f = frameOf[y * W + x]; if (f < 0) continue;
                    if (x < minX[f]) minX[f] = x; if (x > maxX[f]) maxX[f] = x;
                    if (y < minY[f]) minY[f] = y; if (y > maxY[f]) maxY[f] = y;
                }
            double[] legCx = new double[n]; double[] legN = new double[n];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int f = frameOf[y * W + x]; if (f < 0) continue;
                    double hh = maxY[f] - minY[f] + 1;
                    if (y >= minY[f] + 0.55 * hh) { legCx[f] += x; legN[f]++; }
                }
            int[] bottoms = new int[n]; int[] heights = new int[n];
            for (int k = 0; k < n; k++)
            {
                legCx[k] /= Math.Max(1, legN[k]); bottoms[k] = maxY[k] + 1; heights[k] = maxY[k] - minY[k] + 1;
            }
            int[] sortedB = (int[])bottoms.Clone(); Array.Sort(sortedB); Array.Reverse(sortedB);
            int take = (int)Math.Ceiling(n * 0.6);
            int by = Median(sortedB.Take(take).ToArray());

            double scale = c.Scale;
            if (scale <= 0)
            {
                double refH = c.StandH > 0 ? c.StandH : Median(heights);
                scale = TARGET_STAND / refH;
            }
            for (int k = 0; k < n; k++)
                log.AppendLine(string.Format("  f{0}: bbox x[{1}-{2}] y[{3}-{4}] h={5} w={6} legCx={7:0}", k, minX[k], maxX[k], minY[k], maxY[k], heights[k], maxX[k] - minX[k] + 1, legCx[k]));
            log.AppendLine(string.Format("  baseline(src)={0} scale={1:0.0000} (standing equiv {2:0} src px)", by, scale, TARGET_STAND / scale));

            StripOut o = new StripOut(); o.Cfg = c; o.UsedScale = scale; o.Bottoms = bottoms; o.Heights = heights;
            o.Frames = new int[n][];
            for (int k = 0; k < n; k++)
            {
                o.Frames[k] = Resample(s, frameOf, k, legCx[k], by, scale);
                int dMinX = CELL, dMaxX = -1, dMinY = CELL, dMaxY = -1;
                for (int y = 0; y < CELL; y++) for (int x = 0; x < CELL; x++)
                        if ((o.Frames[k][y * CELL + x] >> 24) != 0)
                        { if (x < dMinX) dMinX = x; if (x > dMaxX) dMaxX = x; if (y < dMinY) dMinY = y; if (y > dMaxY) dMaxY = y; }
                if (dMinX <= 0 || dMaxX >= CELL - 1 || dMinY <= 0)
                    log.AppendLine(string.Format("  WARNING f{0} touches the cell edge: x[{1}-{2}] y[{3}-{4}]", k, dMinX, dMaxX, dMinY, dMaxY));
            }
            return o;
        }

        static int[] Resample(Src s, int[] frameOf, int f, double ax, double by, double sc)
        {
            int W = s.W, H = s.H;
            int[] outp = new int[CELL * CELL];
            double inv = 1.0 / sc;
            for (int Y = 0; Y < CELL; Y++)
            {
                double sy0 = by + (Y - BASE_Y) * inv, sy1 = by + (Y + 1 - BASE_Y) * inv;
                int y0 = (int)Math.Floor(sy0), y1 = (int)Math.Ceiling(sy1) - 1;
                for (int X = 0; X < CELL; X++)
                {
                    double sx0 = ax + (X - ANCHOR_X) * inv, sx1 = ax + (X + 1 - ANCHOR_X) * inv;
                    int x0 = (int)Math.Floor(sx0), x1 = (int)Math.Ceiling(sx1) - 1;
                    double tw = 0, aw = 0, r = 0, g = 0, b = 0;
                    for (int py = y0; py <= y1; py++)
                    {
                        double wy = Math.Min(sy1, py + 1) - Math.Max(sy0, py); if (wy <= 0) continue;
                        for (int px = x0; px <= x1; px++)
                        {
                            double wx = Math.Min(sx1, px + 1) - Math.Max(sx0, px); if (wx <= 0) continue;
                            double w = wx * wy; tw += w;
                            if (px < 0 || py < 0 || px >= W || py >= H) continue;
                            int idx = py * W + px; if (frameOf[idx] != f) continue;
                            aw += w; int p = s.P[idx];
                            r += w * ((p >> 16) & 255); g += w * ((p >> 8) & 255); b += w * (p & 255);
                        }
                    }
                    if (tw > 0 && aw / tw >= 0.45)
                    {
                        int R = (int)Math.Round(r / aw), G = (int)Math.Round(g / aw), B = (int)Math.Round(b / aw);
                        outp[Y * CELL + X] = unchecked((int)0xFF000000) | (R << 16) | (G << 8) | B;
                    }
                }
            }
            return outp;
        }

        static double Dist(int a, int b)
        {
            int dr = ((a >> 16) & 255) - ((b >> 16) & 255), dg = ((a >> 8) & 255) - ((b >> 8) & 255), db = (a & 255) - (b & 255);
            return 2.0 * dr * dr + 4.0 * dg * dg + 3.0 * db * db;
        }

        public static int[] BuildPalette(List<StripOut> refs, int k)
        {
            Dictionary<int, int> cnt = new Dictionary<int, int>();
            foreach (StripOut o in refs)
                foreach (int[] fr in o.Frames)
                    foreach (int p in fr)
                        if ((p >> 24) != 0) { int q = p & 0xFFFFFF; int v; cnt.TryGetValue(q, out v); cnt[q] = v + 1; }
            int[] u = cnt.Keys.ToArray(); double[] w = u.Select(x => (double)cnt[x]).ToArray();
            List<int> cent = new List<int>();
            int first = 0; for (int i = 1; i < u.Length; i++) if (w[i] > w[first]) first = i;
            cent.Add(u[first]);
            double[] dmin = new double[u.Length];
            for (int i = 0; i < u.Length; i++) dmin[i] = Dist(u[i], u[first]);
            while (cent.Count < k)
            {
                int best = 0; double bs = -1;
                for (int i = 0; i < u.Length; i++) { double sc = Math.Sqrt(w[i]) * dmin[i]; if (sc > bs) { bs = sc; best = i; } }
                cent.Add(u[best]);
                for (int i = 0; i < u.Length; i++) dmin[i] = Math.Min(dmin[i], Dist(u[i], u[best]));
            }
            int[] pal = cent.ToArray();
            for (int it = 0; it < 15; it++)
            {
                double[] sr = new double[k], sg = new double[k], sb = new double[k], sw = new double[k];
                for (int i = 0; i < u.Length; i++)
                {
                    int bi = 0; double bd = double.MaxValue;
                    for (int j = 0; j < k; j++) { double d = Dist(u[i], pal[j]); if (d < bd) { bd = d; bi = j; } }
                    sr[bi] += w[i] * ((u[i] >> 16) & 255); sg[bi] += w[i] * ((u[i] >> 8) & 255); sb[bi] += w[i] * (u[i] & 255); sw[bi] += w[i];
                }
                for (int j = 0; j < k; j++)
                    if (sw[j] > 0) pal[j] = ((int)Math.Round(sr[j] / sw[j]) << 16) | ((int)Math.Round(sg[j] / sw[j]) << 8) | (int)Math.Round(sb[j] / sw[j]);
            }
            return pal;
        }

        public static void Quantize(StripOut o, int[] pal)
        {
            Dictionary<int, int> cache = new Dictionary<int, int>();
            foreach (int[] fr in o.Frames)
                for (int i = 0; i < fr.Length; i++)
                {
                    if ((fr[i] >> 24) == 0) continue;
                    int q = fr[i] & 0xFFFFFF; int v;
                    if (!cache.TryGetValue(q, out v))
                    {
                        double bd = double.MaxValue; int bj = 0;
                        for (int j = 0; j < pal.Length; j++) { double d = Dist(q, pal[j]); if (d < bd) { bd = d; bj = j; } }
                        v = pal[bj]; cache[q] = v;
                    }
                    fr[i] = unchecked((int)0xFF000000) | v;
                }
        }

        public static void SaveStrip(StripOut o, string path)
        {
            int n = o.Frames.Length;
            using (Bitmap bmp = new Bitmap(CELL * n, CELL, PixelFormat.Format32bppArgb))
            {
                int[] buf = new int[CELL * n * CELL];
                for (int k = 0; k < n; k++)
                    for (int y = 0; y < CELL; y++)
                        for (int x = 0; x < CELL; x++)
                            buf[y * CELL * n + k * CELL + x] = o.Frames[k][y * CELL + x];
                BitmapData bd = bmp.LockBits(new Rectangle(0, 0, CELL * n, CELL), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(buf, 0, bd.Scan0, buf.Length);
                bmp.UnlockBits(bd);
                bmp.Save(path, ImageFormat.Png);
            }
        }

        // Debug sheet: all strips stacked, grey background, baseline + cell dividers.
        public static void SaveSheet(List<StripOut> outs, string path, int zoom)
        {
            int maxN = outs.Max(o => o.Frames.Length);
            int w = CELL * maxN * zoom, h = CELL * outs.Count * zoom;
            using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                int[] buf = new int[w * h];
                for (int i = 0; i < buf.Length; i++) buf[i] = unchecked((int)0xFF8FA0B0);
                for (int r = 0; r < outs.Count; r++)
                {
                    StripOut o = outs[r];
                    for (int k = 0; k < o.Frames.Length; k++)
                        for (int y = 0; y < CELL * zoom; y++)
                            for (int x = 0; x < CELL * zoom; x++)
                            {
                                int dx = k * CELL * zoom + x, dy = r * CELL * zoom + y;
                                int gy = y / zoom, gx = x / zoom;
                                int px = o.Frames[k][gy * CELL + gx];
                                if ((px >> 24) != 0) buf[dy * w + dx] = px;
                                else if (gy == BASE_Y || (x % (CELL * zoom) == 0)) buf[dy * w + dx] = unchecked((int)0xFFC0504A);
                                else if (gy == BASE_Y - 112 && (gx % 4 < 2)) buf[dy * w + dx] = unchecked((int)0xFF6A8F6A);
                            }
                }
                BitmapData bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(buf, 0, bd.Scan0, buf.Length);
                bmp.UnlockBits(bd);
                bmp.Save(path, ImageFormat.Png);
            }
        }

        public static string[] Run(string root, string outDir, string sheetPath, StripCfg[] cfgs, int paletteSize)
        {
            StringBuilder log = new StringBuilder();
            List<StripOut> outs = new List<StripOut>();
            foreach (StripCfg c in cfgs) outs.Add(ProcessStrip(c, root, log));
            int[] pal = BuildPalette(outs.Where(o => o.Cfg.IsRef).ToList(), paletteSize);
            foreach (StripOut o in outs) Quantize(o, pal);
            Directory.CreateDirectory(outDir);
            foreach (StripOut o in outs) SaveStrip(o, System.IO.Path.Combine(outDir, "zee_" + o.Cfg.Name + ".png"));
            if (!string.IsNullOrEmpty(sheetPath)) SaveSheet(outs, sheetPath, 1);
            // manifest
            StringBuilder mj = new StringBuilder();
            mj.AppendLine("{");
            mj.AppendLine("  \"character\": \"zee\",");
            mj.AppendLine(string.Format("  \"cell\": {{ \"w\": {0}, \"h\": {0} }},", CELL));
            mj.AppendLine(string.Format("  \"anchor\": {{ \"x\": {0}, \"y\": {1} }},", ANCHOR_X, BASE_Y));
            mj.AppendLine(string.Format("  \"standingHeightPx\": {0},", (int)TARGET_STAND));
            mj.AppendLine("  \"facing\": \"right\",");
            mj.AppendLine("  \"animations\": {");
            for (int i = 0; i < outs.Count; i++)
            {
                StripOut o = outs[i];
                mj.AppendLine(string.Format("    \"{0}\": {{ \"file\": \"zee_{0}.png\", \"frames\": {1}, \"fps\": {2}, \"loop\": {3} }}{4}",
                    o.Cfg.Name, o.Frames.Length, o.Cfg.Fps.ToString(System.Globalization.CultureInfo.InvariantCulture), o.Cfg.Loop ? "true" : "false", i < outs.Count - 1 ? "," : ""));
            }
            mj.AppendLine("  }");
            mj.AppendLine("}");
            File.WriteAllText(System.IO.Path.Combine(outDir, "zee.manifest.json"), mj.ToString());
            File.WriteAllText(System.IO.Path.Combine(outDir, "zee.manifest.js"), "window.ZEE_MANIFEST = " + mj.ToString() + ";\n");
            log.AppendLine("palette: " + string.Join(" ", pal.Select(p => "#" + (p & 0xFFFFFF).ToString("X6")).ToArray()));
            return new string[] { log.ToString() };
        }
    }
}
