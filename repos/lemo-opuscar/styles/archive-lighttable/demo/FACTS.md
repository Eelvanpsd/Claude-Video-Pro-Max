# 事实表：《差两秒》 Two Seconds Short

片中每一个日期、数字、编号和事实性说法都在下表里，格式是：说法 → 官方出处（URL）→ 原文引用（英文原文）。核对日期：2026-10-16。

**核对方式**：loc.gov 的条目页被 Cloudflare 人机验证拦住，curl 和 WebFetch 都打不开。所以条目著录改从美国国会图书馆自己的 SRU 目录服务取（`http://lx2.loc.gov:210/lcdb`，MARCXML），原始记录存在 `sources/sru_*.xml`，用 `tools/sru.py` 可以重查。影像文件直接取自馆方的 `tile.loc.gov` 母版存储，只有电报的彩色扫描经 Wikimedia Commons 获取，Commons 页注明来源是 LoC `mcc.061`。电报上的文字是从图像本身读出来的（原件是一手史料）。

| # | 片中说法（画面 / 旁白 / 字幕） | 出处 | 原文 |
|---|---|---|---|
| F1 | 旁白 "December seventeenth, nineteen oh three."，电报行 "Kitty Hawk N C Dec 17" | LoC 目录，电报 P&P 复制件 `cph.3b12982`（LC-USZ62-65459），`sources/sru_cph.3b12982.xml`；电报原件图像 | 245: "[Telegram from Orville Wright in Kitty Hawk, N.C., to his father announcing four successful flights, 1903 Dec. 17]" |
| F2 | 旁白 "Orville wired home: success, four flights."；索引行"01 电报 · 1903.12.17 · LC-USZ62-65459" | 同 F1；电报正文（图像） | 电报正文："Success four flights thursday morning all against twenty one mile wind …"；收报人 "Bishop M Wright / 7 Hawthorne St" |
| F3 | 旁白 "The longest, fifty-seven seconds."；读数"电报 · 最长一次 57 秒" | 电报正文（图像，`assets/raw/telegram_mcc061.jpg`，LoC `mcc.061`） | "… through air thirty one miles longest 57 seconds inform Press home … Christmas" |
| F4 | 旁白 "Next day, the paper printed the same number."；标签"1903.12.18 / 代顿先驱报"；索引行"02 代顿先驱报 · LC-USZ62-70686" | LoC 目录 `cph.3b18080`（LC-USZ62-70686），`sources/sru_cph.3b18080.xml`；剪报正文（图像） | 245: "[Newspaper notice of Wright Bros. 1st flight: Dayton Herald, Dec. 18, 1903]"；剪报正文："Our longest time in air was 57 seconds. ORVILLE WRIGHT." |
| F5 | 旁白 "The first flight lasted twelve seconds. One hundred and twenty feet."；标签"第一次飞行 / 12 秒 · 120 英尺 · 上午 10:35"；索引行"03" | LoC 目录 `ppprs.00626`（LC-DIG-ppprs-00626），`sources/sru_ppprs.00626.xml` | 245: "[First flight, 120 feet in 12 seconds, 10:35 a.m.; Kitty Hawk, North Carolina]"；260: "[1903 Dec. 17]" |
| F6 | 画面"玻璃底片"（第一张底片） | 同 F5 | 300: "1 photograph : glass negative, dry plate ; plate 18 x 12.5 cm (5 x 7 format)." |
| F7 | 标签"快门：John T. Daniels" | 同 F5 | 520: "(Orville Wright preset the camera and had John T. Daniels squeeze the rubber bulb, tripping the shutter.)" |
| F8 | 标签"威尔伯·莱特 / Wilbur Wright"（照片右侧的人） | 同 F5 | 520: "Wilbur Wright running alongside to balance the machine, has just released his hold on the forward upright of the right wing." |
| F9 | 旁白 "The fourth flight: eight hundred and fifty-two feet, in fifty-nine seconds."；读数"852 英尺 / 59 秒"；对比卡引文 "852 feet covered in 59 seconds."；索引行"04 · LC-DIG-ppprs-00629" | LoC 目录 `ppprs.00629`（LC-DIG-ppprs-00629），`sources/sru_ppprs.00629.xml` | 245: "[Distant view of the Wright airplane just after landing, taken from the starting point, with wing-rest in center of picture and launching rail at right. This flight, the fourth and final of December 17, 1903, was the longest: 852 feet covered in 59 seconds.]" |
| F10 | 测量线"起点"到"落地点" | 同 F9 | "… taken from the starting point …"（相机位置即起点） |
| F11 | 旁白 "The telegram was two seconds short."；判定"差 2 秒" | F3 与 F9 的比较：电报写 57，馆藏记录写 59 | 两个数字之差；片中不推断出错原因 |
| F12 | 索引行"05 试飞受损 · 1903.12.14 · LC-DIG-ppprs-00610"（灯台上的道具） | LoC 目录 `ppprs.00610`，`sources/sru_ppprs.00610.xml` | 245: "[Wilbur in prone position in damaged machine on ground after unsuccessful trial of December 14, 1903; Kitty Hawk, North Carolina]" |

## 示意，不是测量

- 第四次飞行的刻度按"平地 + 针孔相机"的透视排布：某一行离相机的距离 D = K /（行 − 地平线行），其中 K 取自记录的 852 英尺和落地机器底边所在的行（地平线在第 1385 行，机器底边约在第 1410 行，K = 852 × 25）。画面上标了"透视刻度（示意）"。它只是把记录里的 852 英尺排到照片上，不是从照片里量出来的距离。
- 读数计时 0 → 59 秒与刻度同步滚动，只是动画，不代表飞行过程中的时刻。

## 图像处理说明

- 玻璃负片在灯台上的"负像"，是把馆方正像扫描在着色器里取反再加片基色得到的。镜内"正像"就是馆方扫描本身。
- 第一张底片进入照片空间后，飞行器和威尔伯被抠成独立图层（`tools/prep.py`：天空里用差值抠像，沙地上只切强边缘），背后的空洞用金字塔插值填补并加颗粒。飞行器在画面里平移了约 125 像素（扫描像素）：这是动画，不是史实轨迹。
