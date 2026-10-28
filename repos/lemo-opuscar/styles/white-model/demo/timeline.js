// The one timeline: picture, score, foley, voice and subtitles read these numbers.
// 100 BPM, 4/4: one beat = 0.6 s, one bar = 2.4 s. Key actions sit on beats (tools/cuecheck.py checks).
export const BPM = 100;
export const BEAT = 60 / BPM;
export const b = n => +(n * BEAT).toFixed(4);

export const T = {
  lightsOut: b(3),     // 1.8   house lights cut
  lamp: b(4),          // 2.4   projector lamp strikes; the pre-1940 wash spreads
  washEnd: b(8),       // 4.8
  date: b(10),         // 6.0   14 May 1940 stamp in the hole (after a short suck-out)
  stadhuis: b(13),     // 7.8   the city hall pinned
  g1: b(20),           // 12.0  1940–64 pops on
  g2: b(22),           // 13.2  1965–89
  g3: b(24),           // 14.4  1990–2009: across the river
  g4: b(26),           // 15.6  2010–25
  gEnd: b(27.5),       // 16.5
  hgt0: b(30),         // 18.0  the level of light starts to climb
  hgtTop: b(35),       // 21.0  tops out on Zalmhaven
  dark: b(36),         // 21.6  data off: silence
  sun: b(38),          // 22.8  the winter sun strikes (first sound after silence)
  noon: b(43),         // 25.8  clock lands on solar noon
  line0: b(45),        // 27.0  shadow range line grows
  lineEnd: b(48),      // 28.8  lands on 777 m
  roofs0: b(49),       // 29.4  roofs in the shadow ping on
  roofs1: b(52),       // 31.2
  lights: b(59),       // 35.4  house lights back up
  end: b(59.5),        // 35.7  end card
  dur: 40.0,
};
// growth layers: band index (model.json bands), onset, spread (seconds over which its buildings pop on)
export const GROW = [
  { band: 1, t: T.g1, spread: 1.0 },
  { band: 2, t: T.g2, spread: 0.9 },
  { band: 3, t: T.g3, spread: 0.9 },
  { band: 4, t: T.g4, spread: 0.75 },
];
// sun clock (CET minutes): morning to solar noon while the light arrives
export const CLOCK = { t0: T.sun, t1: T.noon, m0: 655, m1: 760 };

// narration: one line = one subtitle cue (zh above, en below, each a single line).
// Start times are checked against the real TTS durations (tools/export.mjs).
export const VO = [
  { id: 'l1', t: 2.5, speed: 1.08, say: 'Light everything built before nineteen forty.', zh: '点亮 1940 年以前建成的一切。', en: 'Light everything built before 1940.', asr: 'Light everything built before 1940.' },
  { id: 'l2', t: 6.15, speed: 1.0, say: 'May fourteenth, nineteen forty.', zh: '1940 年 5 月 14 日。', en: '14 May 1940.', asr: 'May 14th, 1940.' },
  { id: 'l3', t: 9.2, speed: 1.05, say: 'Bombs and fire took much of the centre.', zh: '炸弹和大火吞掉了大片市中心。', en: 'Bombs and fire took much of the centre.', asr: 'Bombs and fire took much of the centre.' },
  { id: 'l4', t: 12.45, speed: 1.08, say: 'Then, layer by layer, it grew back.', zh: '后来，它一层一层长了回来。', en: 'Then, layer by layer, it grew back.' },
  { id: 'l5', t: 15.5, speed: 1.08, say: 'After nineteen ninety, it crossed the river, and climbed.', zh: '1990 年后，它跨过了河，往上长。', en: 'After 1990, it crossed the river, and climbed.', asr: 'After 1990, it crossed the river, and climbed.' },
  { id: 'l7', t: 22.98, speed: 1.08, say: 'At midwinter noon, the sun stays below fifteen degrees.', zh: '冬至正午，太阳高度不到 15°。', en: 'At midwinter noon, the sun stays below 15°.', asr: 'At midwinter noon, the sun stays below 15 degrees.' },
  { id: 'l8', t: 27.33, speed: 1.08, say: "The tallest tower's shadow runs nearly eight hundred metres,", zh: '最高那栋楼的影子，拖出将近 800 米，', en: "The tallest tower's shadow runs nearly 800 m,", asr: "The tallest tower's shadow runs nearly 800 metres," },
  { id: 'l9', t: 31.7, speed: 1.0, say: 'across sixteen roofs. Nine were there before the war.', zh: '盖住 16 个屋顶，其中 9 栋战前就在。', en: 'across 16 roofs. Nine were there before the war.', asr: 'across 16 roofs. Nine were there before the war.' },
];
