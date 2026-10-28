# Briefing Board kit (v3)

A small, data-driven kit for the Engineering Briefing Board look: one real whiteboard wall, filmed,
with cut-out photographs mounted on it, magnetic tags, magnets, a steel ruler, rubber stamps, and
marker ink that draws itself. One renderer makes the film, stills, thumbnails and social cards.
Everything is 2D layers composited with depth (parallax, shadows, depth of field, motion blur).

```
kit/
  board.js        renderer: board surface and light, camera (overlapping eased moves, impact shakes,
                  hand-held breath), prints, tags, magnets, ruler, card, stamp, ink, erasing,
                  bilingual subtitles; TEXTS for the reading check, SUBCHECK for one-line subtitles,
                  RESCHECK (source px per screen px of every print at time t)
  batch.mjs       scene JSON → PNG/JPG, many at once, any size
  objects/        the object library: <id>.png (cut-out) + <id>.json (size, anchors, credit, how it was cut)
  fonts/          LXGW Marker Gothic + Noto Sans SC (subsets), Archivo, IBM Plex Mono — all OFL, fetched by tools/fetch_fonts.py
  tools/
    kit_env.sh      the cut-out tools' private venv (demo/.venv: numpy, scipy, Pillow, onnxruntime) and the BiRefNet model
    fetch_sources.py the source photos listed as used in sources/candidates/candidates.json (Commons URLs, licences)
    prep_object.py  photo → cut-out object (BiRefNet ONNX mask, or a polygon / mask image without it; sky key, clean edge, shared grade)
    sky_key.py      a mask for thin things shot against a clear sky (cables, stays), to add to BiRefNet's
    redraw_stays.py      stay cables measured from the sky key and redrawn as clean lines (pylon stays in front)
    redraw_suspension.py main cables (fitted parabolas) and hangers (measured) redrawn as clean lines
    repair_hangers.py    hangers lost against a busy background continued down to the deck
    mirror_span.py / stretch_span.py   one pylon + fan mirrored into a main span / a main span stretched
    clean_lettering.py   median-filter wipe of names and logos inside rectangles (before cutting)
    make_print.py        an uncut photo on white photo paper, for pinned prints
    ship_anchors.py      bow / stern / waterline anchors of a side-view ship
    fetch_fonts.py  subset the Chinese fonts to the characters a scene uses (network)
    rebuild_objects.sh  rebuilds every object in objects/ from sources/, exactly as used
```

## Make frames

```sh
node kit/batch.mjs scenes/stills/*.json --out stills
```

A still reuses a world and sets its own camera and time:

```json
{ "extends": "scenes/film.json", "out": "thumb.jpg", "size": [1280, 720], "t": 35, "hand": 0,
  "cam": { "x": 2800, "y": 1780, "z": 0.22, "roll": 0, "moves": [] } }
```

A new film is a new world: copy `scenes/_gen_film.py`, change the layout, the timeline and the
objects. The look (board, light, ink, tags, magnets, camera behaviour) comes with the renderer.

## The world (scene JSON)

| key | meaning |
|---|---|
| `board` | `{w, h, seed, texScale, ghosts}` in board px (zoom 1 shows 1,920 board px across). Enamel, ghosts of erased marker, smudges and the frame come from `seed` |
| `light` | `{x, y, r, min}`: where the window light comes from and how far the board darkens away from it |
| `cam` | `{x, y, z, roll, moves, shakes}`. Each move `{t, d, dx, dy, dl (Δ ln zoom), dr, a, b}` adds an eased delta; moves may overlap. The ease has velocity ∝ u^a (1−u)^b, so speed and acceleration stay continuous; `a < b` starts quick and settles long (inertia). `shakes`: `{t, amp, f, k, dir}` for impacts |
| `hand` | hand-held breath amplitude (px); 0 for stills |
| `elements` | prints, tags, magnets, ruler, card, stamp, ink (below) |
| `subs` | `[{t0, t1, zh, en, speech}]`: burned-in bilingual subtitles, one line per language |
| `tray` | markers and an eraser lying in the tray |
| `mb` | `[{t0, t1, n}]` extra motion-blur samples while objects move fast |
| `ev` | sound events for the mix (`events.mjs` exports them) |

### Elements

| type | what | key fields |
|---|---|---|
| `print` | cut-out photo mounted off the board (real shadow, parallax) | `src`, `xy` (centre), `w` or `h`, `z`, `rot`, `arrive {t, kind: drop/slide/fade, d, lift, land}`, `moves` (eased travel), `leave` |
| `tag` | magnetic label | `text`, `xy` (the magnet), `size`, `rot`, `color`, `magnetColor`, `arrive {kind: swing/snap}`, `strike {t, d, color}` |
| `magnet` | round magnet | `xy`, `r`, `color` (graphite, red, blue, white), `arrive {kind: snap}`, `leave {kind: pop}` |
| `ruler` | steel ruler on two magnets | `from`, `to`, `w`, `arrive` |
| `card` | printed card pinned by magnets | `xy`, `w`, `h`, `rot`, `lines [{text, font: sc/mono/sans/marker, size, x, y, color}]`, `magnets` |
| `stamp` | rubber-stamp impression | `text`, `xy`, `size`, `rot`, `t` |
| `ink` · `line` | marker line, optional arrow, dashes | `points` (px or `"objectId.anchor"`), `lw`, `color`, `t`, `d`, `dash`, `arrow`, `ea`/`eb` |
| `ink` · `dim` | dimension with arrowheads and extension lines | `from`, `to`, `ext [[x, y0, y1]]` |
| `ink` · `write` | marker lettering (LXGW Marker Gothic), revealed glyph by glyph with a slight hand | `text`, `xy` (baseline), `size`, `align`, `rot` |
| `ink` · `hatch` | many short strokes with their own times (water, land hatching) | `strokes [{points, t, d}]` |
| `ink` · `ring` | hand-drawn ring | `c`, `r` (or `[rx, ry]`) |
| `ink` · `wake` | wake lines behind a moving print | `follow`, `len`; `dir: 'side'` + `y` (waterline) for a ship seen side-on |

Every ink element draws over `t … t + d`; `erase {t, d}` wipes it to a ghost; `out` fades it.

## Add an object

```sh
$LIB/.venv/bin/python kit/tools/prep_object.py <photo> <id> --keep-largest [--crop …] [--poly …] --anchor L=0.12,0.86 --anchor R=0.88,0.86
```

Anchors are in the output's normalised coordinates. Bridges carry `L` and `R` (the main-span supports at
the water line) so the scene can scale them to a span; the ship carries `bow` and `stern`.
Cut at the photo's own resolution (`--max` no smaller than the crop): `tools/rescheck.mjs` fails the build if any
frame shows a print at less than one source pixel per screen pixel. List every image in `CREDITS` with its source and licence.

## The look, as rules

- **No slide chrome.** No header, page margins, number blocks or centred layouts. Words are written on the board or pinned to it.
- **Things are physical, marks are drawn.** Prints, tags and magnets cast shadows and arrive with weight; ink is flat on the board and draws with its tip.
- **Three ink colours, one meaning each.** Graphite = names and rules. Blue = water and measurement. Red = the decision.
- **One wall.** The film never cuts to a page; the camera travels. The whole wall is seen once, at the end.
- **Readable.** One idea per beat; every text held for its reading time (`readcheck.mjs`).
