// 《差两秒》 Two Seconds Short — the single timeline. 90 BPM, one beat = 2/3 s; every key action sits on the grid.
// film.js (picture), tools/export.mjs (voice cues, subtitles, cue list) and mix.py (via out/timeline.json) read it.
export const BPM = 90, BEAT = 60 / BPM, DUR = 40.0;
export const b = n => +(n * BEAT).toFixed(4);          // beat -> seconds

// key actions (seconds); [name, beat] so the cue check can verify the grid
export const HIT = {
  lightOn: b(1),            // 0.667  tubes catch after two flickers
  drop1: b(2),              // 1.333  loupe lands on the telegram
  dive1: b(3),              // 2.0    push into the lens
  lineDate: b(4),           // 2.667  "Kitty Hawk N C Dec 17" lights
  lineSuccess: b(6),        // 4.0    "Success four flights ..."
  line57: b(11),            // 7.333  "... longest 57 seconds ..."
  pull57: b(12),            // 8.0    57 lifts out as a reading
  rise1: b(14),             // 9.333  out of the lens
  lift1: b(15.5),           // 10.333 loupe lifts
  newsLine: b(18),          // 12.0   newspaper line lights
  ring57: b(18.5),          // 12.333 ring on the printed 57
  drop2: b(22),             // 14.667 loupe lands on the first-flight negative
  develop: b(22.5),         // 15.0   negative -> positive wave
  dive2: b(24),             // 16.0   push into the lens
  suck: b(26.4),            // 17.6   breath in
  enter: b(27),             // 18.0   inside the photograph (the downbeat)
  flyTitle: b(28),          // 18.667 label: first flight
  credit: b(29.5),          // 19.667 photographer credit
  rise2: b(34),             // 22.667 out of the photograph
  drop3: b(37),             // 24.667 loupe lands on the fourth-flight negative
  dive3: b(37.5),           // 25.0
  measure: b(39.5),         // 26.333 the measuring line starts
  land852: b(43),           // 28.667 852 ft
  land59: b(45),            // 30.0   59 s
  compare: b(46),           // 30.667 both readings side by side (held 2.67 s)
  hush: b(49.2),            // 32.8   silence before the verdict
  verdict: b(50),           // 33.333 57 struck
  rise3: b(52.5),           // 35.0   out of the photograph, pull back over the whole table
  index: b(53.5),           // 35.667 index rows start flying in
  endCard: b(54.5),         // 36.333 end card
};

// narration (Kokoro bm_george); t = start; durations come from voice/out/dur.json at build time
export const VOICE = [
  { id: 'L1', t: 0.42, text: 'December seventeenth, nineteen oh three.' },
  { id: 'L2', t: 3.55, text: 'Orville wired home: success, four flights.' },
  { id: 'L3', t: 6.95, text: 'The longest, fifty-seven seconds.' },
  { id: 'L4', t: 10.85, text: 'Next day, the paper printed the same number.' },
  { id: 'L5', t: 18.35, text: 'The first flight lasted twelve seconds. One hundred and twenty feet.' },
  { id: 'L7', t: 25.55, text: 'The fourth flight: eight hundred and fifty-two feet, in fifty-nine seconds.' },
  { id: 'L8', t: 33.6, text: 'The telegram was two seconds short.' },
];

// bilingual subtitles: one Chinese line + one English line per cue, never wrapped (split long lines into cues)
// t0/t1 are filled from the voice timing by tools/export.mjs: a cue starts with its line (or, with `from`, with that
// word, from the speech check's word timestamps) and holds to the next cue of the line, or to the speech end + 0.6 s
export const SUBS = [
  { id: 'S1', line: 'L1', zh: '1903 年 12 月 17 日。', en: 'December 17, 1903.' },
  { id: 'S2', line: 'L2', zh: '奥维尔给家里发电报：成功，飞了四次。', en: 'Orville wired home: success, four flights.' },
  { id: 'S3', line: 'L3', zh: '最长一次，57 秒。', en: 'The longest, 57 seconds.' },
  { id: 'S4', line: 'L4', zh: '第二天，报纸登出了同一个数字。', en: 'Next day, the paper printed the same number.' },
  { id: 'S5a', line: 'L5', zh: '第一次飞行持续了 12 秒。', en: 'The first flight lasted 12 seconds.' },
  { id: 'S5b', line: 'L5', from: '120', zh: '飞了 120 英尺。', en: 'One hundred and twenty feet.' },
  { id: 'S7a', line: 'L7', zh: '第四次飞行：852 英尺，', en: 'The fourth flight: 852 feet,' },
  { id: 'S7b', line: 'L7', from: 'in', zh: '用时 59 秒。', en: 'in 59 seconds.' },
  { id: 'S8', line: 'L8', zh: '电报少算了两秒。', en: 'The telegram was two seconds short.' },
];
