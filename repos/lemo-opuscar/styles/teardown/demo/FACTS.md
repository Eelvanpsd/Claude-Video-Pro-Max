# 事实表：《二十一键》 21 Keys, Opened

片中每一个数字和事实性说法都在下表：说法 → 出处（URL）→ 原文引用。项目文件固定在 foostan/crkbd 提交 63366fb（2025-05-10）。核对日期：2026-10-16。

两类数字分开看：

- **项目文件原文**：组装文档、BOM、KiCad 文件里直接写着的（A）。
- **从 CAD 实测**：本片从项目的 STEP / KiCad 几何里量的（B），方法写在下面，可用 `tools/` 复现。

## A. 项目文件与器件资料原文

| # | 片中说法（画面 / 旁白） | 出处 | 原文 |
|---|---|---|---|
| A1 | 旁白 "Twenty-one keys. Half a keyboard."；字幕"二十一个键，半把键盘" | README https://github.com/foostan/crkbd/blob/63366fb7f51cf2a796462fdd90527e99dd126055/README.md | "The Corne keyboard is a split keyboard with 3x6 column staggered keys and 3 thumb keys"（每半 3×6 + 3 = 21） |
| A2 | 标签"键帽 1u ×20 · 1.5u ×1" | v4 组装文档 https://github.com/foostan/crkbd/blob/63366fb7f51cf2a796462fdd90527e99dd126055/docs/corne-cherry/v4/buildguide_en.md | "\| Keycaps \| 42 - 46 \| 1u 40 pcs, 1.5u 2 pcs \|"（两半合计；每半 20 + 1） |
| A3 | 标签"机械轴体 十字轴 ×21"；"热插拔 ×21"；旁白 "Hot-swappable. No soldering." | 同 A2；README | "\| Key switches \| 42 - 46 \| Only Cherry MX compatible \|"；README "v4 Hotswappable"。KiCad 左半有 21 个轴位封装 `keyswitch_cherrymx_hotswap_1u` / `_1.5u`（热插拔座封装） |
| A4 | 标签"定位板 FR-4 · 1.6 mm" | 同 A2 | "\| Switch plate \| 1 set \| FR4 1.6mm thick \|" |
| A5 | 标签"铜柱 M2 × 7.5 mm ×4" | 同 A2 | "\| Spacer M2 \| 8 \| 7.5 mm For Case assembly \|"（两半合计；每半 4）；螺丝 "\| Screw M2 \| 16 \| 5 mm For Case assembly \|"；脚垫 "\| Rubber cushion \| 8 \|" |
| A6 | 标签"电路板 双层 · 1.6 mm" | KiCad 板文件 https://github.com/foostan/crkbd/blob/63366fb7f51cf2a796462fdd90527e99dd126055/pcbs/corne-cherry/hotswap/corne-cherry.kicad_pcb | `(general (thickness 1.6))`；叠层只有 `"F.Cu"` 与 `"B.Cu"` 两层铜，`(rev "4.1.0")` |
| A7 | 标签"主控 RP2040 · 7 × 7 mm"；旁白 "One RP2040 chip runs it all." | BOM https://github.com/foostan/crkbd/blob/63366fb7f51cf2a796462fdd90527e99dd126055/pcbs/corne-cherry/hotswap/jlcpcb/production_files/BOM-corne-cherry.csv ；RP2040 数据手册 https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf | BOM："RP2040,\"U1,rU1\",QFN-56-1EP_7x7mm_P0.4mm_EP3.2x3.2mm"；手册："The RP2040 7×7 mm QFN-56 package …" |
| A8 | 标签"闪存 16 MB" | BOM（同 A7）；Winbond W25Q128JV 数据手册 https://www.winbond.com/resource-files/w25q128jv%20revf%2003272018%20plus.pdf | BOM："W25Q128JVSIQ,\"U4,rU4\",SOIC-8_5.23x5.23mm_P1.27mm"；手册："W25Q128JV: 128M-bit / 16M-byte" |
| A9 | 标签"灯珠 ×23 · 反贴"；旁白 "Twenty-three lights, mounted upside down." | BOM（同 A7）；KiCad 板文件 | BOM 列出 YS-SK6812MINI-E：LED1–LED21、EXLED1–2（左半 23 颗，右半带 r 前缀另 23 颗）；KiCad 里这些封装全部在 `(layer "B.Cu")`（背面），型号后缀 -E 为反贴式 |
| A10 | 画面上的晶振、0402 阻容、USB-C、TRRS 插座、复位按键的位置与封装 | KiCad 板文件、BOM | 封装名与坐标原样读取（例如 "Crystal_SMD_3225-4Pin_3.2x2.5mm"、"TYPE-C-31-M-13C"、"PJ-398A-5A_PJ-399B-6A"）；无文字标注 |
| A11 | 旁白 "Every one of them is drawn in open files." / "Every number is public." | 仓库许可 https://github.com/foostan/crkbd （LICENSE_CC、LICENSE_MIT） | 仓库以 CC BY 4.0（LICENSE_CC）与 MIT（LICENSE_MIT）公开；本片用到的全部文件都在该仓库 |

## B. 从 CAD 实测

| # | 片中说法 | 方法 | 结果 |
|---|---|---|---|
| B1 | 尺寸线"键距 19.05 mm"；旁白 "Nineteen point oh five millimetres apart." | KiCad 板文件里相邻轴位的中心距：SW19 (−128.5875, −7.14375) 与 SW18 (−109.5375, −7.14375) | 19.050 mm（整块板的列距都是 19.05） |
| B2 | 尺寸线"138.4 mm""97.6 mm""11.1 mm" | 外壳 STEP https://github.com/foostan/crkbd/blob/63366fb7f51cf2a796462fdd90527e99dd126055/cases/3x6/left.step 用 occt-import-js 三角化后的包围盒（`tools/step2mesh.mjs`） | 138.35 × 97.62 × 11.10 mm，画面取一位小数 |
| B3 | 标签"外壳 底厚 2.0 mm" | 同 B2：外壳网格水平面高度，底面 −11.40、内底面 −9.40 | 2.00 mm |
| B4 | 拆解层次与装配高度（画面里零件的相对位置） | 内底 2.0 + 铜柱 7.5（A5）+ 定位板 1.6（A4）= 11.1 mm，正好等于外壳边沿高度（B2）；定位板 4 个 Ø2.2 孔与外壳螺丝孔、电路板 Ø5 孔位置重合 | 三份文件互相吻合；电路板放在定位板下 5.0 mm（十字轴通用安装高度） |
| B5 | 旁白 "Take it apart: six layers." | 本片的分层方式：键帽、轴体、定位板、电路板、铜柱、外壳（螺丝与脚垫随相邻层） | 编辑性归类，不是项目文件里的数字 |

## C. 画面上不是数据的部分

键帽造型、轴体外形、各种材质颜色、外壳的金属质感、脚垫位置、背面器件的高度都是按通用规格的建模选择，画面上没有为它们标任何数字。
