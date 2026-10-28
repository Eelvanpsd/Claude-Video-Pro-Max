// Parts on the back of the board, placed at their KiCad footprint positions (left half, B side).
// Bodies follow the package names in the footprints (QFN-56 7×7, SOIC-8 5.23, 3225 crystal, 0402 …);
// heights are typical package heights, not data from the project, and carry no labels of their own.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const deg = Math.PI / 180;
export function buildBackParts(D, group, bottomY, M) {
  const G = {
    rbox: (w, d, h, r = .15) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - .01, h / 2 - .01, d / 2 - .01)),
  };
  // one component frame: children use (lx, depth below board, lz) in footprint-local millimetres
  const frame = (x, y, rot) => { const g = new THREE.Group(); g.position.set(x, bottomY, y); g.rotation.y = rot * deg; group.add(g); return g; };
  const put = (g, geo, mat, lx, depth, lz, h, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(lx, -depth - h / 2, lz); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
  const anchors = {};

  // hot-swap sockets: two bosses under the switch-pin holes, a bridge, and two metal contacts at the solder pads
  const boss = G.rbox(5.2, 4.2, 1.85, .4), bridge = G.rbox(3.6, 2.6, 1.85, .3), tab = G.rbox(1.5, 1.9, .9, .1);
  for (const s of D.switches) {
    const g = frame(s.x, s.y, s.rot);
    put(g, boss, M.socket, -3.3, 0, 5.08, 1.85); put(g, boss, M.socket, 4.4, 0, 2.54, 1.85); put(g, bridge, M.socket, .6, 0, 3.8, 1.85);
    put(g, tab, M.contact, 7.0, .2, 2.54, .9, false); put(g, tab, M.contact, -5.8, .2, 5.08, .9, false);
  }
  const ledBody = G.rbox(3.2, 2.8, .9, .2), ledLead = G.rbox(.5, .7, .25, .05);
  const chip0402c = G.rbox(1.0, .5, .5, .06), cap0402end = G.rbox(.2, .52, .52, .05);
  for (const c of D.comps) {
    const L = c.lib;
    if (L.startsWith('YS-SK6812')) {            // reverse-mount RGB LED: body under the board, lit lens facing up through the hole
      const g = frame(c.x, c.y, c.rot);
      put(g, ledBody, M.ledBody, 0, 0, 0, .9);
      for (const [lx, lz] of [[-1.85, -.7], [-1.85, .7], [1.85, -.7], [1.85, .7]]) put(g, ledLead, M.contact, lx, .1, lz, .25, false);
      if (c.ref === 'LED10') anchors.led = g;
    } else if (L.startsWith('C_0402') || L.startsWith('R_0402')) {
      const g = frame(c.x, c.y, c.rot);
      put(g, chip0402c, L.startsWith('C') ? M.ceramic : M.resistor, 0, 0, 0, .5, false);
      put(g, cap0402end, M.contact, -.42, 0, 0, .52, false); put(g, cap0402end, M.contact, .42, 0, 0, .52, false);
    } else if (L.startsWith('QFN-56')) {        // 7 × 7 mm, 0.9 mm high, 14 leads a side at 0.4 mm
      const g = frame(c.x, c.y, c.rot);
      put(g, G.rbox(7, 7, .9, .12), M.mold, 0, 0, 0, .9);
      const pad = G.rbox(.22, .45, .2, .03);
      for (let i = 0; i < 14; i++) {
        const o = (i - 6.5) * .4;
        put(g, pad, M.contact, o, .72, 3.33, .2, false); put(g, pad, M.contact, o, .72, -3.33, .2, false);
        const p2 = put(g, pad, M.contact, 3.33, .72, o, .2, false); p2.rotation.y = Math.PI / 2;
        const p3 = put(g, pad, M.contact, -3.33, .72, o, .2, false); p3.rotation.y = Math.PI / 2;
      }
      const dot = new THREE.Mesh(new THREE.CircleGeometry(.35, 20), M.dot); dot.rotation.x = Math.PI / 2; dot.position.set(-2.6, -.905, -2.6); g.add(dot);
      anchors.chip = g;
    } else if (L.startsWith('SOIC-8')) {        // 208 mil body, gull-wing leads
      const g = frame(c.x, c.y, c.rot);
      put(g, G.rbox(5.3, 5.3, 1.75, .15), M.mold, 0, .1, 0, 1.75);
      const leg = G.rbox(1.3, .42, .2, .05), knee = G.rbox(.3, .42, .9, .05);
      for (let i = 0; i < 4; i++) {
        const z = (i - 1.5) * 1.27;
        for (const sx of [-1, 1]) { put(g, leg, M.contact, sx * 3.45, 0, z, .2, false); put(g, knee, M.contact, sx * 2.8, .15, z, .9, false); }
      }
      anchors.flash = g;
    } else if (L.startsWith('Crystal')) {
      const g = frame(c.x, c.y, c.rot); put(g, G.rbox(3.2, 2.5, .8, .12), M.can, 0, 0, 0, .8);
    } else if (L.startsWith('SOT-223')) {
      const g = frame(c.x, c.y, c.rot); put(g, G.rbox(6.5, 3.5, 1.6, .12), M.mold, 0, .05, -.6, 1.6); put(g, G.rbox(3.0, 1.6, .25, .05), M.contact, 0, 0, 2.6, .25, false);
    } else if (L.startsWith('USON') || L.startsWith('D_SOD')) {
      const g = frame(c.x, c.y, c.rot); put(g, L.startsWith('USON') ? G.rbox(1.0, 2.5, .5, .06) : G.rbox(1.2, .8, .6, .08), M.mold, 0, 0, 0, .55, false);
    } else if (L.startsWith('TS-1088')) {
      const g = frame(c.x, c.y, c.rot); put(g, G.rbox(3.9, 2.9, 1.2, .15), M.tact, 0, 0, 0, 1.2); put(g, G.rbox(1.6, 1.0, .5, .1), M.mold, 0, 1.2, 0, .5, false);
    } else if (L.startsWith('TYPE-C')) {
      const g = frame(c.x, c.y, c.rot); put(g, G.rbox(8.94, 7.35, 3.26, .9), M.steel, 0, 0, .1, 3.26);
    } else if (L.startsWith('PJ-398')) {
      const g = frame(c.x, c.y, c.rot); put(g, G.rbox(6.0, 12.0, 5.0, .4), M.plastic, 0, 0, -5.0, 5.0);
      const barrel = new THREE.CylinderGeometry(2.5, 2.5, 2.4, 28); barrel.rotateX(Math.PI / 2); const m = put(g, barrel, M.plastic, 0, 0, 2.0, 5.0); m.position.y = -2.5;
    } else if (L.startsWith('PinHeader')) {
      const g = frame(c.x, c.y, c.rot); put(g, G.rbox(2.5, 7.6, 2.5, .1), M.plastic, 0, 0, -2.54, 2.5);
      const pin = G.rbox(.64, .64, 6, .05); for (let i = 0; i < 3; i++) put(g, pin, M.pinGold, 0, 1.5, -i * 2.54, 6, false);
    }
  }
  return anchors;
}
