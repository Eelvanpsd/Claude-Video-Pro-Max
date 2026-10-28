// Corne v4 case STEP -> triangle mesh in PCB coordinates (x right, y down = KiCad, z up from case bottom), mm
// usage: node tools/step2mesh.mjs left.step data/case.bin   (needs: npm i occt-import-js@0.0.23)
// Alignment (measured): x_pcb = x + 14.2876, y_pcb = -y - 57.1513, z = z + 11.4 (case bottom at 0, rim at 11.1)
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(process.env.OCCT_DIR ? process.env.OCCT_DIR + '/' : import.meta.url);
const occt = await require('occt-import-js')();
const r = occt.ReadStepFile(new Uint8Array(fs.readFileSync(process.argv[2])), { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: 0.02, angularDeflection: 0.08 });
const m = r.meshes[0];
const p = m.attributes.position.array, n = m.attributes.normal.array, idx = m.index.array;
const nv = p.length / 3, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
for (let i = 0; i < nv; i++) {
  P[i*3] = p[i*3] + 14.2876; P[i*3+1] = -p[i*3+1] - 57.1513; P[i*3+2] = p[i*3+2] + 11.4;
  N[i*3] = n[i*3]; N[i*3+1] = -n[i*3+1]; N[i*3+2] = n[i*3+2];
}
const I = new Uint32Array(idx.length);
for (let i = 0; i < idx.length; i += 3) { I[i] = idx[i]; I[i+1] = idx[i+2]; I[i+2] = idx[i+1]; }   // y flip mirrors winding
const head = new Uint32Array([nv, I.length]);
fs.writeFileSync(process.argv[3], Buffer.concat([Buffer.from(head.buffer), Buffer.from(P.buffer), Buffer.from(N.buffer), Buffer.from(I.buffer)]));
console.log('case mesh', nv, 'verts', I.length / 3, 'tris');
