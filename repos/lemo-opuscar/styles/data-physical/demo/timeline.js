// 《两条螺旋》Two Spirals — 唯一的时间源：节拍、旁白、字幕、事件
// 96 BPM，4/4：一拍 0.625 s，一小节 2.5 s。画面动作、旁白起点、音乐重拍都对在这张格子上。
export const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
export const q = (bar, beat = 0) => +(bar * BAR + beat * BEAT).toFixed(4);   // 小节 + 拍 → 秒
export const DUR = q(15, 3);                     // 39.375 s

// 每一对（风电 + 太阳能）开始叠起的时刻
export const BUILD = {
  2014: q(0, 0) + .1,
  2015: q(4, 0), 2016: q(4, 2), 2017: q(5, 0), 2018: q(5, 2), 2019: q(6, 0), 2020: q(6, 2),
  2021: q(7, 0),
  2022: q(9, 1), 2023: q(9, 2), 2024: q(9, 3), 2025: q(10, 0),
};
export const BUILD_LEN = { 2014: BEAT * 1.6, 2021: BEAT * 1.6, def: BEAT * 1.4, fast: BEAT * .9 };
export const T = {
  hold14: [q(0, 3), q(3, 0)],                    // 2014 一对的两个读数停稳
  verdict14: q(2, 0),                            // "将近两倍"判定（读数已停 ≥ 2.5 s）
  unit: [q(3, 0), q(4, 0)],                      // 推近：一片 = 10 GW，黄铜 = 100 GW
  hold21: [q(7, 2) + .1, q(8, 3)],                   // 2020 / 2021 两对四个读数停稳
  suck: q(8, 2.4),                               // 判定前的抽空
  verdict21: q(8, 3),                            // 超过
  drop25: q(10, 1),                              // 2025 当年新增的片开始落
  dropStep: BEAT / 10,                           // 52 片，每 1/10 拍一片
  crane: q(12, 0),                               // 拉远成表盘
  suck2: q(13, 2),
  puck: q(13, 3),                                // 最后一件实物（黄铜圆片）落定
  end: q(14, 2),                                 // 落版卡
};

// 旁白（英文，Kokoro af_heart）与双语字幕：中文一行、英文一行，各自绝不换行
export const VO = [
  { id: 'l1', t: q(0, 2), text: 'In 2014, the world had almost twice as much wind power as solar.',
    zh: '2014 年，全球风电装机将近太阳能的两倍。' },
  { id: 'l2', t: q(3, 0), text: 'Every plate is ten gigawatts. Every brass plate, one hundred.',
    zh: '每一片是 10 GW，每一片黄铜是 100 GW。' },
  { id: 'l3', t: q(4, 3), text: 'Wind kept growing. Solar grew faster.',
    zh: '风电一直在涨，太阳能涨得更快。' },
  { id: 'l4', t: q(8, 3), text: 'In 2021, solar passed wind.',
    zh: '2021 年，太阳能超过了风电。' },
  { id: 'l5', t: q(10, 1), text: 'In 2025 alone, solar added more than five hundred gigawatts.',
    zh: '仅 2025 一年，太阳能就新增了 500 多 GW。' },
  { id: 'l6', t: q(12, 1), text: 'Step back, and twelve years become one dial.',
    zh: '退后一步，十二年合成一张表盘。' },
  { id: 'l7', t: q(14, 0), text: 'Now it is the other way round.',
    zh: '如今，正好反了过来。' },
];
export const VOICE = { voice: 'af_heart', speed: .95, lang: 'en-us' };

// 画面上所有固定文字（字体子集也从这里取字）
export const LABELS = {
  wind: '风电', solar: '太阳能',
  verdict14: '风电 = 太阳能 × 1.95',
  unit1: '1 片 = 10 GW', unit2: '黄铜 = 100 GW',
  verdict21: '2021 · 太阳能超过风电',
  c25: '2025 · 太阳能累计装机', add25: '当年新增 +513.5 GW',
  puck: '2025 · 太阳能装机是风电的 1.86 倍',
  title: '两条螺旋', titleEn: 'Two Spirals',
  style: 'DATA PHYSICALIZATION · 数据实物化',
  sign: 'LemoLab × Claude Opus 5.5',
  source: '数据：IRENA (2026)，经 Our World in Data 整理 · CC BY 4.0',
};
