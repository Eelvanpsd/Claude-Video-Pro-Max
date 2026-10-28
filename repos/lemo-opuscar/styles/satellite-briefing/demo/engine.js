// Satellite Briefing engine: one perspective camera around a spherical Earth, imagery plates sampled
// by lon/lat in a WebGL2 shader, and the same camera math in JS for the 2D annotation layer.
// One world -> screen function (project) serves every annotation, so lines stay glued to the ground.

export const R = 6371.0088;          // Earth radius, km
const D2R = Math.PI / 180;

// ------------------------------------------------------------------ vectors (double precision, JS)
const v = (x, y, z) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));

export function ecef(lat, lon, h = 0) {
  const p = lat * D2R, l = lon * D2R, r = R + h;
  return v(r * Math.cos(p) * Math.cos(l), r * Math.cos(p) * Math.sin(l), r * Math.sin(p));
}
function enu(lat, lon) {
  const p = lat * D2R, l = lon * D2R;
  const up = v(Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p));
  const east = v(-Math.sin(l), Math.cos(l), 0);
  const north = cross(up, east);
  return { up, east, north };
}

// camera: look at ground point (lat, lon) from distance d (km), tilt (deg from straight down),
// heading (deg, direction the camera faces, clockwise from north), roll (deg), vertical fov (deg),
// and a lens shift so the target can sit off-centre: (sx, sy) in pixels from the frame centre.
export function makeCamera({ lat, lon, d, tilt = 0, heading = 0, roll = 0, fov = 30, sx = 0, sy = 0 }, W = 1920, H = 1080) {
  const T = ecef(lat, lon, 0);
  const { up, east, north } = enu(lat, lon);
  const hd = heading * D2R, tl = tilt * D2R;
  const Hdir = add(mul(north, Math.cos(hd)), mul(east, Math.sin(hd)));
  const C = add(T, mul(add(mul(up, Math.cos(tl)), mul(Hdir, -Math.sin(tl))), d));
  const f = norm(sub(T, C));
  let u = norm(sub(add(mul(Hdir, Math.cos(tl)), mul(up, Math.sin(tl))), mul(f, 0)));   // screen-up before roll
  u = norm(sub(u, mul(f, dot(u, f))));
  let r = norm(cross(f, u));
  if (roll) { const rr = roll * D2R; const r2 = add(mul(r, Math.cos(rr)), mul(u, Math.sin(rr))); u = norm(cross(r2, f)); r = r2; }
  const F = (H / 2) / Math.tan(fov * D2R / 2);
  const Cc = mul(C, -1);                        // camera -> Earth centre
  const h = Math.hypot(C[0], C[1], C[2]) - R;   // altitude above the sphere
  return { C, f, u, r, F, W, H, sx, sy, Cc, c2: h * (2 * R + h), alt: h, tgt: { lat, lon } };
}

// world -> screen. Returns [x, y, visible] (visible = in front and on the camera's side of the globe)
export function project(cam, lat, lon, hgt = 0) {
  const P = ecef(lat, lon, hgt);
  const q = sub(P, cam.C);
  const z = dot(q, cam.f);
  const x = cam.W / 2 + cam.sx + cam.F * dot(q, cam.r) / z;
  const y = cam.H / 2 + cam.sy - cam.F * dot(q, cam.u) / z;
  const facing = dot(P, mul(q, -1)) > 0;      // surface normal points towards the camera
  return [x, y, z > 0 && facing];
}
// screen -> ground (lat, lon) or null
export function unproject(cam, x, y) {
  const nx = (x - cam.W / 2 - cam.sx) / cam.F, ny = -(y - cam.H / 2 - cam.sy) / cam.F;
  const d = norm(add(cam.f, add(mul(cam.r, nx), mul(cam.u, ny))));
  const b = dot(d, cam.Cc), disc = b * b - cam.c2;
  if (disc < 0) return null;
  const t = b - Math.sqrt(disc);
  const Q = sub(mul(d, t), cam.Cc);
  return [Math.asin(Q[2] / R) / D2R, Math.atan2(Q[1], Q[0]) / D2R];
}
// km per pixel at the target (for scale bars)
export function kmPerPx(cam) { return (cam.alt / Math.max(1e-6, Math.cos(0))) / cam.F; }

// ------------------------------------------------------------------ WebGL
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const FS = `#version 300 es
precision highp float; precision highp sampler2D;
out vec4 o;
uniform vec2 uRes; uniform vec2 uShift; uniform float uF;
uniform vec3 uR, uU, uFw, uCc; uniform float uC2;
// slots: 0 world, 1 ca, 2 regA, 3 regB, 4 detA, 5 detB, 6 maskA, 7 maskB
uniform sampler2D t0, t1, t2, t3, t4, t5, t6, t7, t8, t9, t10;
uniform vec4 b0, b1, b2, b3, b4, b5;          // plate bboxes (w, s, e, n) in degrees
uniform float a1, a2, a4;                     // plate opacities (world is always 1)
uniform float uScan2, uScanDir2, uScan4, uScanDir4;   // scan line latitude (A below / B above for dir +1)
uniform float uGlow2, uGlow4;
uniform float uGrey;                          // 0 true colour .. 1 analyst grey
uniform float uWaterCol;                      // north: water keeps its true colour
uniform vec3 uWaterAt;                        // ...only within this circle (lon, lat, radius in degrees)
uniform float uShade;                         // globe limb shading
uniform float uExpo;
uniform float uDetail;
uniform float uClarity;
uniform vec2 uBlurVec; uniform float uBlur;   // whip-pan motion blur (screen-space direction)
uniform float uDim;                           // overall dim for the end card
uniform float uContrast;                      // analysis-layer contrast around mid grey
uniform float uGrow;                          // north: water grows from the 2001 shore (-1 = off, 0..1 progress)
uniform vec4 b9;                              // map field bbox
uniform float uMap, uMapSea, uMapWipe;        // printed map: whole page / sea only / reveal scan latitude
const float RE = 6371.0088;

float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
vec2 uvOf(vec4 b, vec2 ll){ return vec2((ll.y - b.x) / (b.z - b.x), (b.w - ll.x) / (b.w - b.y)); }
float inside(vec2 uv, float f){ vec2 e = smoothstep(vec2(0.), vec2(f), uv) * smoothstep(vec2(0.), vec2(f), 1. - uv); return e.x * e.y; }
// true colour + a detail luminance (unsharp mask from a blurrier mip level)
vec4 samp(sampler2D t, vec2 uv){
  vec3 c = texture(t, uv).rgb;
  float l = lum(c);
  float m1 = lum(texture(t, uv, 1.6).rgb), m2 = lum(texture(t, uv, 4.0).rgb), m3 = lum(texture(t, uv, 6.5).rgb);
  float d = l + uDetail * (0.7 * (l - m1) + 0.45 * (m1 - m2));
  d = m3 + (d - m3) * (1. + uClarity);                  // clarity: local contrast around a wide mean
  return vec4(c, d);
}
vec4 ground(vec2 ll, out float wmask, out float scanGlow){
  wmask = 0.; scanGlow = 0.;
  vec2 u0 = vec2((ll.y + 180.) / 360., (90. - ll.x) / 180.);
  vec4 col = samp(t0, u0);
  vec2 u1 = uvOf(b1, ll); float w1 = inside(u1, .06) * a1;
  if (w1 > 0.) col = mix(col, samp(t1, u1), w1);
  vec2 u2 = uvOf(b2, ll); float w2 = inside(u2, .025) * a2;
  if (w2 > 0.) {
    vec4 A = samp(t2, u2);
    vec4 B = samp(t3, uvOf(b3, ll));
    float s = uScanDir2 * (ll.x - uScan2);
    float k = smoothstep(-fwidth(ll.x) * 36., fwidth(ll.x) * 36., s);   // a soft scan front, no hard edge
    col = mix(col, mix(A, B, k), w2);
    wmask = texture(t8, u2).r * w2;
    scanGlow += uGlow2 * w2 * .10 * exp(-max(s, 0.) / max(fwidth(ll.x) * 70., 1e-6)) * smoothstep(0., fwidth(ll.x) * 30., s);   // a soft swath, no hard line
  }
  vec2 u4 = uvOf(b4, ll); float w4 = inside(u4, .10) * a4;
  if (w4 > 0.) {
    vec4 A = samp(t4, u4);
    vec2 u5 = uvOf(b5, ll);
    vec4 B = samp(t5, u5);
    float s = uScanDir4 * (ll.x - uScan4);
    float k = smoothstep(-0.0015, 0.0015, s);
    if (uGrow >= 0.) { float g = texture(t10, u4).r; k = g < .002 ? smoothstep(.55, 1., uGrow) : 1. - smoothstep(uGrow - .03, uGrow, g); }   // land crossfades late, new water grows outward
    col = mix(col, mix(A, B, k), w4);
    float m = mix(texture(t6, u4).r, texture(t7, u5).r, k);
    wmask = mix(wmask, m, w4);
    scanGlow += uGlow4 * w4 * .10 * exp(-max(s, 0.) / max(fwidth(ll.x) * 70., 1e-6)) * smoothstep(0., fwidth(ll.x) * 30., s);
  }
  return col;
}
float LAT, LON;
vec3 grade(vec4 c, float wmask){
  // analyst grey: luminance with local contrast, toned blue-black -> cool silver, a little chroma kept
  float d = clamp((c.a - 0.05) / 0.85, 0., 1.);
  d = (1. - exp(-1.9 * d)) / (1. - exp(-1.9));          // shoulder: salt and cloud stay below white
  d = d * d * (3. - 2. * d) * .30 + d * .70;
  d = pow(d, 1.12);
  d = clamp((d - .5) * uContrast + .5, 0., 1.);
  vec3 grey = mix(vec3(.026, .036, .044), vec3(.63, .655, .665), d);   // the ground stays mid-grey: white is kept for the analyst's marks
  grey += (c.rgb - lum(c.rgb)) * 0.22;
  wmask *= 1. - smoothstep(uWaterAt.z * .85, uWaterAt.z, length(vec2((LON - uWaterAt.x) * .7, LAT - uWaterAt.y)));
  float g = uGrey * (1. - uWaterCol * smoothstep(.15, .7, wmask));
  vec3 tc = c.rgb;
  // water that came back: true colour, slightly lifted so it reads against the grey
  tc = mix(tc, tc * vec3(.85, 1.15, 1.25) + vec3(0., .02, .03), uWaterCol * smoothstep(.15, .7, wmask) * .6);
  return mix(tc, grey, g);
}
// ---- the printed map (the claim): paper, sea, waterlines, coast, graticule; exact at any zoom
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
float paper(vec2 q, float px){        // grain that stays a few pixels wide at every zoom (two octaves cross-faded)
  float L = log2(1. / (px * 2.6)), f0 = floor(L), t = L - f0;
  float a = vn(q * exp2(f0)), b = vn(q * exp2(f0 + 1.));
  float c = vn(q * exp2(f0 - 2.) * vec2(1., 4.));          // long fibres
  return mix(a, b, t) * .75 + c * .25;
}
vec3 mapLayer(vec2 ll, out float a){
  vec2 u = uvOf(b9, ll);
  float inb = inside(u, .02);
  vec3 f = texture(t9, u).rgb;
  float din = f.r * 60., dout = f.g * 60.;
  float sd = din - dout;                         // + inside the 1960 sea, km
  float fw = max(fwidth(sd), 1e-4);
  float sea = smoothstep(-fw, fw, sd);
  vec2 q = (ll - vec2(45., 60.)).yx;             // degrees from a local origin (keeps float precision)
  float px = max(fwidth(ll.y), 1e-7);
  float g = paper(q, px);
  vec3 land = vec3(.925, .885, .795) * (.88 + .15 * g);
  land *= mix(1., .80 + .32 * f.b, .40);         // faint relief from Blue Marble
  vec3 water = vec3(.55, .71, .86) * (.92 + .10 * g);
  vec3 c = mix(land, water, sea);
  float wl = 0.;                                 // waterlines: the atlas convention along the shore
  for (int k = 1; k <= 9; k++) { float fk = float(k); float dk = 1.6 * fk * fk * .62 + 1.6 * fk;
    wl = max(wl, (1. - smoothstep(fw * .4, fw * 1.9, abs(din - dk))) * (1. - fk / 11.) * sea); }
  c = mix(c, vec3(.27, .46, .70), wl * .8);
  // printing: a fine halftone screen in the blue ink (screen space, 45 degrees) and a paper fold
  vec2 sc = gl_FragCoord.xy * .7071; vec2 hp = fract(vec2(sc.x + sc.y, sc.x - sc.y) / 4.2) - .5;
  float dotm = smoothstep(.36, .30, length(hp));
  c *= mix(1., .955 + .07 * dotm, sea);
  float fold = exp(-pow((ll.y - 60.82) / max(fwidth(ll.y) * 9., 1e-6), 2.));
  c *= 1. - .07 * fold; c += .035 * exp(-pow((ll.y - 60.82 - fwidth(ll.y) * 7.) / max(fwidth(ll.y) * 5., 1e-6), 2.));
  float coast = 1. - smoothstep(fw * 1.1, fw * 3.2, abs(sd));
  c = mix(c, vec3(.10, .23, .42), coast * .95);
  float m = max(uMap, uMapSea * sea) * inb;
  float wipe = 1. - smoothstep(-fwidth(ll.x) * 2., fwidth(ll.x) * 2., ll.x - uMapWipe);   // the map stays south of the scan
  a = m * wipe;
  // the scanner's light bar on the revealed side
  float bar = exp(-max(ll.x - uMapWipe, 0.) / (fwidth(ll.x) * 26.)) * step(uMapWipe, ll.x) * step(uMapWipe, 89.);
  c += bar * .0;
  return c;
}
vec3 shade(vec2 frag){
  vec2 n = (frag - uRes * .5 - uShift * vec2(1., -1.)) / uF;
  vec3 dir = normalize(uFw + n.x * uR + n.y * uU);
  float b = dot(dir, uCc);
  float disc = b * b - uC2;
  vec3 space = vec3(.012, .018, .024);
  if (disc < 0.) {
    float dmin = sqrt(max(dot(uCc, uCc) - b * b, 0.));
    float x = (dmin - RE) / 90.;
    float glow = exp(-x) * step(0., b);
    return space + glow * mix(vec3(.30, .55, .95), vec3(.75, .80, .85), uGrey) * .55;
  }
  float t = b - sqrt(disc);
  vec3 Q = t * dir - uCc;
  vec2 ll = vec2(degrees(asin(clamp(Q.z / RE, -1., 1.))), degrees(atan(Q.y, Q.x)));
  float wm, sg; LAT = ll.x; LON = ll.y;
  vec4 c = ground(ll, wm, sg);
  vec3 col = grade(c, wm);
  // limb: darken and add a thin atmosphere towards the edge of the disc
  float mu = clamp(dot(normalize(Q), -dir), 0., 1.);
  col *= mix(1., mix(.55, 1., pow(mu, .35)), uShade);
  col += uShade * pow(1. - mu, 3.) * mix(vec3(.25, .45, .85), vec3(.6, .65, .7), uGrey) * .55;
  col += sg * vec3(.85, .92, 1.);
  if (uMap + uMapSea > 0.001) {
    float ma; vec3 mc = mapLayer(ll, ma);
    col = mix(col, mc, ma);
    float dl = ll.x - uMapWipe;
    col += vec3(.95, .97, 1.) * .55 * exp(-max(dl, 0.) / (fwidth(ll.x) * 22.)) * step(0., dl) * step(uMapWipe, 89.) * uMap;
  }
  return col;
}
void main(){
  vec2 frag = gl_FragCoord.xy;
  vec3 col;
  if (uBlur > .5) {               // motion blur for the whip pan: average along the pan direction
    col = vec3(0.);
    for (int i = 0; i < 12; i++) { float k = (float(i) / 11. - .5) * uBlur; col += shade(frag + k * uBlurVec * vec2(1., -1.)); }
    col /= 12.;
  } else col = shade(frag);
  col *= uExpo;
  // vignette
  vec2 q = frag / uRes - .5; col *= 1. - .35 * dot(q, q) * 1.2;
  col *= (1. - uDim);
  o = vec4(pow(max(col, 0.), vec3(1.)), 1.);
}`;

export class Engine {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.p = p; gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.U = {};
    for (let i = 0; i < 11; i++) gl.uniform1i(gl.getUniformLocation(p, 't' + i), i);
    this.tex = {};
    this.blank = this.upload('blank', (() => { const c = document.createElement('canvas'); c.width = c.height = 4; return c; })(), { mip: false });
  }
  u(name) { return this.U[name] ?? (this.U[name] = this.gl.getUniformLocation(this.p, name)); }
  upload(name, img, { mip = true } = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    if (mip && this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    this.tex[name] = t;
    return t;
  }
  // state: { cam, slots: {1:{tex,bbox,a}, 2:..., ...}, scan2, scanDir2, glow2, scan4, scanDir4, glow4, grey, waterCol, shade, expo, blur, blurDir, dim }
  draw(S) {
    const gl = this.gl, c = S.cam;
    gl.viewport(0, 0, c.W, c.H);
    gl.uniform2f(this.u('uRes'), c.W, c.H);
    gl.uniform2f(this.u('uShift'), c.sx, c.sy);
    gl.uniform1f(this.u('uF'), c.F);
    gl.uniform3f(this.u('uR'), ...c.r); gl.uniform3f(this.u('uU'), ...c.u); gl.uniform3f(this.u('uFw'), ...c.f);
    gl.uniform3f(this.u('uCc'), ...c.Cc); gl.uniform1f(this.u('uC2'), c.c2);
    const bind = (i, name) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, (name && this.tex[name]) || this.blank); };
    const sl = S.slots;
    bind(0, 'world');
    bind(1, sl.ca?.tex); bind(2, sl.regA?.tex); bind(3, sl.regB?.tex || sl.regA?.tex);
    bind(4, sl.detA?.tex); bind(5, sl.detB?.tex || sl.detA?.tex); bind(6, sl.detA?.mask); bind(7, sl.detB?.mask || sl.detA?.mask); bind(8, sl.regA?.mask); bind(9, 'mapfield'); bind(10, sl.detA?.grow || 'blank');
    const bb = (k, b) => gl.uniform4f(this.u(k), ...(b || [0, 0, 1, 1]));
    bb('b1', sl.ca?.bbox); bb('b2', sl.regA?.bbox); bb('b3', (sl.regB || sl.regA)?.bbox); bb('b4', sl.detA?.bbox); bb('b5', (sl.detB || sl.detA)?.bbox);
    gl.uniform1f(this.u('a1'), sl.ca ? sl.ca.a : 0);
    gl.uniform1f(this.u('a2'), sl.regA ? sl.regA.a : 0);
    gl.uniform1f(this.u('a4'), sl.detA ? sl.detA.a : 0);
    gl.uniform1f(this.u('uScan2'), S.scan2 ?? -90); gl.uniform1f(this.u('uScanDir2'), S.scanDir2 ?? 1); gl.uniform1f(this.u('uGlow2'), S.glow2 ?? 0);
    gl.uniform1f(this.u('uScan4'), S.scan4 ?? -90); gl.uniform1f(this.u('uScanDir4'), S.scanDir4 ?? 1); gl.uniform1f(this.u('uGlow4'), S.glow4 ?? 0);
    gl.uniform1f(this.u('uGrey'), S.grey ?? 1); gl.uniform1f(this.u('uWaterCol'), S.waterCol ?? 0); gl.uniform3f(this.u('uWaterAt'), ...(S.waterAt || [60.75, 46.5, 0.75]));
    gl.uniform1f(this.u('uShade'), S.shade ?? 0); gl.uniform1f(this.u('uExpo'), S.expo ?? 1); gl.uniform1f(this.u('uDetail'), S.detail ?? 0.8); gl.uniform1f(this.u('uClarity'), S.clarity ?? 0.4);
    gl.uniform1f(this.u('uContrast'), S.contrast ?? 1); gl.uniform1f(this.u('uGrow'), S.grow ?? -1);
    gl.uniform4f(this.u('b9'), ...(S.mapBox || [54, 41.5, 66, 48.5])); gl.uniform1f(this.u('uMap'), S.map ?? 0); gl.uniform1f(this.u('uMapSea'), S.mapSea ?? 0); gl.uniform1f(this.u('uMapWipe'), S.mapWipe ?? 90);
    gl.uniform1f(this.u('uBlur'), S.blur ?? 0); gl.uniform2f(this.u('uBlurVec'), ...(S.blurVec || [1, 0])); gl.uniform1f(this.u('uDim'), S.dim ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
