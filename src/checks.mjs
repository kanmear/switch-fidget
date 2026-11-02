// Validity + fit checks, shared by `npm run check`, the build and the in-browser configurator.
// Pure: takes the manifold-3d module and a parameter set, no Node APIs.
import { buildModel } from './model.mjs';

// Pairs that touch on purpose.
const ALLOWED = [
  ['screws', 'upper'],   // thread engagement
  ['switch', 'socket'],  // pins inside the socket contacts
  ['stem', 'keycap'],
  ['stem', 'switch'],
];
const allowed = (a, b) => ALLOWED.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const overlaps = (A, B, eps = 0.01) =>
  A.min[0] < B.max[0] - eps && B.min[0] < A.max[0] - eps &&
  A.min[1] < B.max[1] - eps && B.min[1] < A.max[1] - eps &&
  A.min[2] < B.max[2] - eps && B.min[2] < A.max[2] - eps;

export function runChecks(wasm, P, model = buildModel(wasm, P), log = () => {}) {
  const all = { ...model.printed, ...model.reference };
  const problems = [];
  const fail = (msg) => { problems.push(msg); log(msg); };
  for (const [k, v] of Object.entries(all))
    if (v.status() !== 'NoError' || v.isEmpty()) fail(`INVALID ${k}: ${v.status()}`);

  // Interference, with a bounding-box prefilter so only plausible pairs pay for a boolean.
  const names = Object.keys(all);
  const boxes = Object.fromEntries(names.map(k => [k, all[k].boundingBox()]));
  let pairs = 0, tested = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const [a, b] = [names[i], names[j]];
    if (allowed(a, b)) continue;
    pairs++;
    if (!overlaps(boxes[a], boxes[b])) continue;
    tested++;
    const v = all[a].intersect(all[b]).volume();
    if (v > 0.01) fail(`COLLISION ${a} ∩ ${b}: ${v.toFixed(3)} mm³`);
  }

  // Full key travel: the keycap only translates, so move it instead of rebuilding the model.
  const keycapDown = model.reference.keycap.translate([0, 0, -P.travel]);
  pairs++;
  const pressedHit = keycapDown.intersect(model.printed.upper).volume();
  if (pressedHit > 0.01) fail(`COLLISION pressed keycap ∩ upper: ${pressedHit.toFixed(3)} mm³`);
  const keycapGap = model.reference.keycap.minGap(model.printed.upper, 3);
  const keycapGapPressed = keycapDown.minGap(model.printed.upper, 3);

  // Wall left around the PCB pocket where the upper housing is thinnest (its bottom edge).
  const L = model.L;
  const pcbWall = L.halfAt(L.Zb) - (P.pcbSize / 2 + P.pcbFit);
  if (pcbWall < 0.8) fail(`THIN WALL around the PCB: ${pcbWall.toFixed(2)} mm (need ≥ 0.8; increase baseSize)`);
  if (keycapGap < 0.2) fail(`KEYCAP RUB: ${keycapGap.toFixed(2)} mm side clearance (need ≥ 0.2; increase collarInner)`);

  const screwBite = model.reference.screws.intersect(model.printed.upper).volume();
  return { ok: problems.length === 0, problems, pairs, tested, keycapGap, keycapGapPressed, pcbWall, screwBite, L, model };
}
