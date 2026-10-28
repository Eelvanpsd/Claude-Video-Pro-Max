// The showroom: a white 1:1000 massing model on a dark plinth, a projector above it, house lights and a sun.
// Every data colour is projected light: it is added to the lit white surface in the shader (projLight), scaled by how
// squarely the surface faces the projector, limited to the projector's throw, and never painted into the material.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makePost } from '/core/three/post.js';

const lin = h => new THREE.Color(h);
export const PAL = {
  amber: '#ffa13d',                                     // built before 1940
  bands: ['#ffa13d', '#2a46ff', '#2f98ff', '#6fdcff', '#e6fbff'],   // pre-1940, 1940–64, 1965–89, 1990–2009, 2010–25
  hgt: ['#1a1440', '#5a35d6', '#e2509a', '#ffe7c4'],    // height ramp 0 → 30 → 80 → 200 m
  shade: '#1c2c66', black: '#0b0f18', sun: '#ffd9ad', roofNew: '#bff3ff',
};

export function makeStudio(W, H, M) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2); renderer.setSize(W, H);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  document.getElementById('stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 9);
  const post = makePost(renderer, scene, camera, W, H, { ssaa: 2, ao: true, aoRadius: .035, aoScale: 1.4, aoThickness: .05, aoAmt: .9 });
  post.bloom.strength = .32; post.bloom.radius = .55; post.bloom.threshold = .85;
  post.dof.ao.updateGtaoMaterial({ samples: 24 }); post.dof.ao.updatePdMaterial({ radius: 10, samples: 24, rings: 3 });
  post.vig.uniforms.amt.value = .42;

  // the room: dark, a faint pool of light behind the plinth
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 288;
    const g = c.getContext('2d'), gr = g.createRadialGradient(256, 150, 10, 256, 160, 320);
    gr.addColorStop(0, '#1b1e22'); gr.addColorStop(.5, '#0b0c0e'); gr.addColorStop(1, '#030304');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
  }
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .02).texture;

  // ---------------------------------------------------------------- projection uniforms (shared by every surface)
  const U = {
    uProj: { value: 0 }, uNow: { value: 0 },
    uPreR: { value: -1 }, uPreRim: { value: 0 }, uPreDim: { value: 1 }, uPreC: { value: new THREE.Vector2(0, -.4) },
    uGT: { value: [99, 99, 99, 99, 99] }, uGS: { value: [1, 1, 1, 1, 1] }, uGrowOn: { value: 0 },
    uHgtF: { value: -1 }, uHgtOn: { value: 0 }, uHgtBand: { value: 0 },
    uSunOn: { value: 0 }, uSunMask: { value: 0 },
    uRoofT0: { value: 99 }, uRoofDT: { value: .1 }, uRoofOn: { value: 0 },
    uZS: { value: null }, uZSOn: { value: 0 }, uZSProg: { value: 0 }, uZPos: { value: new THREE.Vector2() },
    uProjPos: { value: new THREE.Vector3(0, 3.4, .5) },
    uWater: { value: null }, uPlate: { value: new THREE.Vector2(M.size[0], M.size[1]) },
    cBand: { value: PAL.bands.map(lin) }, cH: { value: PAL.hgt.map(lin) },
    cShade: { value: lin(PAL.shade) }, cBlack: { value: lin(PAL.black) }, cRoofNew: { value: lin(PAL.roofNew) },
  };

  const HEAD = /* glsl */`
  uniform float uProj, uNow, uPreR, uPreRim, uPreDim, uGrowOn, uHgtF, uHgtOn, uHgtBand, uSunOn, uSunMask, uRoofT0, uRoofDT, uRoofOn;
  uniform float uGT[5], uGS[5];
  uniform sampler2D uZS; uniform float uZSOn, uZSProg; uniform vec2 uZPos;
  uniform vec2 uPreC, uPlate; uniform vec3 uProjPos; uniform sampler2D uWater;
  uniform vec3 cBand[5], cH[4], cShade, cBlack, cRoofNew;
  varying vec4 vData; varying vec3 vWP; varying vec3 vWN;
  int bandOf(float y){ return y < 1940. ? 0 : y < 1965. ? 1 : y < 1990. ? 2 : y < 2010. ? 3 : 4; }
  vec3 hgtCol(float h){
    float a = clamp(h / 30., 0., 1.), b = clamp((h - 30.) / 50., 0., 1.), c = clamp((h - 80.) / 120., 0., 1.);
    return mix(mix(mix(cH[0], cH[1], a), cH[2], b), cH[3] * 1.3, c);
  }
  float wmask(){ vec2 uv = vWP.xz / uPlate + .5; if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return 0.; return texture2D(uWater, uv).r; }
  float aaLine(float x, float period, float w){ float d = abs(fract(x / period + .5) - .5) * period; float fw = fwidth(x); return 1. - smoothstep(w, w + fw * 1.5, d); }
  // kind 0 building, 1 plate, 2 plinth
  vec3 projLight(float kind, float wm){
    vec3 N = normalize(vWN);
    float dirK = .42 + .58 * max(dot(N, normalize(uProjPos - vWP)), 0.);
    vec2 q = abs(vWP.xz) - (uPlate * .5 + .05);
    float thr = 1. - smoothstep(0., .03, max(q.x, q.y));
    bool bld = kind < .5 && vData.x > 0.;
    vec3 c = cBlack;
    // 01 before 1940: a soft wash spreading from the projector axis (no hard line: a wide warm rim)
    float r = length(vWP.xz - uPreC), s1 = r - uPreR;
    float r1 = smoothstep(.06, -.06, s1);
    int bd = bandOf(vData.x);
    if (bld && bd == 0) c = mix(c, cBand[0] * 1.15 * uPreDim, r1);
    else if (bld) c = mix(c, cBlack * 1.7, r1);
    else if (kind < 1.5) c = mix(c, cBlack * 1.5 + vec3(.010, .014, .024) * (aaLine(vWP.x, .1, .0005) + aaLine(vWP.z, .1, .0005)), r1);
    float rim = uPreRim * exp(-s1 * s1 / .004) * .55;
    // 02 growth: each post-war building switches on at its own moment (band onset + rank * spread), with a short flash
    if (bld && bd > 0 && uGrowOn > .5) {
      float on = uGT[bd] + vData.z * uGS[bd], e = uNow - on;
      float a = smoothstep(0., .22, e), fl = e > 0. ? exp(-e / .16) : 0.;
      c = mix(c, cBand[bd], a) + cBand[bd] * fl * 1.4 + vec3(.6) * fl;
    }
    // 03 height: a level of light climbs every facade; behind it the building takes its height colour
    float s2 = vWP.y - uHgtF;
    float r2 = kind < .5 ? uHgtOn * smoothstep(.0015, -.0015, s2) : uHgtOn * smoothstep(0., .03, uHgtF);
    vec3 a2 = bld ? hgtCol(vData.y) : cH[0] * .5 + vec3(.03, .025, .07) * (aaLine(vWP.x, .1, .0005) + aaLine(vWP.z, .1, .0005));
    if (bld && abs(N.y) < .5) a2 += vec3(.35, .3, .45) * aaLine(vWP.y, .025, .00018);
    c = mix(c, a2, r2);
    float band = bld ? uHgtOn * uHgtBand * exp(-s2 * s2 / 1.6e-5) * .9 : 0.;
    // 04 sun: the data is put away, the shadow side goes deep blue (the sun is a real light)
    c = mix(c, cShade * (kind < .5 ? .42 : .3), uSunOn);
    // the tallest tower's noon shadow, traced by the projector as it is measured: a cool fill and a bright edge
    if (uZSOn > 0. && kind < 1.5) {
      vec2 uv = vWP.xz / uPlate + .5;
      float m = texture2D(uZS, uv).r, d = length(vWP.xz - uZPos);
      float prog = smoothstep(uZSProg, uZSProg - .03, d);
      float fill = smoothstep(.4, .6, m), edge = exp(-pow((m - .5) / .16, 2.));
      c += (vec3(.10, .22, .65) * fill * .9 + vec3(.75, .9, 1.) * edge * .9) * prog * uZSOn;
    }
    vec3 L = (c + vec3(1., .93, .82) * rim + vec3(1., .96, .9) * band) * dirK * thr * uProj;
    return L * (1. - .55 * wm);
  }
  // roofs in the tower's shadow: they light up one by one (pre-1940 ones in the first layer's amber)
  vec3 roofGlow(float kind){
    if (kind > .5 || vData.w < 0. || uRoofOn < .5) return vec3(0.);
    float e = uNow - (uRoofT0 + vData.w * uRoofDT);
    if (e < 0.) return vec3(0.);
    float a = .8 + 1.4 * exp(-e / .25);
    vec3 col = vData.x < 1940. ? cBand[0] : cRoofNew;
    return col * a * smoothstep(0., .08, e) * uRoofOn;
  }`;

  function projMaterial(kind, opts) {
    const m = new THREE.MeshStandardMaterial(opts);
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nattribute vec4 aData; varying vec4 vData; varying vec3 vWP; varying vec3 vWN;`)
        .replace('#include <fog_vertex>', `#include <fog_vertex>\n vData = aData; vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${HEAD}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n float wm = ${kind === 1 ? 'wmask()' : '0.'}; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.10, .13, .17), wm);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .32, wm);`)
        .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
          'getDirectionalLightInfo( directionalLight, directLight );',
          'getDirectionalLightInfo( directionalLight, directLight );\n directLight.color *= ( UNROLLED_LOOP_INDEX == 1 ) ? uSunMask : 1.0;'))
        .replace('#include <opaque_fragment>', `outgoingLight += projLight(${kind}.0, wm) * mix(diffuseColor.rgb, vec3(1.), .1) * 1.35 + roofGlow(${kind}.0);\n#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'proj' + kind;
    return m;
  }

  // ---------------------------------------------------------------- the model (LOD1.3 parts + bridge decks, one mesh)
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function buildCity(shadeOrder) {
    const pos = [], nor = [], dat = [];
    const push = (p, n, d) => { pos.push(...p); nor.push(...n); dat.push(...d); };
    const key = (x0, z0, x1, z1) => `${x0},${z0},${x1},${z1}`;
    const EH = new Map();
    for (const [, h, rings] of M.p) for (const r of rings) for (let i = 0; i < r.length; i++) {
      const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length]; const k = key(x0, z0, x1, z1); EH.set(k, Math.max(EH.get(k) || 0, h));
    }
    const area = r => { let a = 0; for (let i = 0; i < r.length; i++) { const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length]; a += x0 * z1 - x1 * z0; } return a / 2; };
    const prism = (rings, h, d, shared) => {
      rings.forEach((r, ri) => {
        const A = area(r), sgn = (A > 0 ? 1 : -1) * (ri ? -1 : 1);
        for (let i = 0; i < r.length; i++) {
          const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length];
          const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 1e-6) continue;
          const nb = shared ? EH.get(key(x1, z1, x0, z0)) || 0 : 0;   // a neighbouring part on the other side of this wall
          if (nb >= h - 1e-5) continue;
          const nx = dz / L * sgn, nz = -dx / L * sgn;
          const a = [x0, nb, z0], b = [x1, nb, z1], c = [x1, h, z1], e = [x0, h, z0];
          const cx = (b[1] - a[1]) * (e[2] - a[2]) - (b[2] - a[2]) * (e[1] - a[1]);
          const cz = (b[0] - a[0]) * (e[1] - a[1]) - (b[1] - a[1]) * (e[0] - a[0]);
          const tri = cx * nx + cz * nz > 0 ? [a, b, c, a, c, e] : [a, c, b, a, e, c];
          for (const p of tri) push(p, [nx, 0, nz], d);
        }
      });
      const V = THREE.Vector2;
      const contour = rings[0].map(([x, z]) => new V(x, z)), holes = rings.slice(1).map(r => r.map(([x, z]) => new V(x, z)));
      const all = contour.concat(...holes);
      for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, holes)) {
        const p = all[i], q = all[j], r = all[k];
        const up = (q.y - p.y) * (r.x - p.x) - (q.x - p.x) * (r.y - p.y) > 0;
        for (const v of (up ? [p, q, r] : [p, r, q])) push([v.x, h, v.y], [0, 1, 0], d);
      }
    };
    for (const [bi, h, rings] of M.p) {
      const [year, bh] = M.b[bi];
      prism(rings, h, [year, bh, hash(bi * 1.37 + .5), shadeOrder.has(bi) ? shadeOrder.get(bi) : -1], true);
    }
    for (const r of M.decks) prism([r], .0015, [-1, 0, 0, -1], false);     // bridge decks: 1.5 m slabs
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aData', new THREE.Float32BufferAttribute(dat, 4));
    return g;
  }
  const zero = g => { g.setAttribute('aData', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 4), 4)); return g; };

  function build(shadeOrder, water, zs) {
    zs.flipY = false; zs.colorSpace = THREE.NoColorSpace; U.uZS.value = zs;
    water.flipY = false; water.colorSpace = THREE.NoColorSpace; water.anisotropy = 8; U.uWater.value = water;
    const white = '#f3f3f1';
    const city = new THREE.Mesh(buildCity(shadeOrder), projMaterial(0, { color: white, roughness: .88, metalness: 0 }));
    city.castShadow = city.receiveShadow = true; scene.add(city);
    const PW = M.size[0], PD = M.size[1], RIM = .05, PT = .022;
    const plateTop = new THREE.Mesh(zero(new THREE.PlaneGeometry(PW + RIM * 2, PD + RIM * 2).rotateX(-Math.PI / 2)), projMaterial(1, { color: white, roughness: .9 }));
    plateTop.receiveShadow = true; scene.add(plateTop);
    const plateBox = new THREE.Mesh(zero(new THREE.BoxGeometry(PW + RIM * 2, PT, PD + RIM * 2)), projMaterial(1, { color: '#e9e6e0', roughness: .9 }));
    plateBox.position.y = -PT / 2 - .0005; plateBox.receiveShadow = true; scene.add(plateBox);
    const plinth = new THREE.Mesh(zero(new THREE.BoxGeometry(PW + .34, .9, PD + .34)), projMaterial(2, { color: '#17181a', roughness: .5 }));
    plinth.position.y = -PT - .45; plinth.receiveShadow = true; scene.add(plinth);
  }

  // ---------------------------------------------------------------- lights (order matters: index 0 house, index 1 sun)
  const house = new THREE.DirectionalLight('#ffffff', 2);
  house.position.setFromSphericalCoords(4, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(215)); house.castShadow = true;
  Object.assign(house.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: .5, far: 9 });
  house.shadow.mapSize.set(4096, 4096); house.shadow.radius = 5; house.shadow.bias = -.0002; house.shadow.normalBias = .0015;
  scene.add(house, house.target);
  const sun = new THREE.DirectionalLight(PAL.sun, 0);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -1.9, right: 1.9, top: 1.9, bottom: -1.9, near: .5, far: 11 });
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 1.5; sun.shadow.bias = -.0003; sun.shadow.normalBias = .0012;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#dfe7f2', '#141414', .3); scene.add(hemi);

  return { renderer, scene, camera, post, U, build, house, sun, hemi };
}
