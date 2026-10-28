# 事实表：《被炸平的城市怎样长回来》

片中每一个数字、年份和事实性说法都在下表里：说法 → 出处（URL）→ 原文引用。核对日期：2026-10-16。

两类数字要分开看：

- **官方 / 公开来源的说法**（下表 A）：鹿特丹市档案馆（Stadsarchief Rotterdam，市政府机构）的原文；Zalmhaven 的屋面高度另以维基百科条目为参照，并与本片的实测值互相印证。
- **数据实测**（下表 B）：本片用公开数据自己算的（建成年代占比、各年代栋数、百米高楼数、屋面高度、太阳高度、影长、影中屋顶数）。算法全部在 `tools/prep.py`，结果写在 `data/stats.json`，页面只读这个文件。画面上标了"按建筑占地面积 · BAG 建成年份""3DBAG 激光实测""太阳位置按天文算法"。

## A. 史实与公开来源

| # | 片中说法（画面 / 旁白） | 出处 | 原文 |
|---|---|---|---|
| A1 | 钉标"1940.5.14  13:27"；旁白 "May fourteenth, nineteen forty."；字幕"1940 年 5 月 14 日。" | 鹿特丹市档案馆《Rotterdam in oorlog》 https://stadsarchief.rotterdam.nl/rotterdam-oorlog | "Daarom bombarderen Duitse Heinkels op 14 mei 1940 om 13.27 uur de binnenstad van Rotterdam." |
| A2 | 旁白 "Bombs and fire took much of the centre."；字幕"炸弹和大火吞掉了大片市中心。" | 同 A1 | "Binnen een kwartier zijn grote delen van de binnenstad verwoest." / "De bommen en de branden daarna verwoesten 25.000 woningen en 11.000 andere panden." |
| A3 | 钉标副行"258 公顷城区成为废墟" | 同 A1 | "Een oppervlakte van 258 hectare stad ligt in puin." |
| A4 | 钉标"市政厅 · 1920 / 轰炸中几乎完好" | 鹿特丹市档案馆《Het stadhuis tijdens het bombardement》 https://stadsarchief.rotterdam.nl/het-stadhuis-tijdens-het-bombardement ；年份 1920 见 B3 | "Maar hoe kan het dat zo'n groot gebouw de verwoesting van 14 mei 1940 vrijwel ongeschonden heeft doorstaan?" / "Het vuur krijgt geen vat op het vrijstaande stadhuis." |
| A5 | 钉标"Kop van Zuid / 马斯河南岸"（钉在 Wilhelminapier） | Wikipedia《Kop van Zuid》 https://en.wikipedia.org/wiki/Kop_van_Zuid | "…located on the south bank of the Nieuwe Maas opposite the center of town." / 该区 "includes the Wilhelmina Pier" |
| A6 | 钉标"Zalmhaven I / 屋面 203 m"（口径：屋面，不含桅杆） | Wikipedia《De Zalmhaven》 https://en.wikipedia.org/wiki/De_Zalmhaven ；与 B5 的实测值一致 | "The main tower of the complex, Zalmhaven I, reaches 215 metres (705 ft) in height," / "The roof height is 203 metres (666 ft), while the mast takes up the last 12 metres (39 ft) of height." |
| A7 | 钉标"Zalmhaven I / 2022 年建成" | BAG 原始建成年份 2022（B5）；Wikipedia 同上 | "…the entire project was completed in April 2022." |

说明：样片里曾用"圣劳伦斯教堂 · 15 世纪"作标签，但 BAG 登记的原始建成年份是 1640（塔楼加高年代），教堂官网只写 "The Laurenskerk is the only remaining late Gothic building from the medieval Rotterdam."（https://laurenskerk.nl/en/visit/），没有给出建造年份；为免两种口径打架，正式片不再给教堂标年份，改用市档案馆有原文的市政厅。

## B. 数据实测（本片自己算的）

数据：3DBAG（LOD1.3 屋面分块，AHN 激光点云重建，CC BY 4.0）+ 其中带的 BAG 字段 `oorspronkelijkbouwjaar`（原始建成年份，CC0）；BGT 水面与桥面（CC0）。模型范围：RD 坐标 x 91700–94000、y 435300–437900（2.3 × 2.6 km，中心 51.914°N、4.484°E）。只保留完全落在范围内的屋面分块：3,887 栋楼、8,860 个分块。楼高 = 该分块屋面 70 分位高度 − 地面高度（`b3_h_70p − b3_h_maaiveld`），一栋楼取最高分块。

| # | 片中说法 | 方法 | 结果 |
|---|---|---|---|
| B1 | 读数"23% · 1940 年以前建成 · 按建筑占地面积"；"1,606 栋" | BAG 原始建成年份 < 1940 的楼，占地面积（分块面积之和）÷ 全部楼占地面积 | 0.2276 → 23%；1,606 栋 |
| B2 | 年代图例"1940–1964 · 1,113 栋 / 1965–1989 · 522 栋 / 1990–2009 · 413 栋 / 2010–2025 · 233 栋"；滚动年份 1940 → 2025 | 按原始建成年份分档计数 | 1,113 / 522 / 413 / 233 |
| B3 | 市政厅"1920" | BAG 原始建成年份（NL.IMBAG.Pand.0599100000701897） | 1920 |
| B4 | 读数"24/25 · 百米高楼，1990 后建"；旁白 "Twenty-four of its twenty-five tallest…"（字幕："最高的 25 栋里，24 栋建于 1990 年后"） | 楼高 > 100 m 的楼按年代分档 | 共 25 栋：1965–89 有 1 栋，1990–2009 有 13 栋，2010–25 有 11 栋 → 24/25。高于 100 m 的正好是最高的 25 栋 |
| B5 | "Zalmhaven I · 屋面 203 m · 2022 年建成"；高度图例上限 203 m；"最高那栋楼" | NL.IMBAG.Pand.0599100100020122，模型中屋面最高的楼 | 203.0 m，BAG 年份 2022 |
| B6 | "14.6° · 冬至正午太阳高度"；旁白 "below fifteen degrees"；时钟落在 12:40 | NOAA/Meeus 太阳位置算法（`tools/sun.py`），2025-12-21，CET（UTC+1），模型中心经纬度；逐 5 分钟取高度最大值 | 12:40 CET，高度 14.647°，方位 179.94° |
| B7 | "777 m · 冬至正午的影长"；旁白 "nearly eight hundred metres" | 影长 = 屋面高度 ÷ tan(太阳高度) = 203.0 ÷ tan 14.647°；另在 2 m 网格上做高度场光线步进，影子实际末端距塔顶分块中心 784 m | 776.6 m → 777 m |
| B8 | "16 个屋顶落在它的影里 · 其中 9 栋建于 1940 年以前"；旁白 "across sixteen roofs. Nine were there before the war." | 2 m 网格高度场：对每个格子沿太阳方向步进，若 Zalmhaven I 的高度减去 距离 × tan(高度角) 仍高于该格屋面 0.5 m 以上，则该格在它的影中；一栋楼的最高分块中心格在影中即计入 | 16 栋（距塔 262–734 m），其中 BAG 年份 < 1940 的 9 栋（1928–1939） |

"战前就在"（Nine were there before the war）指 BAG 原始建成年份早于 1940、今天仍在的楼。
