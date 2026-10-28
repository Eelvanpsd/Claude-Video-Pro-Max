<div align="center">

# Lemo-Opuscar

**<!--n-->51<!--/n--> 种影片风格，每种都配一支完全用代码做出来的短片。**<br>
选一个风格，带上你自己的故事，让你的编程 agent 来当导演。

<a href="https://lemomo-ai.github.io/lemo-opuscar/"><img alt="看图鉴" src="https://img.shields.io/badge/-%E2%96%B6%20%E7%9C%8B%E5%9B%BE%E9%89%B4-E8553A?style=for-the-badge"></a> <a href="README.md"><img alt="English" src="https://img.shields.io/badge/README-English-555?style=for-the-badge"></a> <a href="https://github.com/lemomo-ai/lemo-opuscar/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/lemomo-ai/lemo-opuscar?style=for-the-badge&color=F5B700&label=stars"></a> <a href="#授权"><img alt="MIT · CC BY 4.0" src="https://img.shields.io/badge/%E6%8E%88%E6%9D%83-MIT%20%C2%B7%20CC%20BY%204.0-2EA44F?style=for-the-badge"></a>

⚠️ **本插件为 Claude 专用。** 风格都是按 Claude Opus 5.5 调出来的，<br>
其他模型适配度不高，请谨慎使用。

🆕 **2026-10-16 · 新分类[「实证影像」](https://lemomo-ai.github.io/lemo-opuscar/#evidence-films)**：8 种风格，拍的都是真实素材，画面上每个数字都实测或有出处。[往下看 ↓](#实证影像)

<sub>官方仓库：[github.com/lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) · 作者 Lemomo（[@lemomo_ai](https://x.com/lemomo_ai)）</sub>

</div>

## 🎬 特别放映：OPUSCAR 98

<table><tr>
<td width="50%" valign="top"><a href="https://lemomo-ai.github.io/lemo-opuscar/opuscar98/"><img src="docs/opuscar98.jpg" alt="OPUSCAR 98：98 年最佳影片"></a><br><b>▶ 影片</b> · 1927 – 2025 · 6 分 31 秒<br><sub>一个 Clawd 走过 98 部最佳影片，每一部都换成贴合那部电影的画风。</sub></td>
<td width="50%" valign="top"><a href="https://lemomo-ai.github.io/lemo-opuscar/opuscar98/#styles"><img src="docs/opuscar98-styles.jpg" alt="OPUSCAR 98：98 种风格全部公开"></a><br><b>98 种风格全部公开</b> · 2D 77 · 2.5D 4 · 3D 17<br><sub>每部片的风格标注、截图、拿去拍你自己题材的风格提示词、镜头与导演编排，也有 <a href="https://lemomo-ai.github.io/lemo-opuscar/opuscar98/styles.json">JSON</a>。</sub></td>
</tr></table>

<div align="center">

每一帧画面、每一个音符、每一刀剪辑，都是 Claude Opus 5.5 写代码做出来的。<br>
[**▶ 观看**](https://lemomo-ai.github.io/lemo-opuscar/opuscar98/) · [**98 种风格**](https://lemomo-ai.github.io/lemo-opuscar/opuscar98/#styles) · [**下载 1080p**](https://github.com/lemomo-ai/lemo-opuscar/releases/download/films/opuscar98.mp4)

</div>

## 👋 关于我

我是 **Lemomo**，更多信息见我的 [GitHub 主页](https://github.com/lemomo-ai)。

> **这不是一个 awesome 合集。** 这里所有的片子都是我自己用 Claude Opus 5.5 做的。<br>
> 风格是按 Opus 5.5 调出来的，换成其他模型不保证能做出同样的效果。

![全部风格](docs/cover.jpg)

每一支片子都是 AI agent 写代码导演、作画、配乐、混音的：

- 🎨 **画面**：Canvas 和 WebGL 页面逐帧渲染
- 🎵 **音乐**：用免费采样库写的原创配乐
- 🎙️ **配音**：TTS 语音合成

不用视频生成，也不用素材库画面。

## 怎么用

两种用法，推荐装 skill，最省事。

### 方式一：装成 skill（推荐）

在终端里：

```sh
claude plugin marketplace add lemomo-ai/lemo-opuscar
claude plugin install lemo-opuscar@lemolab
```

之后在任何目录都能用。

- 第一次使用时，它会把指南、工具和风格提示词下载到 `~/lemo-opuscar`，所有片子共用这一份。
- 每支片子的工程，从源码到成片，都放在你发起时所在的文件夹里。
- 其他 agent 可以把 [`plugin/skills/lemo-opuscar/`](plugin/skills/lemo-opuscar/) 复制到它们的 skills 目录。

### 方式二：clone 仓库

```sh
git clone https://github.com/lemomo-ai/lemo-opuscar.git
cd lemo-opuscar
claude
```

片子做到仓库里的 `films/<名字>/`。

### 然后直接说

> 用**油画厚涂**风格做一支 30 秒的片子，讲我家那只每天在窗台等我下班的橘猫。

> 用**点云测绘**风格做一支 40 秒的片子，讲我们镇后山那座废弃的采石场，数据用公开的激光扫描。

风格用中文名、英文名或文件夹名都行，全部风格见[风格索引](styles/README.md)。

它开工前只问你一次：

- 主题里它定不了的事；
- 你有没有自己的**配音、音乐或其他素材**；
- 要不要先看**分镜故事板**。要看的话，它会停一次，给你看用真实风格画出来的关键镜头；不看就直接做完成片。

agent 会读三份指南，像一个小工作室一样开工。<br>
指南是英文写给 agent 看的，你用中文跟它说就行，片子的配音和字幕默认跟你用的语言一致。

| 文件 | 给 agent 的东西 |
|---|---|
| [`DIRECTOR.md`](DIRECTOR.md) | 怎么导：故事、声音、节奏、镜头、表演、自检 |
| [`TECHNIQUE.md`](TECHNIQUE.md) | 怎么做：逐帧渲染、配音、配乐、混音 |
| `styles/<风格>/STYLE.md` | 这个风格长什么样、听起来什么样；故事由你定 |

### 开始之前

- 一支片子 agent 大约要做 30–60 分钟，token 用量不小。
- 需要 Node 20+、ffmpeg 和 Python 3.11+（或 [uv](https://docs.astral.sh/uv/)），其余由 agent 安装。
- 默认输出 1920×1080、24 fps，其他尺寸可以指定。

### 更新和卸载

更新，然后重启 Claude Code（`~/lemo-opuscar` 里的库会在下一次做片时自动更新）：

```sh
claude plugin marketplace update lemolab && claude plugin update lemo-opuscar@lemolab
```

卸载，然后删除 `~/lemo-opuscar`：

```sh
claude plugin uninstall lemo-opuscar@lemolab
```

一直卡住就[提个 issue](https://github.com/lemomo-ai/lemo-opuscar/issues)。

## 风格

点图片看它的 `STYLE.md`。

<!-- styles:start -->

### 实证影像

<table>
<tr>
<td width="33%" valign="top"><a href="styles/satellite-briefing/STYLE.md"><img src="docs/frames/satellite-briefing.jpg" alt="卫星简报"></a><br><b>卫星简报</b><br>Satellite Briefing<br><i>The Map Still Says Sea</i><br><sub>卫星照着地图去找咸海，找到的是沙漠；唯一回来的那一小块，是有人筑坝留住的。</sub></td>
<td width="33%" valign="top"><a href="styles/briefing-board/STYLE.md"><img src="docs/frames/briefing-board.jpg" alt="工程简报板"></a><br><b>工程简报板</b><br>Engineering Briefing Board<br><i>The Ship Decides</i><br><sub>一条河要架桥，四种桥型在一面简报墙上逐个受检，拍板的是桥下要过的船。</sub></td>
<td width="33%" valign="top"><a href="styles/lidar-survey/STYLE.md"><img src="docs/frames/lidar-survey.jpg" alt="点云测绘"></a><br><b>点云测绘</b><br>LiDAR Survey<br><i>The Fields Under the Forest</i><br><sub>激光点云把康涅狄格州一片森林的树冠一层层剥掉，地面上露出当年农田的石墙：描出 3.4 公里，逐一量过。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/white-model/STYLE.md"><img src="docs/frames/white-model.jpg" alt="白模投影"></a><br><b>白模投影</b><br>Projection on White Model<br><i>How a Flattened City Grew Back</i><br><sub>投影机把数据一层层刷上鹿特丹白模：1940 年前留下的楼、填满空洞的几十年、长起来的塔楼，以及最高那栋在冬至正午投向战前屋顶的影子。</sub></td>
<td width="33%" valign="top"><a href="styles/data-physical/STYLE.md"><img src="docs/frames/data-physical.jpg" alt="数据实物化"></a><br><b>数据实物化</b><br>Data Physicalization<br><i>Two Spirals</i><br><sub>十二年的风电和太阳能装机，按同一个单位叠成实物，绕胡桃木表盘升成两条螺旋：2014 年风电领先，2021 年太阳能超过，2025 年比值整个反了过来。</sub></td>
<td width="33%" valign="top"><a href="styles/teardown/STYLE.md"><img src="docs/frames/teardown.jpg" alt="产品拆解"></a><br><b>产品拆解</b><br>Exploded Teardown<br><i>21 Keys, Opened</i><br><sub>开源键盘的一半在一次环绕中逐层拆开，镜头钻到电路板背面看主控、灯珠和热插拔座，再合拢，把真实尺寸画在实物上。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/microscope/STYLE.md"><img src="docs/frames/microscope.jpg" alt="显微叙事"></a><br><b>显微叙事</b><br>Microscope Story<br><i>Measured Blue</i><br><sub>一镜从肉眼看到的肝组织玻片推到单个细胞核；相隔 1.4 毫米的两个圆被逐像素计数，其中一个的蓝色是另一个的 2.4 倍。</sub></td>
<td width="33%" valign="top"><a href="styles/archive-lighttable/STYLE.md"><img src="docs/frames/archive-lighttable.jpg" alt="档案灯台"></a><br><b>档案灯台</b><br>Archive Light Table<br><i>Two Seconds Short</i><br><sub>电报说最长一次飞了 57 秒，第二天报纸照登；放大镜下，莱特兄弟的玻璃底片和国会图书馆的记录说是 59 秒。</sub></td>
</tr>
</table>

### 手绘与绘画

<table>
<tr>
<td width="33%" valign="top"><a href="styles/crayon-book/STYLE.md"><img src="docs/frames/crayon-book.jpg" alt="蜡笔儿童绘本"></a><br><b>蜡笔儿童绘本</b><br>Crayon Picture Book<br><i>The Moon Can&#x27;t Sleep</i><br><sub>月亮失眠了，小女孩爬上屋顶给它唱摇篮曲。</sub></td>
<td width="33%" valign="top"><a href="styles/watercolor/STYLE.md"><img src="docs/frames/watercolor.jpg" alt="水彩笔刷"></a><br><b>水彩笔刷</b><br>Watercolor Brush<br><i>Follow the Rain</i><br><sub>跟着降雨从澳洲红色腹地一路画到绿色海岸，一镜到底。</sub></td>
<td width="33%" valign="top"><a href="styles/ink-wash/STYLE.md"><img src="docs/frames/ink-wash.jpg" alt="中国水墨"></a><br><b>中国水墨</b><br>Chinese Ink Wash<br><i>The Swordsman and the River</i><br><sub>侠客踏水过江，一剑断流。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/impasto/STYLE.md"><img src="docs/frames/impasto.jpg" alt="油画厚涂"></a><br><b>油画厚涂</b><br>Impasto Oil Painting<br><i>The Colour of Rain</i><br><sub>灰色雨中广场，第一把红伞撑开，圆舞曲把整个广场刷上颜色。</sub></td>
<td width="33%" valign="top"><a href="styles/one-line/STYLE.md"><img src="docs/frames/one-line.jpg" alt="一笔画"></a><br><b>一笔画</b><br>One-line Drawing<br><i>The Line That Never Lifted</i><br><sub>一根不离纸的线画完一个人的一生，再把笔交给孩子。</sub></td>
<td width="33%" valign="top"><a href="styles/whiteboard/STYLE.md"><img src="docs/frames/whiteboard.jpg" alt="白板讲解"></a><br><b>白板讲解</b><br>Whiteboard Explainer<br><i>Einstein in Your Pocket</i><br><sub>手机怎么知道你在哪：GPS、原子钟，和相对论每天多出的 38 微秒。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/urban-sketch/STYLE.md"><img src="docs/frames/urban-sketch.jpg" alt="钢笔淡彩"></a><br><b>钢笔淡彩</b><br>Urban Sketch · Pen &amp; Wash<br><i>Where the Wind Went</i><br><sub>公园只是一张钢笔速写，风把草帽吹到哪里，哪里才有颜色。</sub></td>
</tr>
</table>

### 东方传统

<table>
<tr>
<td width="33%" valign="top"><a href="styles/shadow-puppet/STYLE.md"><img src="docs/frames/shadow-puppet.jpg" alt="皮影戏"></a><br><b>皮影戏</b><br>Shadow Puppetry<br><i>Hou Yi Shoots the Suns</i><br><sub>十日炙烤大地，后羿张弓射日。</sub></td>
<td width="33%" valign="top"><a href="styles/ukiyoe/STYLE.md"><img src="docs/frames/ukiyoe.jpg" alt="浮世绘"></a><br><b>浮世绘</b><br>Ukiyo-e<br><i>A Journey Toward the Mountain</i><br><sub>旅人走向远山，每个镜头都是一幅版画，最后迎来一道巨浪。</sub></td>
<td width="33%" valign="top"><a href="styles/papercut-red/STYLE.md"><img src="docs/frames/papercut-red.jpg" alt="红色窗花剪纸"></a><br><b>红色窗花剪纸</b><br>Red Paper-cut<br><i>Nian Comes to Town</i><br><sub>除夕年兽进村，小女孩剪出的大窗花照亮全村，把它吓跑。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/paper-lantern/STYLE.md"><img src="docs/frames/paper-lantern.jpg" alt="纸雕灯影"></a><br><b>纸雕灯影</b><br>Paper-cut Lightbox<br><i>A Mooncake&#x27;s Longing</i><br><sub>一枚月饼讲中秋的团圆与思念，纸雕灯箱层层透光。</sub></td>
</tr>
</table>

### 印刷与版画

<table>
<tr>
<td width="33%" valign="top"><a href="styles/risograph/STYLE.md"><img src="docs/frames/risograph.jpg" alt="Risograph 丝网印刷"></a><br><b>Risograph 丝网印刷</b><br>Risograph Print<br><i>Sunday Ride</i><br><sub>周日早晨骑车穿过城市：面包店、公园、河边。</sub></td>
<td width="33%" valign="top"><a href="styles/halftone-dossier/STYLE.md"><img src="docs/frames/halftone-dossier.jpg" alt="复古半调案卷"></a><br><b>复古半调案卷</b><br>Halftone Dossier<br><i>Case File: Chubby</i><br><sub>橘猫胖橘被立案审查：测试重力、凌晨跑酷，最后无罪释放。</sub></td>
<td width="33%" valign="top"><a href="styles/woodcut/STYLE.md"><img src="docs/frames/woodcut.jpg" alt="木刻版画"></a><br><b>木刻版画</b><br>Woodcut Print<br><i>The Bell Founder</i><br><sub>村子用一整个冬天铸一口钟，钟声第一次响起，雪停了。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/engraving/STYLE.md"><img src="docs/frames/engraving.jpg" alt="铜版画"></a><br><b>铜版画</b><br>Copperplate Engraving<br><i>The Honeybee, Plate VII</i><br><sub>一张博物志图版自己刻出来：雕刀推开铜版，蜜蜂一线线成形，最后手工水彩上色。</sub></td>
<td width="33%" valign="top"><a href="styles/silkscreen-poster/STYLE.md"><img src="docs/frames/silkscreen-poster.jpg" alt="丝印旅行海报"></a><br><b>丝印旅行海报</b><br>Silkscreen Travel Poster<br><i>Three Trails</i><br><sub>三条步道各一张丝印海报，一色一刮印出来，再沿山脊一镜到底从正午爬到黄昏。</sub></td>
</tr>
</table>

### 图形与排版

<table>
<tr>
<td width="33%" valign="top"><a href="styles/swiss-motion/STYLE.md"><img src="docs/frames/swiss-motion.jpg" alt="瑞士动态排版"></a><br><b>瑞士动态排版</b><br>Swiss Motion Graphics<br><i>Five Rules for a Poster</i><br><sub>一张音乐会海报按瑞士设计的五条规则自己排版，第五条是只打破一条。</sub></td>
<td width="33%" valign="top"><a href="styles/spy-titles/STYLE.md"><img src="docs/frames/spy-titles.jpg" alt="60s 间谍片头"></a><br><b>60s 间谍片头</b><br>60s Spy Title Sequence<br><i>The Velvet Cipher</i><br><sub>虚构 1964 年间谍片的片头：追一把被偷的钥匙，几何碎片最后拼成片名。</sub></td>
<td width="33%" valign="top"><a href="styles/art-deco/STYLE.md"><img src="docs/frames/art-deco.jpg" alt="装饰艺术"></a><br><b>装饰艺术</b><br>Art Deco<br><i>Midnight at the Starlight Hotel</i><br><sub>1930 年的大饭店，门童赶在午夜前把一封信送上顶楼。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/blueprint/STYLE.md"><img src="docs/frames/blueprint.jpg" alt="蓝图 / 工程制图"></a><br><b>蓝图 / 工程制图</b><br>Blueprint<br><i>Patent Pending: The Cloud Catcher</i><br><sub>发明家的蓝图自己画出一台接云机器，修订云线变成了真的雨云。</sub></td>
<td width="33%" valign="top"><a href="styles/stained-glass/STYLE.md"><img src="docs/frames/stained-glass.jpg" alt="彩色玻璃窗"></a><br><b>彩色玻璃窗</b><br>Stained Glass<br><i>The Dragon of the East Window</i><br><sub>阳光从清晨移到黄昏，照到哪一格花窗，哪一格的故事就动起来。</sub></td>
<td width="33%" valign="top"><a href="styles/pictogram-motion/STYLE.md"><img src="docs/frames/pictogram-motion.jpg" alt="象形运动图形"></a><br><b>象形运动图形</b><br>Pictogram Motion<br><i>Aichi-Nagoya 2026 — All 43 Sports</i><br><sub>2026 亚运会 43 个大项，几何象形人卡着节拍快闪。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/ascii-crt/STYLE.md"><img src="docs/frames/ascii-crt.jpg" alt="ASCII / CRT 终端"></a><br><b>ASCII / CRT 终端</b><br>ASCII / CRT Terminal<br><i>Tranquility.log</i><br><sub>月球基地的 AI 沉睡 40 年后被唤醒，用字符画出“家”来回复。</sub></td>
</tr>
</table>

### 信息与发布

<table>
<tr>
<td width="33%" valign="top"><a href="styles/dataviz/STYLE.md"><img src="docs/frames/dataviz.jpg" alt="数据叙事"></a><br><b>数据叙事</b><br>Data Storytelling<br><i>A Hundred Summers</i><br><sub>一百年的夏季气温，图表本身就是故事。</sub></td>
<td width="33%" valign="top"><a href="styles/iso-infographic/STYLE.md"><img src="docs/frames/iso-infographic.jpg" alt="等距信息图"></a><br><b>等距信息图</b><br>Isometric Infographic<br><i>From Bean to Cup</i><br><sub>一杯咖啡从种植园到你手里的旅程。</sub></td>
<td width="33%" valign="top"><a href="styles/dark-keynote/STYLE.md"><img src="docs/frames/dark-keynote.jpg" alt="暗色科技发布"></a><br><b>暗色科技发布</b><br>Dark Tech Keynote<br><i>Room to Think</i><br><sub>虚构 app Tidy 的发布片：被埋掉的光标一键把几百个窗口归位。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/living-screencast/STYLE.md"><img src="docs/frames/living-screencast.jpg" alt="活体实机录屏"></a><br><b>活体实机录屏</b><br>Living Screencast<br><i>Clawd Moves In</i><br><sub>像素小人 Clawd 跳出终端、搬进 Claude 应用，在一镜到底的录屏里演示 Plan 模式、diff 评论和自检。</sub></td>
<td width="33%" valign="top"><a href="styles/hologram-hud/STYLE.md"><img src="docs/frames/hologram-hud.jpg" alt="科幻全息界面"></a><br><b>科幻全息界面</b><br>Sci-fi Hologram HUD<br><i>Volt · Spec Scan</i><br><sub>一辆电助力车被扫描成全息线框，目标框依次锁定电池、电机、刹车，参数逐个滚到真值。</sub></td>
</tr>
</table>

### 卡通与动画

<table>
<tr>
<td width="33%" valign="top"><a href="styles/rubber-hose/STYLE.md"><img src="docs/frames/rubber-hose.jpg" alt="1930s 橡皮管卡通"></a><br><b>1930s 橡皮管卡通</b><br>1930s Rubber Hose Cartoon<br><i>Coffee Cup Chase</i><br><sub>一只咖啡杯满厨房追一块逃跑的方糖。</sub></td>
<td width="33%" valign="top"><a href="styles/cel-anime-80s/STYLE.md"><img src="docs/frames/cel-anime-80s.jpg" alt="80 年代赛璐璐动画"></a><br><b>80 年代赛璐璐动画</b><br>80s Cel Anime<br><i>City Lights, 1987</i><br><sub>快递少女骑车穿过雨后霓虹都市，赶在黎明发射前送到一盘磁带。</sub></td>
<td width="33%" valign="top"><a href="styles/scifi-toon/STYLE.md"><img src="docs/frames/scifi-toon.jpg" alt="科幻情景喜剧卡通"></a><br><b>科幻情景喜剧卡通</b><br>Sci-Fi Sitcom Toon<br><i>Coffee Run</i><br><sub>厌世天才开传送门只想买杯咖啡，却穿过越来越离谱的平行宇宙。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/midcentury-toon/STYLE.md"><img src="docs/frames/midcentury-toon.jpg" alt="50s 扁平卡通"></a><br><b>50s 扁平卡通</b><br>Mid-century Cartoon<br><i>Meet Pip</i><br><sub>用 50 年代教育片的口吻，三步教你装好一台扫地机：放充电座、连 app、按开始。</sub></td>
</tr>
</table>

### 游戏

<table>
<tr>
<td width="33%" valign="top"><a href="styles/pixel-rpg/STYLE.md"><img src="docs/frames/pixel-rpg.jpg" alt="16-bit 像素 RPG"></a><br><b>16-bit 像素 RPG</b><br>16-bit Pixel RPG<br><i>The Last Save Point</i><br><sub>勇士在最终 Boss 门前存档，存档画面闪回一路冒险。</sub></td>
<td width="33%" valign="top"><a href="styles/hd-2d/STYLE.md"><img src="docs/frames/hd-2d.jpg" alt="HD-2D"></a><br><b>HD-2D</b><br><i>The Lampbearer</i><br><sub>灯塔熄灭，孙女提着最后一簇火穿过夜林、爬上风暴悬崖。</sub></td>
<td width="33%" valign="top"><a href="styles/microgame/STYLE.md"><img src="docs/frames/microgame.jpg" alt="微游戏快闪（瓦里奥制造式）"></a><br><b>微游戏快闪（瓦里奥制造式）</b><br>Microgame Frenzy<br><i>Five-Second Astronaut</i><br><sub>见习宇航员闯五秒训练营，越来越快，Boss 关亲手降落回地球。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/game-show/STYLE.md"><img src="docs/frames/game-show.jpg" alt="综艺节奏扁平"></a><br><b>综艺节奏扁平</b><br>Game Show Flat<br><i>Rhythm of AI, 1997 → 2026</i><br><sub>把 AI 发展史做成一局节奏游戏，模型踩着拍登场，最后发成绩单。</sub></td>
</tr>
</table>

### 电影与时代

<table>
<tr>
<td width="33%" valign="top"><a href="styles/silent-film/STYLE.md"><img src="docs/frames/silent-film.jpg" alt="1920s 默片"></a><br><b>1920s 默片</b><br>1920s Silent Film<br><i>The Runaway Loaf</i><br><sub>面包店学徒追一个滚走的面包，最后掰成两半分给饿肚子的小女孩。</sub></td>
<td width="33%" valign="top"><a href="styles/backrooms/STYLE.md"><img src="docs/frames/backrooms.jpg" alt="后室 / 新怪谈"></a><br><b>后室 / 新怪谈</b><br>Liminal Found Footage<br><i>Night Shift Orientation</i><br><sub>新夜班员工拍下入职第一晚：无尽的黄色办公空间，和墙上的员工守则。</sub></td>
</tr>
</table>

### 材质与 3D

<table>
<tr>
<td width="33%" valign="top"><a href="styles/brick-toy/STYLE.md"><img src="docs/frames/brick-toy.jpg" alt="积木玩具"></a><br><b>积木玩具</b><br>Brick Toy<br><i>Rocket from Spare Parts</i><br><sub>积木宇航员用零件拼出火箭，飞向积木月亮。</sub></td>
<td width="33%" valign="top"><a href="styles/paper-popup/STYLE.md"><img src="docs/frames/paper-popup.jpg" alt="纸片立体书"></a><br><b>纸片立体书</b><br>Paper Pop-up Book<br><i>Pip&#x27;s Paper Adventure</i><br><sub>立体书在书桌上打开，小精灵 Pip 在纸片世界冒险，最后跳出书外。</sub></td>
<td width="33%" valign="top"><a href="styles/tilt-shift/STYLE.md"><img src="docs/frames/tilt-shift.jpg" alt="移轴微缩"></a><br><b>移轴微缩</b><br>Tilt-Shift Miniature<br><i>Toy Town Rush Hour</i><br><sub>玩具城的早高峰，一切都像模型。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/lowpoly-island/STYLE.md"><img src="docs/frames/lowpoly-island.jpg" alt="低多边形等距"></a><br><b>低多边形等距</b><br>Low-poly Isometric Island<br><i>The Island That Grew</i><br><sub>空海里一格格长出小岛和村庄，每放一块响一个音符，直到星空。</sub></td>
<td width="33%" valign="top"><a href="styles/glass-product/STYLE.md"><img src="docs/frames/glass-product.jpg" alt="玻璃质感产品"></a><br><b>玻璃质感产品</b><br>Glass Product Render<br><i>Aura — Hear the Light</i><br><sub>虚构玻璃耳机 Aura 的开箱与特写。</sub></td>
</tr>
</table>
<!-- styles:end -->

## Star 增长

<a href="https://www.star-history.com/#lemomo-ai/lemo-opuscar&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lemomo-ai/lemo-opuscar&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lemomo-ai/lemo-opuscar&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lemomo-ai/lemo-opuscar&type=Date" />
 </picture>
</a>

### 谢谢每一颗星

每到一个里程碑做一支感谢片，和库里所有片子一样全部用代码做成。<br>
点海报到<a href="https://lemomo-ai.github.io/lemo-opuscar/thanks/">感谢片页面</a>在线观看。

<table><tr>
<td width="33%" valign="top"><a href="https://lemomo-ai.github.io/lemo-opuscar/thanks/#stars2000"><img src="docs/thanks/thanks-2000.jpg" alt="2000 星 · 刷新（50 秒）"></a><br><sub>2000 星 · 刷新（50 秒）</sub></td>
<td width="33%" valign="top"><a href="https://lemomo-ai.github.io/lemo-opuscar/thanks/#stars800"><img src="docs/thanks/thanks-800.jpg" alt="800 星 · 反打（39 秒）"></a><br><sub>800 星 · 反打（39 秒）</sub></td>
<td width="33%" valign="top"><a href="https://lemomo-ai.github.io/lemo-opuscar/thanks/#stars300"><img src="docs/thanks/thanks-300.jpg" alt="300 星 · 点灯人（18 秒）"></a><br><sub>300 星 · 点灯人（18 秒）</sub></td>
</tr></table>

## 授权

**LemoLab × Claude Opus 5.5** 出品。

- **代码和文档**：MIT 协议。
- **样片视频及其静帧**（`styles/`、画廊页和 Releases 中的）：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hans)。可以转载、改编和商用，须署名 **LemoLab** 并附本仓库链接，改动过的须注明。
- **你用本库做出的片子**：归你自己，无须署名。
- **样片中的第三方素材**：沿用各自的授权，见各样片的 `CREDITS`。

你在自己片子里使用的素材由你负责。

## LemoLab 的其他项目

- 📸 **[lemo-wake](https://github.com/lemomo-ai/lemo-wake)**：一张图进去，一段约 5 秒、无缝循环的动图出来。
- 🍋 **[lemo-mod](https://github.com/lemomo-ai/lemo-mod)**：给 Claude Code 换上 21 套风格，终端和桌面 App 都能用。
- 🟥 **[小章 Stampy](https://github.com/lemomo-ai/lemo-stampy)**：Mac 菜单栏小工具，在预览里点一下，给复印件盖上「仅供××使用」。

---

<div align="center">

⭐ **点个星**<br>
👀 **Watch → Custom → Releases**，有新版本会通知你<br>
𝕏 关注 [@lemomo_ai](https://x.com/lemomo_ai)

<sub>LemoLab · by Lemomo</sub>

</div>
