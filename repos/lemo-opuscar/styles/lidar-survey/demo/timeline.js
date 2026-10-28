// The one timeline: picture, score, foley, voice and subtitles all read these numbers.
// 96 BPM, 4/4: one beat = 0.625 s, one bar = 2.5 s. Key actions sit on beats (tools/cuecheck.py checks).
export const BPM = 96;
export const BEAT = 60 / BPM;
export const b = n => +(n * BEAT).toFixed(4);

export const T = {
  photo: 0,
  scan1: b(6),        // 3.75   the scan line enters: photo -> points
  scan1End: b(11),    // 6.875
  r0: b(12),          // 7.5    reading: ground returns 27.6 %
  r0Off: b(18),       // 11.25
  peel: b(16),        // 10.0   cutting plane at the canopy top, steps down once per beat
  peelEnd: b(21),     // 13.125 only ground returns left
  sil: b(21),         // 13.125 near silence
  turn: b(23),        // 14.375 the ground condenses (scan 2): impact
  turnEnd: b(25),     // 15.625
  walls: b(25),       // 15.625 walls light up one after another
  wallsEnd: b(32),    // 20.0
  r1: b(32),          // 20.0   total wall length rolls in
  r1Land: b(33),      // 20.625
  r1Off: b(39),       // 24.375
  sec: b(39),         // 24.375 section plane drops across one wall
  r2: b(40),          // 25.0   section reading lands
  r2Off: b(46),       // 28.75
  crane: b(46),       // 28.75  crane up
  card1: b(47),       // 29.375 1870
  card2: b(52),       // 32.5   2006
  cardsOff: b(57),    // 35.625
  ghost: b(54),       // 33.75  canopy returns
  closed: b(58),      // 36.25
  end: b(57.5),       // 35.9375 end card
  dur: 40.0,
};
export const PEEL_STEPS = [30, 24, 18, 12, 6, 0];   // cut height (m above ground) at b16 ... b21

// narration: id, start, spoken text, subtitle zh / en (one line each). Refined against real TTS durations by tools/export.mjs.
export const VO = [
  { id: 'l1', t: 0.45, say: "From the air, it's only forest.", zh: '从空中看，这里只是一片森林。', en: "From the air, it's only forest." },
  { id: 'l2', t: 3.95, say: 'But laser light slips between the leaves,', zh: '但激光能从叶隙间穿过，', en: 'But laser light slips between the leaves,' },
  { id: 'l3', t: 7.25, say: 'and some of it reaches the ground.', zh: '有一部分打到了地面。', en: 'and some of it reaches the ground.' },
  { id: 'l4', t: 10.25, say: 'Remove every return that hit a tree.', zh: '去掉每一个打在树上的回波。', en: 'Remove every return that hit a tree.' },
  { id: 'l5', t: 14.55, say: 'And the ground remembers.', zh: '地面还记得。', en: 'And the ground remembers.' },
  { id: 'l6', t: 17.0, say: 'Stone walls. Old fields, under the trees.', zh: '是石墙。一块块旧田，都在树下。', en: 'Stone walls. Old fields, under the trees.' },
  { id: 'l7', t: 20.9, say: 'We traced three point four kilometres of wall.', zh: '我们描出了 3.4 公里石墙。', en: 'We traced 3.4 km of wall.', asr: 'We traced 3.4 km of wall.' },
  { id: 'l8', t: 24.9, say: 'Just over half a metre high.', zh: '高半米出头。', en: 'Just over half a metre high.' },
  { id: 'l9', t: 28.9, say: 'In eighteen seventy, two thirds of Ashford was farmland.', zh: '1870 年，阿什福德三分之二是农田。', en: 'In 1870, two-thirds of Ashford was farmland.', asr: 'In 1870, two thirds of Ashford was farmland.' },
  { id: 'l10', t: 33.2, say: 'By two thousand and six, four fifths was forest.', zh: '到 2006 年，五分之四已是森林。', en: 'By 2006, four-fifths was forest.', asr: 'By 2006, four fifths was forest.' },
  { id: 'l11', t: 37.3, say: 'The forest kept the map.', zh: '森林替它保存了地图。', en: 'The forest kept the map.' },
];

// camera keys: t, target (x east, y up, z = -north; metres), distance, heading (deg, 0 = north, 90 = east), pitch (deg down), fov
export const CAM = [
  [0.0, -25, 222, 5, 480, -3, 90, 34],
  [3.75, -15, 222, -5, 395, 3, 88, 34],
  [6.875, 20, 226, -40, 230, 12, 44, 34],
  [10.0, 35, 230, -60, 105, 18, 15, 34],
  [13.125, 42, 228, -62, 92, 30, 14, 34],
  [14.375, 45, 226, -62, 100, 34, 17, 34],
  [15.625, 55, 223, -55, 170, 32, 26, 34],
  [20.0, 70, 218, -60, 480, 12, 48, 34],
  [22.5, 80, 216, -20, 445, 4, 46, 34],
  [24.375, 100, 212, 120, 230, -12, 34, 34],
  [25.6, 106, 211, 195, 100, -21, 23, 34],
  [28.75, 106, 211, 197, 88, -23, 21, 34],
  [31.5, 80, 214, 60, 330, -10, 42, 34],
  [35.6, 60, 216, 0, 470, 0, 56, 34],
  [40.0, 50, 216, -25, 560, 10, 62, 34],
];
