// Zee sprite pipeline v2: processes ChatGPT-generated green-screen animation sheets (grid layouts)
// into game-ready strips with one baseline, one scale rule and ONE palette locked to the master sprite.
// Compiled via Add-Type (C# 5 compatible).
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;

namespace Zee2
{
    public class SheetCfg
    {
        public string Name; public string Path; public int N; public int Rows = 1;
        public double StandH;      // source px height of a standing Zee in this sheet (scale = TargetStand / StandH)
        public double Scale;       // explicit dest px per source px (overrides StandH when > 0)
        public int DropFrames;     // number of trailing frames to ignore (unused)
    }

    public class SheetOut
    {
        public SheetCfg Cfg; public int[][] Frames; public double UsedScale;
    }

    public static class Pipe
    {
        // Frames are built at 2x the game's 132 px character height so the game can draw them at your screen's real
        // resolution without blur or blockiness (drawScale 0.5 in the manifest brings them back to game units).
        public const int CW = 384;          // cell width (wide: kicks, thrown paper and lying poses need sideways room)
        public const int CH = 320;          // cell height
        public const int CELL = CH;         // legacy name, used by the (unused) debug sheet only
        public const int ANCHOR_X = 192;
        public const int BASE_Y = 296;
        public const double TARGET_STAND = 264.0;
        public const int MAX_COLS = 8;      // strips are packed in grids at most 8 frames wide (phone GPUs limit texture width)
        public static bool Nearest = false;

        public class Src { public int W; public int H; public int[] P; }

        public static Src Load(string path)
        {
            Src s = new Src();
            using (Bitmap bmp = new Bitmap(path))
            {
                s.W = bmp.Width; s.H = bmp.Height; s.P = new int[s.W * s.H];
                BitmapData bd = bmp.LockBits(new Rectangle(0, 0, s.W, s.H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(bd.Scan0, s.P, 0, s.P.Length);
                bmp.UnlockBits(bd);
            }
            return s;
        }

        static bool IsKey(int p)
        {
            int r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255;
            return g > 110 && (g - Math.Max(r, b)) > 55;
        }

        public static bool[] MakeMask(Src s, bool erode)
        {
            int n = s.W * s.H, W = s.W, H = s.H;
            bool[] m = new bool[n];
            for (int i = 0; i < n; i++) m[i] = !IsKey(s.P[i]);
            if (!erode) return m;
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

        static int Median(int[] a) { int[] b = (int[])a.Clone(); Array.Sort(b); return b[b.Length / 2]; }

        public static SheetOut Process(SheetCfg c, string root, StringBuilder log)
        {
            Src s = Load(System.IO.Path.Combine(root, c.Path));
            int W = s.W, H = s.H;
            bool[] m = MakeMask(s, true);
            bool[] dil = Dilate(m, W, H, Math.Max(4, W / 250));
            int cnt; int[] lab = Label(dil, W, H, out cnt);
            long[] area = new long[cnt + 1]; double[] sx = new double[cnt + 1], sy = new double[cnt + 1];
            for (int i = 0; i < W * H; i++) if (lab[i] > 0) { area[lab[i]]++; sx[lab[i]] += i % W; sy[lab[i]] += i / W; }
            List<int> order = Enumerable.Range(1, cnt).OrderByDescending(i => area[i]).ToList();
            log.AppendLine(string.Format("[{0}] {1}x{2} components={3} top areas: {4}", c.Name, W, H, cnt,
                string.Join(",", order.Take(c.N + 2).Select(i => area[i].ToString()).ToArray())));
            if (cnt < c.N) throw new Exception(c.Name + ": found only " + cnt + " components, expected " + c.N);
            List<int> cores = order.Take(c.N).ToList();
            // reading order: group by row (centroid y), then by x
            List<int> byY = cores.OrderBy(i => sy[i] / area[i]).ToList();
            int perRow = c.N / c.Rows; List<int> ordered = new List<int>();
            for (int r = 0; r < c.Rows; r++)
                ordered.AddRange(byY.Skip(r * perRow).Take(perRow).OrderBy(i => sx[i] / area[i]));
            int[] compFrame = new int[cnt + 1];
            for (int i = 0; i <= cnt; i++) compFrame[i] = -1;
            for (int k = 0; k < ordered.Count; k++) compFrame[ordered[k]] = k;
            for (int i = 1; i <= cnt; i++)
                if (compFrame[i] < 0) log.AppendLine(string.Format("  dropped stray component area={0} at ({1:0},{2:0})", area[i], sx[i] / area[i], sy[i] / area[i]));
            int[] frameOf = new int[W * H];
            for (int i = 0; i < W * H; i++) frameOf[i] = (m[i] && lab[i] > 0) ? compFrame[lab[i]] : -1;

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
            for (int k = 0; k < n; k++) { legCx[k] /= Math.Max(1, legN[k]); bottoms[k] = maxY[k] + 1; heights[k] = maxY[k] - minY[k] + 1; }
            // baseline per grid row: median of the lowest 60% of that row's frame bottoms
            int[] rowBase = new int[c.Rows];
            for (int r = 0; r < c.Rows; r++)
            {
                int[] rb = bottoms.Skip(r * perRow).Take(perRow).ToArray();
                Array.Sort(rb); Array.Reverse(rb);
                rowBase[r] = Median(rb.Take((int)Math.Ceiling(perRow * 0.6)).ToArray());
            }
            int by = rowBase[0];
            double scale = c.Scale > 0 ? c.Scale : TARGET_STAND / (c.StandH > 0 ? c.StandH : Median(heights));
            for (int k = 0; k < n; k++)
                log.AppendLine(string.Format("  f{0}: bbox x[{1}-{2}] y[{3}-{4}] h={5} w={6} legCx={7:0}", k, minX[k], maxX[k], minY[k], maxY[k], heights[k], maxX[k] - minX[k] + 1, legCx[k]));
            log.AppendLine(string.Format("  baseline(src)={0} scale={1:0.0000} (standing equiv {2:0} src px, median frame h {3})", by, scale, TARGET_STAND / scale, Median(heights)));

            SheetOut o = new SheetOut(); o.Cfg = c; o.UsedScale = scale; o.Frames = new int[n][];
            for (int k = 0; k < n; k++)
            {
                o.Frames[k] = Resample(s, frameOf, k, legCx[k], rowBase[k / perRow], scale);
                int dMinX = CW, dMaxX = -1, dMinY = CH;
                for (int y = 0; y < CH; y++) for (int x = 0; x < CW; x++)
                        if ((o.Frames[k][y * CW + x] >> 24) != 0) { if (x < dMinX) dMinX = x; if (x > dMaxX) dMaxX = x; if (y < dMinY) dMinY = y; }
                if (dMinX <= 0 || dMaxX >= CW - 1 || dMinY <= 0)
                    log.AppendLine(string.Format("  WARNING f{0} touches the cell edge: x[{1}-{2}] top={3}", k, dMinX, dMaxX, dMinY));
            }
            return o;
        }

        static int[] Resample(Src s, int[] frameOf, int f, double ax, double by, double sc)
        {
            int W = s.W, H = s.H;
            int[] outp = new int[CW * CH];
            double inv = 1.0 / sc;
            for (int Y = 0; Y < CH; Y++)
            {
                double sy0 = by + (Y - BASE_Y) * inv, sy1 = by + (Y + 1 - BASE_Y) * inv;
                int y0 = (int)Math.Floor(sy0), y1 = (int)Math.Ceiling(sy1) - 1;
                for (int X = 0; X < CW; X++)
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
                        outp[Y * CW + X] = unchecked((int)0xFF000000) | (R << 16) | (G << 8) | B;
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

        // Palette locked to the master sprite (k-means over its opaque pixels) plus fixed extra colors.
        public static int[] BuildPalette(string masterPath, int k, int[] extras, StringBuilder log)
        {
            Src s = Load(masterPath);
            bool[] m = MakeMask(s, true);
            Dictionary<int, int> cnt = new Dictionary<int, int>();
            for (int i = 0; i < m.Length; i++)
                if (m[i]) { int q = s.P[i] & 0xFFFFFF; int v; cnt.TryGetValue(q, out v); cnt[q] = v + 1; }
            log.AppendLine("master distinct colors: " + cnt.Count);
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
            List<int> all = new List<int>(pal);
            if (extras != null) all.AddRange(extras);
            log.AppendLine("palette(" + all.Count + "): " + string.Join(" ", all.Select(p => "#" + (p & 0xFFFFFF).ToString("X6")).ToArray()));
            return all.ToArray();
        }

        public static void Quantize(SheetOut o, int[] pal)
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

        // Texture stabiliser: the generated art has painterly noise (e.g. in the dark pants) that snaps to a different palette
        // shade on every frame and flickers. Each pixel takes the dominant colour of its 5x5 neighbourhood when that colour is a
        // close shade of its own; real details (outlines, lanyard, face, white shoes) differ strongly and are untouched.
        // Edge-preserving (bilateral) smoothing, applied before the palette snap: removes the blotchy painterly shading that
        // differs on every generated frame (it reads as flickering colours/lines) while keeping outlines, face and shapes sharp.
        public static void Bilateral(SheetOut o, int r, double sigmaS, double colorScale)
        {
            int span = 2 * r + 1;
            double[] spatial = new double[span * span];
            for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++) spatial[(dy + r) * span + dx + r] = Math.Exp(-(dx * dx + dy * dy) / (2 * sigmaS * sigmaS));
            double[] lut = new double[4096];                       // colour-distance -> weight, Dist/64 as the index
            for (int i = 0; i < lut.Length; i++) lut[i] = Math.Exp(-(i * 64.0) / colorScale);
            foreach (int[] fr in o.Frames)
            {
                int[] src = (int[])fr.Clone();
                for (int y = r; y < CH - r; y++)
                    for (int x = r; x < CW - r; x++)
                    {
                        int p = src[y * CW + x];
                        if ((p >> 24) == 0 || IsOutline(p & 0xFFFFFF) || IsSkin(p & 0xFFFFFF)) continue;   // outlines and skin (face, hands) stay exactly as drawn
                        double sw = 0, sr = 0, sg = 0, sb = 0;
                        for (int dy = -r; dy <= r; dy++)
                            for (int dx = -r; dx <= r; dx++)
                            {
                                int q = src[(y + dy) * CW + x + dx];
                                if ((q >> 24) == 0 || IsOutline(q & 0xFFFFFF)) continue;
                                int di = (int)(Dist(p & 0xFFFFFF, q & 0xFFFFFF) / 64.0); if (di > 4095) continue;
                                double w = spatial[(dy + r) * span + dx + r] * lut[di];
                                sw += w; sr += w * ((q >> 16) & 255); sg += w * ((q >> 8) & 255); sb += w * (q & 255);
                            }
                        if (sw > 0) fr[y * CW + x] = unchecked((int)0xFF000000) | ((int)(sr / sw + 0.5) << 16) | ((int)(sg / sw + 0.5) << 8) | (int)(sb / sw + 0.5);
                    }
            }
        }

        // ---- Temporal consensus: the root fix for "changing lines/colours" between frames -----------------------------------
        // All frames of an animation share one anchor, so the same pixel position shows the same body part in most frames.
        // For every position, if the same fabric (colour class) appears there in at least `minCount` frames, every frame that shows
        // that fabric there takes the most common colour - the painterly shading that differed from frame to frame disappears,
        // while true motion (limbs moving, expressions) is untouched because those pixels change class.
        public static void TemporalConsensus(SheetOut o, int minCount, double maxDist)
        {
            int n = o.Frames.Length, size = CW * CH;
            int[][] res = new int[n][]; for (int f = 0; f < n; f++) res[f] = (int[])o.Frames[f].Clone();
            int[] cls = new int[n]; Dictionary<int, int> classCount = new Dictionary<int, int>(); Dictionary<int, int> colCount = new Dictionary<int, int>();
            for (int i = 0; i < size; i++)
            {
                classCount.Clear();
                for (int f = 0; f < n; f++)
                {
                    int p = o.Frames[f][i];
                    if ((p >> 24) == 0) { cls[f] = -1; continue; }
                    int k = Cls(p & 0xFFFFFF); cls[f] = k;
                    if (k == 0) continue;                       // outlines are never altered
                    int c; classCount.TryGetValue(k, out c); classCount[k] = c + 1;
                }
                foreach (KeyValuePair<int, int> kc in classCount)
                {
                    if (kc.Value < minCount) continue;
                    colCount.Clear();
                    for (int f = 0; f < n; f++) if (cls[f] == kc.Key) { int p = o.Frames[f][i]; int c; colCount.TryGetValue(p, out c); colCount[p] = c + 1; }
                    int mode = 0, mc = 0; foreach (KeyValuePair<int, int> cc in colCount) if (cc.Value > mc) { mc = cc.Value; mode = cc.Key; }
                    for (int f = 0; f < n; f++)
                        if (cls[f] == kc.Key) { int p = o.Frames[f][i]; if (p != mode && Dist(p & 0xFFFFFF, mode & 0xFFFFFF) < maxDist) res[f][i] = mode; }
                }
            }
            for (int f = 0; f < n; f++) Array.Copy(res[f], o.Frames[f], size);
        }

        // ---- colour classes (used by the temporal consensus above) ----------------------------
        // Every generated frame is its own painting, so its fabric shading never matches the neighbouring frames. Here each fabric
        // (denim / dark cloth = hijab+pants+scarf / white = shirt+shoes) is recoloured from a heavily smoothed local brightness and
        // snapped to at most THREE fixed tones, so the shading is the same simple pattern on every frame.
        static double Luma(int c) { return (((c >> 16) & 255) * 30 + ((c >> 8) & 255) * 59 + (c & 255) * 11) / 100.0; }
        static int Cls(int c)
        {
            int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; double l = Luma(c);
            if (l < 32) return 0;                                   // outline
            if (IsSkin(c)) return 1;                                // skin (and copper rivets)
            if (b > 150 && r < 90) return 2;                        // bright blue accents (lanyard)
            if (l > 165 && Math.Max(r, Math.Max(g, b)) - Math.Min(r, Math.Min(g, b)) < 45) return 3;   // white: shirt, shoes
            if (b > r + 18 && b > g + 5) return 4;                  // denim
            return 5;                                               // dark cloth: hijab, scarf, pants
        }

        static bool IsSkin(int c) { int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return r > 140 && r > g + 25 && g > b + 8; }

        static bool IsOutline(int c) { int l = (((c >> 16) & 255) * 30 + ((c >> 8) & 255) * 59 + (c & 255) * 11) / 100; return l < 32; }

        public static void Denoise(SheetOut o, int passes, double maxDist, int r)
        {
            Dictionary<int, int> tally = new Dictionary<int, int>();
            foreach (int[] fr in o.Frames)
                for (int pass = 0; pass < passes; pass++)
                {
                    int[] src = (int[])fr.Clone();
                    for (int y = r; y < CH - r; y++)
                        for (int x = r; x < CW - r; x++)
                        {
                            int p = src[y * CW + x];
                            if ((p >> 24) == 0 || IsOutline(p & 0xFFFFFF)) continue;     // never touch transparent pixels or outlines
                            tally.Clear(); int n = 0;
                            for (int dy = -r; dy <= r; dy++)
                                for (int dx = -r; dx <= r; dx++)
                                {
                                    int q = src[(y + dy) * CW + x + dx];
                                    if ((q >> 24) == 0 || IsOutline(q & 0xFFFFFF)) continue;
                                    int c; tally.TryGetValue(q, out c); tally[q] = c + 1; n++;
                                }
                            int best = p, bestN = 0;
                            foreach (KeyValuePair<int, int> kv in tally) if (kv.Value > bestN) { bestN = kv.Value; best = kv.Key; }
                            if (best != p && bestN * 100 >= n * 30 && Dist(p & 0xFFFFFF, best & 0xFFFFFF) < maxDist) fr[y * CW + x] = best;
                        }
                }
        }

        public static void SaveStrip(SheetOut o, string path)
        {
            int n = o.Frames.Length;
            int cols = Math.Min(n, MAX_COLS), rows = (n + cols - 1) / cols;
            int W = CW * cols, H = CH * rows;
            using (Bitmap bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb))
            {
                int[] buf = new int[W * H];
                for (int k = 0; k < n; k++)
                {
                    int gx = (k % cols) * CW, gy = (k / cols) * CH;
                    for (int y = 0; y < CH; y++)
                        for (int x = 0; x < CW; x++)
                            buf[(gy + y) * W + gx + x] = o.Frames[k][y * CW + x];
                }
                BitmapData bd = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(buf, 0, bd.Scan0, buf.Length);
                bmp.UnlockBits(bd);
                bmp.Save(path, ImageFormat.Png);
            }
        }

        public static void SaveSheet(List<SheetOut> outs, string path, int zoom)
        {
            int maxN = outs.Max(o => o.Frames.Length);
            int w = CELL * maxN * zoom, h = CELL * outs.Count * zoom;
            using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                int[] buf = new int[w * h];
                for (int i = 0; i < buf.Length; i++) buf[i] = unchecked((int)0xFF8FA0B0);
                for (int r = 0; r < outs.Count; r++)
                {
                    SheetOut o = outs[r];
                    for (int k = 0; k < o.Frames.Length; k++)
                        for (int y = 0; y < CELL * zoom; y++)
                            for (int x = 0; x < CELL * zoom; x++)
                            {
                                int dx = k * CELL * zoom + x, dy = r * CELL * zoom + y;
                                int gy = y / zoom, gx = x / zoom;
                                int px = o.Frames[k][gy * CELL + gx];
                                if ((px >> 24) != 0) buf[dy * w + dx] = px;
                                else if (gy == BASE_Y || (x % (CELL * zoom) == 0)) buf[dy * w + dx] = unchecked((int)0xFFC0504A);
                                else if (gy == BASE_Y - (int)TARGET_STAND && (gx % 4 < 2)) buf[dy * w + dx] = unchecked((int)0xFF6A8F6A);
                            }
                }
                BitmapData bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(buf, 0, bd.Scan0, buf.Length);
                bmp.UnlockBits(bd);
                bmp.Save(path, ImageFormat.Png);
            }
        }

        public static string Run(string root, string masterPath, string outDir, string sheetPath, SheetCfg[] cfgs, int paletteSize, int[] extras)
        {
            StringBuilder log = new StringBuilder();
            int[] pal = BuildPalette(masterPath, paletteSize, extras, log);
            List<SheetOut> outs = new List<SheetOut>();
            foreach (SheetCfg c in cfgs) outs.Add(Process(c, root, log));
            foreach (SheetOut o in outs) Bilateral(o, 6, 3.5, 7000);
            foreach (SheetOut o in outs) Quantize(o, pal);
            foreach (SheetOut o in outs) Denoise(o, 2, 9000, 3);
            foreach (SheetOut o in outs) TemporalConsensus(o, 4, 14000);
            foreach (SheetOut o in outs) Denoise(o, 1, 9000, 2);
            Directory.CreateDirectory(outDir);
            foreach (SheetOut o in outs) SaveStrip(o, System.IO.Path.Combine(outDir, "zee_" + o.Cfg.Name + ".png"));
            if (!string.IsNullOrEmpty(sheetPath)) SaveSheet(outs, sheetPath, 1);
            return log.ToString();
        }
    }
}
