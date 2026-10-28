# 事实表：《两条螺旋》Two Spirals

片中每一个数字和事实性说法都在下表：说法 → 出处（URL）→ 原文引用。数据为 IRENA《Renewable Energy Statistics》（2026 版），经 Our World in Data 整理发布（CC BY 4.0）。原始 CSV 与元数据于 2026-10-16 下载，原样存在 `data/`：

- `data/world_solar_capacity_irena2026.csv`、`data/owid_solar_capacity.metadata.json` — https://ourworldindata.org/grapher/installed-solar-pv-capacity
- `data/world_wind_capacity_irena2026.csv`、`data/owid_wind_capacity.metadata.json` — https://ourworldindata.org/grapher/cumulative-installed-wind-energy-capacity-gigawatts

两个数据集的定义（元数据原文）：

- 太阳能："Total solar (on- and off-grid) electricity installed capacity, measured in gigawatts. This includes solar photovoltaic and concentrated solar power." 图表副标题："Cumulative installed solar capacity, measured in gigawatts (GW)."
- 风电："Total wind (on- and off-grid) electricity installed capacity, measured in gigawatts. This includes onshore and offshore wind." 图表副标题："Cumulative installed wind energy capacity including both onshore and offshore wind sources, measured in gigawatts (GW)."
- 引用格式（元数据原文）："IRENA (2026) – processed by Our World in Data. “Total solar capacity” [dataset]. IRENA, “Renewable Energy Statistics” [original data]."（风电同，"Total wind capacity"）

所以片中"太阳能"= 光伏 + 光热，"风电"= 陆上 + 海上，都是年末累计装机（GW），全球（OWID 实体 "World"）。

## A. 画面与旁白里的数字

| # | 片中说法（画面 / 旁白） | 出处 | 原文（CSV 行） |
|---|---|---|---|
| A1 | 读数"2014 风电 349.5 GW" | 风电 CSV | `World,OWID_WRL,2014,349.49323` |
| A2 | 读数"2014 太阳能 178.8 GW" | 太阳能 CSV | `World,OWID_WRL,2014,178.84773` |
| A3 | 判定"风电 = 太阳能 × 1.95"；旁白 "In 2014, the world had almost twice as much wind power as solar." / 字幕"将近太阳能的两倍" | A1 ÷ A2 | 349.49323 ÷ 178.84773 = 1.954 → 1.95，"将近两倍" |
| A4 | 读数"2020 风电 733.3 GW"、"2020 太阳能 721.2 GW" | 两份 CSV | `World,OWID_WRL,2020,733.2712`；`World,OWID_WRL,2020,721.2222` |
| A5 | 读数"2021 风电 824.2 GW"、"2021 太阳能 865.9 GW" | 两份 CSV | `World,OWID_WRL,2021,824.1905`；`World,OWID_WRL,2021,865.921` |
| A6 | 判定"2021 · 太阳能超过风电"；旁白 "In 2021, solar passed wind." | A4、A5：2020 年末太阳能仍少 12.0 GW，2021 年末多 41.7 GW。2014–2020 每年都是风电多（见 CSV） | 累计装机口径；第一次超过的年份是 2021 |
| A7 | 2025 计数器从"1,883.2"滚到"2,396.7 GW"，"2025 · 太阳能累计装机" | 太阳能 CSV | `World,OWID_WRL,2024,1883.1776`；`World,OWID_WRL,2025,2396.7092` |
| A8 | "当年新增 +513.5 GW"；旁白 "In 2025 alone, solar added more than five hundred gigawatts." / 字幕"新增了 500 多 GW" | A7 相减 | 2396.7092 − 1883.1776 = 513.53 GW（两年累计值之差，含光伏与光热；不是 IRENA 单独公布的"新增"表，IRENA 每年会修订往年累计值） |
| A9 | 圆片刻字"×1.86 · 太阳能 ÷ 风电 · 2025"；"2025 · 太阳能装机是风电的 1.86 倍"；旁白 "Now it is the other way round." | 两份 CSV | 2396.7092 ÷ 1291.015 = 1.856 → 1.86；风电 2025：`World,OWID_WRL,2025,1291.015` |
| A10 | 旁白 "Wind kept growing. Solar grew faster." | 两份 CSV | 2014→2025 风电 349.5 → 1,291.0（×3.7），太阳能 178.8 → 2,396.7（×13.4）；风电每年都在增加 |
| A11 | 旁白 "Step back, and twelve years become one dial." | 2014–2025 共 12 个年份 | 修辞句 |

## B. 实物的比例（本片自己定的换算）

- **1 片 = 10 GW**（两种材料同一个单位）：片数 = round(装机 ÷ 10)。例：2025 太阳能 239.67 → 240 片，风电 129.10 → 129 片；2014 太阳能 17.88 → 18 片，风电 34.95 → 35 片。高度误差 < 半片（5 GW）。
- **每第 10 片为黄铜**：黄铜片的位置 = 每满 100 GW。
- 2020 年两个值相差 12.0 GW（73 片 vs 72 片），取整后仍是风电高一片，不会因为取整颠倒先后。
- 画面上的数字一律用原值（保留一位小数），实物高度只是比例。
- 2025 新增落下的片数 = 240 − 188 = 52 片（= 2025 片数 − 2024 片数），计数器按落定的片数线性插值，最后一片落定时显示原值 2,396.7。

## C. 核对

- 最后一次渲染前把 `timeline.js` 的旁白、`LABELS` 和本表逐项对过（2026-10-16）。
- 屏幕数字由 `data.js` 直接格式化（`fmt`，一位小数），1.95、1.86、+513.5 为本表计算值写进 `timeline.js` 的 `LABELS`，`set.js` 里圆片刻字由数据现算 `(SOLAR[11] / WIND[11]).toFixed(2)`。
