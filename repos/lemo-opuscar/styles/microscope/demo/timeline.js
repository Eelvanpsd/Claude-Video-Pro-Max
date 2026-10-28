// The single source of time for picture, score, foley, voice and subtitles.
// 90 BPM, 4/4: one beat = 0.6667 s, one bar = 2.6667 s.
export const BPM = 90;
export const BEAT = 60 / BPM;
export const bt = b => +(b * BEAT).toFixed(4);           // beat number -> seconds
export const DUR = 39.5;

// key moments, on the grid (beat numbers in comments)
export const T = {
  open: 0,
  push: bt(4),          // 2.667 bar 2: the slide -> tissue push
  tissue: bt(8),        // 5.333 bar 3: lands on the tissue, dimension line
  toA: bt(14),          // 9.333 push to nodule A
  circA: bt(16),        // 10.667 bar 5: circle A draws
  scanA: bt(16.5),      // 11.0 scan A
  landA: bt(19),        // 12.667 reading A lands
  truck: bt(23),        // 15.333 truck to B
  circB: bt(25),        // 16.667 circle B
  scanB: bt(25.5),      // 17.0 scan B
  landB: bt(27),        // 18.0 reading B lands
  both: bt(31),         // 20.667 pull back to both circles
  hush1: 21.8,          // silence 1 (to 22.667)
  verdict: bt(34),      // 22.667 the comparison: first sound after the silence
  dive: bt(40),         // 26.667 bar 11: dive to the nucleus
  land: bt(44),         // 29.333 lands, focal sweep
  ring: bt(44.5),       // 29.667 the measuring ring
  landN: bt(45),        // 30.0 nucleus reading lands
  hush2: 32.3,          // silence 2 (suck-out before the pull)
  pull: bt(49),         // 32.667 the pull-out
  card: bt(53),         // 35.333 end card
  end: DUR,
};

// narration: say = what Kokoro reads (numbers spelled out), zh / en = the subtitle lines (digits)
export const VO = [
  { id: 'v1', t: 0.60, say: 'One glass slide. One slice of human liver.',
    zh: '一张玻片，一片人肝组织。', en: 'One glass slide. One slice of human liver.' },
  { id: 'v2', t: 5.67, say: 'Four point eight millimeters across. The stain turns collagen blue.',
    asr: '4.8 millimeters across, the stain turns collagen blue.',
    zh: '宽 4.8 毫米。染色让胶原呈蓝色。', en: '4.8 mm across. The stain turns collagen blue.' },
  { id: 'v3', t: 11.0, say: 'In this one millimeter circle, blue covers thirteen point five percent.',
    asr: 'In this one millimeter circle, blue covers 13.5%.',
    zh: '这个直径 1 毫米的圆里，蓝色占 13.5%。', en: 'In this 1 mm circle, blue covers 13.5%.' },
  { id: 'v4', t: 16.9, say: 'One point four millimeters away: thirty two point six.',
    asr: '1.4 millimeters away, 32.6.',
    zh: '相隔 1.4 毫米：32.6%。', en: '1.4 mm away: 32.6%.' },
  { id: 'v5', t: 22.75, say: 'Same slice, same stain. Two point four times the blue.',
    asr: 'Same slice same stain 2.4 times the blue',
    zh: '同一片组织，同一种染色，蓝色是 2.4 倍。', en: 'Same slice, same stain: 2.4 times the blue.' },
  { id: 'v6', t: 29.4, say: 'One nucleus, eight point five microns across.',
    asr: 'One nucleus, 8.5 microns across.',
    zh: '一个细胞核，直径 8.5 微米。', en: 'One nucleus, 8.5 microns across.' },
  { id: 'v7', t: 33.1, say: 'Every number here was measured from the scan itself.',
    zh: '每个数字，都量自这张扫描本身。', en: 'Every number here was measured from the scan itself.' },
];

// numbers spoken and shown must equal the measurements (tools/export.mjs checks against plates.json / nucleus.json)
export const NUM = { tissue_mm: '4.8', A: '13.5', B: '32.6', ratio: '2.4', dist_mm: '1.4', nucleus_um: '8.5' };
