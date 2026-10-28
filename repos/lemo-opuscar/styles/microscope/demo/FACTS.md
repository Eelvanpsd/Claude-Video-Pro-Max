# 事实表：《量出来的蓝》 Measured Blue

片中每一个数字和事实性说法都在下表里：说法、出处（URL）、原文引用。引文保留英文原文。核对日期：2026-10-16。

数字分两类：

- **文件与出处**：直接来自切片文件的元数据或公开说明（A 表）。
- **本片实测**：在这张扫描图上自己量出来的（B 表）。画面上都写了测量方法（“胶原（蓝）占组织面积”下面附像素计数，核径下面附“核膜外缘拟合”），方法写在这里，可由 `tools/plates.py` 和 `tools/nucleus.py` 复现。

本片只描述测量结果，不做诊断，也不评分期。

## A. 文件与出处

| # | 片中说法（画面 / 旁白） | 出处 | 原文 |
|---|---|---|---|
| A1 | “一片人肝组织”“人肝组织 · 三色染色”；旁白 “One slice of human liver.” | OpenSlide 测试数据索引 https://openslide.cs.cmu.edu/download/openslide-testdata/Ventana/index.yaml | `Ventana-1.bif: credit: PathAI · description: Human liver, trichrome stain, brightfield, joint direction LEFT, scanned on Ventana DP 200 · license: CC0-1.0` |
| A2 | 来源署名“全切片扫描 Ventana DP 200 · PathAI · CC0” | 同 A1；文件 XMP | `ScannerModel="VENTANA DP 200"` |
| A3 | 旁白 “The stain turns collagen blue.”；读数标签“胶原（蓝）” | Wikipedia “Trichrome staining” https://en.wikipedia.org/wiki/Trichrome_staining | “A trichrome stain can colour the muscle tissue red, and the collagen fibres green or blue. Liver biopsies may have fine collagen fibres between the liver cells, and the amount of collagen may be estimated based on the staining method.” |
| A4 | 比例尺、视野读数 | 文件 XMP（第 0 层），以及第 0 层的 TIFF XResolution | `Magnification="40" ScanRes="0.25"`；XResolution 40000 px/cm（即 0.25 µm/px） |
| A5 | 仪表“等效 1.25× / 2.5× / 5× / 10× / 20× / 40×” | 各金字塔层的 TIFF ImageDescription | `level=0 mag=40`、`level=1 mag=20` … `level=5 mag=1.25` |
| A6 | 开场的整片玻片照片及其比例 | 文件第 0 页 `Label_Image`，XResolution = 4294967295/9091032 px/cm；扫描区坐标在 XMP 的 AOI0 中 | `<AOI0 Left="297" Top="2323" Right="574" Bottom="2069"/>`。按 21.167 µm/px 计算，Top 从底边数起 |

## B. 本片实测

| # | 片中数字 | 方法 | 结果 |
|---|---|---|---|
| B0 | （对位核查，不上画面） | 玻片照片与扫描图通过 AOI0 和两边的像素尺寸对位；再各自用暗度掩膜求组织质心与面积，交叉核对 | 质心相差 19 µm（不到照片上 1 个像素）；面积比 0.999 |
| B1 | “4.80 mm”；旁白 “Four point eight millimeters across.” | 在第 3 层（2 µm/px）上取组织掩膜（非玻璃且非低饱和），闭运算并填洞，取最大连通域，做主成分分析，取其在主轴上的投影跨度 | 4.80 mm（宽 2.80 mm） |
| B2 | 圆 A“胶原（蓝）占组织面积 13.5%”“97,058 / 716,763 px”；旁白 “blue covers thirteen point five percent” | 在第 2 层（1 µm/px）上逐像素分类：组织 =（亮度 < 200）或（RGB 极差 > 40）；蓝色胶原 = 组织且 B > R + 12 且 B ≥ G。圆心为第 0 层坐标 (8393, 13083)，直径 1 mm（1000 px）；占比 = 圆内蓝色像素 / 圆内组织像素 | 97,058 / 716,763 = 13.5% |
| B3 | 圆 B“32.6%”“232,688 / 713,354 px”；旁白 “thirty two point six” | 同 B2，圆心 (13425, 10578) | 232,688 / 713,354 = 32.6% |
| B4 | “相隔 1.41 mm”；旁白 “One point four millimeters away” | 两个圆心之间的距离 × 0.25 µm/px | 1.41 mm |
| B5 | “B 的蓝色占比是 A 的 2.4 倍”；旁白 “Two point four times the blue.” | B3 / B2 | 32.6 / 13.5 = 2.41 |
| B6 | “肝细胞核 8.5 µm”；旁白 “eight point five microns across” | 在第 0 层（0.25 µm/px）上，从核中心发出 72 条射线；每条射线取 2–5 µm 内最暗的点（核膜），再向外找亮度回升一半的位置作为外缘；外缘点做最小二乘拟合圆，剔除离群点后迭代 6 次 | 半径 17.04 px，残差 0.72 px，直径 8.52 µm；核心坐标 (13295.0, 9266.8) |

阈值是这张三色染色片子上的经验取值，蓝色掩膜的效果用叠加图逐区检查过（`stills/` 的测量帧上可以看到计数像素）。读数指的是“这个圆内、按这个阈值”的结果，不是临床意义上的纤维化分级。

`tools/export.mjs` 会核对 `timeline.js` 中旁白和字幕里的每一个数字，必须与 `assets/plates/plates.json`、`nucleus.json` 的实测值一致，否则构建失败。
