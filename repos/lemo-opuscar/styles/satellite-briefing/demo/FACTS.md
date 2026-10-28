# 事实表：《地图上还写着海》

片中每一个数字、年份和事实性说法都在下表里：说法 → 官方出处（URL）→ 原文引用。引文为英文原文。NASA Earth Observatory 的旧域名 earthobservatory.nasa.gov 已 301 跳转到 science.nasa.gov，下面给的是跳转后的地址。核对日期：2026-10-15。

两类数字要分开看：

- **官方数字**：直接来自 NASA、USGS、世界银行的原文（下表 A）。
- **影像实测**：本片在 USGS Landsat 影像上自己量的（年轮岸线、"还在水下的部分"百分比、莫伊纳克到海边的距离，下表 B）。画面上都标了"Landsat 测算 / 影像实测"，方法和所用景号写在这里，并和官方数字逐一对照。

## A. 官方数字与说法

| # | 片中说法（画面 / 旁白） | 出处 | 原文 |
|---|---|---|---|
| A1 | 地图标签"咸海"、"地图 · 约 68,000 km²" | USGS EROS Earthshots《Aral Sea, Kazakhstan and Uzbekistan》 https://eros.usgs.gov/earthshots/aral-sea-kazakhstan-and-uzbekistan | "The Aral Sea once covered about 68,000 square kilometers…" |
| A1′ | 地图图层：蓝色海面、岸线、等深式的岸线晕线、河流（阿姆河、锡尔河） | Natural Earth `ne_10m_lakes_historic`（公有领域），要素 "Aral Sea"，featurecla = "Historic Lake"；河流来自 `ne_10m_rivers_lake_centerlines`（公有领域）。岸线内的晕线是地图的印刷惯例，不代表水深数据 | 多边形面积本片算得 67,501 km²，与 UNEP GEAS 2014 公报 "approximately 66,000 km2 – 67, 500 km2 (depending on source)" 一致 |
| A2 | 旁白 "On the map, this is still a sea." | Natural Earth 现行湖泊图层 `ne_10m_lakes` 仍以 "North Aral Sea" / "South Aral Sea" 命名这两块水体；地名本身就叫"海" | 修辞句，不含数字 |
| A3 | 旁白 "Then its rivers went to the cotton fields." | NASA Earth Observatory, World of Change: Shrinking Aral Sea https://science.nasa.gov/earth/earth-observatory/world-of-change/aral-sea | "In the 1960s, the Soviet Union undertook a major water diversion project…" / "…were used to transform the desert into farms for cotton and other crops." |
| A4 | 旁白 "By 2014, the eastern basin had dried."、字幕"到 2014 年，东边的湖盆干涸了" | NASA Earth Observatory, *The Aral Sea Loses Its Eastern Lobe*（2014-09-26 Image of the Day） https://science.nasa.gov/earth/earth-observatory/the-aral-sea-loses-its-eastern-lobe-84437 | "For the first time in modern history, the eastern basin of the South Aral Sea has completely dried." |
| A5 | 旁白 "This was a fishing port."、标签"莫伊纳克 · 旧渔港" | NASA MODIS Image Gallery, 2014-05-04 https://modis.gsfc.nasa.gov/gallery/individual.php?db_date=2014-05-04 | "…a vibrant center of the Aral Sea's fishing industry" / "…rusting ship hulks sitting on dry land, far from any water." |
| A6 | 标签"科卡拉尔大坝 · 2005 年建成 · 长 13 km" | 世界银行 2008 Feature Story https://documents1.worldbank.org/curated/en/888771468089960580/pdf/462360BRI0Box31e0no0FS231Kazakhstan.pdf | "the 13 km Kok-Aral Dike … Completion was in August 2005." |
| A7 | 读数"北咸海水面 +37% · 2001→2009 · 世界银行"；年轮年份 2001、2009 与之对齐 | 世界银行完工报告 ICR0000874（2011-06-21），SYR DARYA CONTROL AND NORTHERN ARAL SEA PHASE-1 PROJECT（P046045） https://documents1.worldbank.org/curated/en/189171468038051254/pdf/ICR8740P0460450Official0Use0Only090.pdf | "increased by 37% from 2,400 km2 in 2001 to 3,300 km2 in 2009" |
| A8 | 旁白 "And the water came back." | 同 A7 | "NAS water levels above Baltic Sea Level (BSL) increased from a pre-project low of 38 m to the desired design level of 42 m." |
| A9 | 旁白 "The sea did not come back on its own. Someone kept it." | 同 A7（项目即"有人"：哈萨克斯坦政府与世界银行的 SYNAS 项目） | 修辞句，不含数字 |
| A10 | 瞄准框读数"北纬 45° 东经 60°" | Natural Earth 历史湖泊多边形的中心约 45.1°N、59.8°E，取整 | 位置标注 |
| A11 | 影像署名"影像 Landsat · USGS/NASA  Blue Marble · NASA" | USGS 数据引用页 https://www.usgs.gov/centers/eros/data-citation ；NASA 影像使用说明 https://science.nasa.gov/earth/faq/ | "federally created data and therefore reside in the public domain"；"freely available for re-publication or re-use, including commercial purposes… We ask that NASA be given credit" |

## B. 影像实测（本片自己量的）

### B1. 年轮与"还在水下的部分"

方法：每一年用该年 7–10 月无云的 Landsat 场景拼成一张经纬度栅格（每像素 0.0024° 经度 × 0.0017° 纬度，约 190 m）。水体：TM/ETM+/OLI 用 MNDWI（绿 − 短波红外）与 NDWI 联合阈值，MSS 用绿 − 近红外（0.8–1.1 µm）与近红外暗值；只保留落在 Natural Earth 历史海面内、面积 ≥ 25 km² 的水体，填掉 < 3 km² 的小岛。按纬度修正像元面积后求和。岸线 = 水体掩膜 0.5 等值线（marching squares），简化到约 115 m。百分比 = 实测水面 ÷ 68,000 km²（A1）。代码：`tools/fetch_landsat.py`、`tools/plates.py`、`tools/vectors.py`；结果在 `assets/vectors.json` 与 `assets/plates/plates.json`（含每个像元来自哪一景）。

| 年份（画面） | 所用影像 | 实测水面 | 画面读数 |
|---|---|---|---|
| 1977 | Landsat 2 MSS，34 景，1977-07-25 至 09-22（含 6 景同年补洞，其中 1 景 L1GS）；扫描线掉线已修补（见 B4） | 54,403 km² | 80% |
| 1989 | Landsat 4/5 TM，27 景，1989-06-14 至 10-13（排除了 1989-08-16 第 161 轨道：湖面上有一道沙尘羽流，改用 09-17） | 39,860 km² | 59% |
| 2000 | Landsat 7 ETM+，28 景，2000-07-17 至 09-29 | 26,879 km² | 40% |
| 2009 | Landsat 5 TM，27 景，2009-07-14 至 09-16 | 14,366 km² | 21% |
| 2014 | Landsat 8 OLI，28 景，2014-07-03 至 09-16 | 7,061 km² | 10% |
| 2025 | Landsat 8/9 OLI，28 景，2025-08-18 至 08-31 | 5,079 km² | 7% |

与官方数字对照：

- NASA EO 2001（*The Shrinking Aral Sea*，https://science.nasa.gov/earth/earth-observatory/the-shrinking-aral-sea-1396/ ）："In the last 30 years, more than 60 percent of the lake has disappeared." 本片 2000 年实测剩 39.5%，即消失约 60%。一致。
- 世界银行 2008 新闻稿："Between 1960 and 2004, the sea's surface area shrank almost 70 percent." 2004 年落在本片 2000 年（39.5%）与 2009 年（21.1%）之间，约 30%。一致。
- USGS Earthshots："It is now only about 10% of the size it was in 1960." NASA EO 2024（https://science.nasa.gov/earth/earth-observatory/dunes-and-desert-replace-the-aral-sea-152887 ）："…has decreased to approximately 10 percent of its original area." 本片 2014 年 10.4%，2025 年 8 月 7.5%（当年夏末偏枯；官方是约数）。画面最后停在实测的 7%，不写"约 10%"，避免两个数字打架。
- 1977 年读数之前的"100%"是地图上的海（A1），不对应任何一张影像。

### B2. 莫伊纳克旧港到今天的海边：95 km

- 起点：莫伊纳克海岸边的废船区（旧港岸线），59.030°E、43.785°N。
- 终点：2025 年 8 月 Landsat 拼接图上南咸海西湖盆（今天仍在的那片海）距起点最近的水体像元，58.323°E、44.467°N。
- 方法：只在包含西湖盆的连通水体里找最近点，用大圆距离（R = 6371.0088 km）：94.5 km，画面和旁白取 95 km。
- 对照：ESA 2003 年图片说明（https://www.esa.int/ESA_Multimedia/Images/2003/07/Fishing_town_Muynak_is_now_150_km_from_water ）"Now the town is 150 km away from water."——那是 2003 年、量到当时另一处水体，参考点不同，所以本片不用 150 km，只用自己按公开方法实测的数。

### B3. 科卡拉尔大坝的位置

白线沿 2025 年 Landsat 上可见的坝体描出：西北臂 60.750°E 46.120°N → 拐角 60.788°E 46.087°N → 东臂 60.865°E 46.088°N。肉眼可见的坝体约 10 km；画面上的"长 13 km"用的是世界银行的数字（A6），不是这条白线的长度。

### B4. 影像修补（不改变测量）

- 1977 年 Landsat 2 MSS 的扫描线掉线（整行近零）按无效像元处理，由相邻场景补；残留的细条纹（约 12° 方向的长直线、请求分块之间的 1 像素接缝）只在陆地上用跨线中值替换，湖面与岸线不动（岸线就是测量对象）。
- 1989 年换掉一景带沙尘羽流的场景，同年 09-17 的同一轨道代替。
- 面积按修补后的影像重新测了一遍（上表）：1977 年比修补前少 0.3%，1989 年因换景少 1.0%，两年的画面读数（80%、59%）都没有变。

## C. 终渲前对照

终渲前逐句核对了 `timeline.js` 里的 10 句旁白与中英字幕、`film.js` 里的全部画面文字，以及 `cues.json`、`satellite-briefing.srt`：每个数字、年份都能在上表找到出处；没有表外的数字。
