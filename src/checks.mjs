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

// Pass/fail thresholds (mm, mm³).
export const LIMITS = {
  overlapVolume: 0.01, // intersections smaller than this are mesh noise, not a collision
  minPcbWall: 0.8,     // thinnest allowed upper-housing wall around the PCB pocket
  minKeycapGap: 0.2,   // side clearance between keycap and collar so the key never rubs
};

const overlaps = (A, B, eps = LIMITS.overlapVolume) =>
  A.min[0] < B.max[0] - eps && B.min[0] < A.max[0] - eps &&
  A.min[1] < B.max[1] - eps && B.min[1] < A.max[1] - eps &&
  A.min[2] < B.max[2] - eps && B.min[2] < A.max[2] - eps;

/**
 * Validity and fit checks: every part is a valid non-empty manifold, no two parts interfere (except the
 * intentional contacts in ALLOWED), the keycap clears the collar at rest and at full travel, and the PCB pocket wall is thick enough.
 * @param {object} wasm   initialised manifold-3d module (after `setup()`)
 * @param {object} P      parameter set (see params.mjs)
 * @param {object} [model] a model already built from `P`, to avoid rebuilding it
 * @param {(msg: string) => void} [log] called once per problem as it is found
 * @returns {{ ok: boolean, problems: string[], pairs: number, tested: number, keycapGap: number,
 *             keycapGapPressed: number, pcbWall: number, screwBite: number, L: object, model: object }}
 */
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
    if (v > LIMITS.overlapVolume) fail(`COLLISION ${a} ∩ ${b}: ${v.toFixed(3)} mm³`);
  }

  // Full key travel: the keycap only translates, so move it instead of rebuilding the model.
  const keycapDown = model.reference.keycap.translate([0, 0, -P.travel]);
  pairs++;
  const pressedHit = keycapDown.intersect(model.printed.upper).volume();
  if (pressedHit > LIMITS.overlapVolume) fail(`COLLISION pressed keycap ∩ upper: ${pressedHit.toFixed(3)} mm³`);
  const keycapGap = model.reference.keycap.minGap(model.printed.upper, 3);
  const keycapGapPressed = keycapDown.minGap(model.printed.upper, 3);

  // Wall left around the PCB pocket where the upper housing is thinnest (its bottom edge).
  const L = model.L;
  const pcbWall = L.halfAt(L.Zb) - (P.pcbSize / 2 + P.pcbFit);
  if (pcbWall < LIMITS.minPcbWall) fail(`THIN WALL around the PCB: ${pcbWall.toFixed(2)} mm (need ≥ ${LIMITS.minPcbWall}; increase baseSize)`);
  if (keycapGap < LIMITS.minKeycapGap) fail(`KEYCAP RUB: ${keycapGap.toFixed(2)} mm side clearance (need ≥ ${LIMITS.minKeycapGap}; increase collarInner)`);

  const screwBite = model.reference.screws.intersect(model.printed.upper).volume();
  return { ok: problems.length === 0, problems, pairs, tested, keycapGap, keycapGapPressed, pcbWall, screwBite, L, model };
}

/** The JSON-safe subset of a `runChecks` result that the preview shows (used by the build and the worker). */
export function summarizeChecks(r) {
  return { clean: r.ok, problems: r.problems, pairs: r.pairs, keycapGap: +r.keycapGap.toFixed(2), pcbWall: +r.pcbWall.toFixed(2) };
}
