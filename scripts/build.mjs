// Builds print-ready STLs (stl/) and the self-contained 3D preview (index.html at the repo root, so GitHub Pages serves it in either source mode).
//   node scripts/build.mjs
import Module from 'manifold-3d';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel } from '../src/model.mjs';
import { P } from '../src/params.mjs';
import { runChecks } from './check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasm = await Module();
wasm.setup();
const model = buildModel(wasm, P);
const L = model.L;
const checks = runChecks(wasm);
if (!checks.ok) { console.error('Fit checks failed — see above.'); process.exit(1); }
console.log(`fit checks: ${checks.pairs} part pairs, no interference; keycap side clearance ${checks.keycapGap.toFixed(2)} mm`);

// ---------- STL export (binary) ----------
function toStl(manifold) {
  const mesh = manifold.getMesh();
  const { vertProperties: vp, triVerts: tv, numProp } = mesh;
  const nTri = tv.length / 3;
  const buf = Buffer.alloc(84 + nTri * 50);
  buf.write('mx-fidget', 0);
  buf.writeUInt32LE(nTri, 80);
  let o = 84;
  const v = (i) => [vp[i * numProp], vp[i * numProp + 1], vp[i * numProp + 2]];
  for (let t = 0; t < nTri; t++) {
    const a = v(tv[3 * t]), b = v(tv[3 * t + 1]), c = v(tv[3 * t + 2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    for (const x of [...n, ...a, ...b, ...c]) { buf.writeFloatLE(x, o); o += 4; }
    buf.writeUInt16LE(0, o); o += 2;
  }
  return buf;
}

// Print orientation: each part flat on the bed, centred.
const printSetup = {
  upper_housing: { part: 'upper',    flip: false, note: 'Opaque. Print upright, no supports.' },
  diffuser:      { part: 'diffuser', flip: false, note: 'Frosted translucent. Print upright, no supports.' },
};
mkdirSync(join(root, 'stl'), { recursive: true });
for (const [name, s] of Object.entries(printSetup)) {
  let m = model.printed[s.part];
  if (s.flip) m = m.rotate([180, 0, 0]);
  const b = m.boundingBox();
  m = m.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]]);
  writeFileSync(join(root, 'stl', `${name}.stl`), toStl(m));
  const bb = m.boundingBox();
  console.log(`stl/${name}.stl  ${m.numTri()} tris  ${bb.max.map(x => x.toFixed(1)).join(' x ')} mm  ${(m.volume() / 1000).toFixed(2)} cm³`);
}

// ---------- preview data ----------
function encode(manifold) {
  const mesh = manifold.getMesh();
  const n = mesh.numProp;
  const pos = new Float32Array((mesh.vertProperties.length / n) * 3);
  for (let i = 0; i < pos.length / 3; i++)
    for (let k = 0; k < 3; k++) pos[3 * i + k] = Math.round(mesh.vertProperties[i * n + k] * 1000) / 1000;
  const idx = pos.length / 3 < 65536 ? Uint16Array.from(mesh.triVerts) : Uint32Array.from(mesh.triVerts);
  return {
    p: Buffer.from(pos.buffer).toString('base64'),
    i: Buffer.from(idx.buffer).toString('base64'),
    i32: idx instanceof Uint32Array,
  };
}
const parts = {};
for (const [k, m] of Object.entries({ ...model.printed, ...model.reference })) parts[k] = encode(m);
const data = {
  parts,
  levels: Object.fromEntries(Object.entries(L).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(3)])),
  params: { baseSize: P.baseSize, travel: P.travel, collarAbovePlate: P.collarAbovePlate, collarInner: P.collarInner,
            keycapBottomAbovePlate: P.keycapBottomAbovePlate, keycapH: P.keycapH, haloPos: P.haloPos,
            ledsBottom: P.ledsBottom, ledPos: P.ledPos, plateCut: P.plateCut, batt: P.batt, pcbSize: P.pcbSize },
  checks: { clean: checks.ok, pairs: checks.pairs, keycapGap: +checks.keycapGap.toFixed(2) },
};
const tpl = readFileSync(join(root, 'preview', 'template.html'), 'utf8');
const html = tpl.replace('/*__MODEL_DATA__*/', `window.MODEL = ${JSON.stringify(data)};`);
writeFileSync(join(root, 'index.html'), html);
console.log(`index.html  ${(html.length / 1024).toFixed(0)} KB`);
