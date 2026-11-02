// Validity + fit checks. Exits non-zero if anything collides.
import Module from 'manifold-3d';
import { buildModel } from '../src/model.mjs';
import { P } from '../src/params.mjs';

export function runChecks(w, log = console.log) {
  const m = buildModel(w, P), mp = buildModel(w, P, { pressed: 1 });
  const all = { ...m.printed, ...m.reference };
  let ok = true;
  for (const [k, v] of Object.entries(all)) if (v.status() !== 'NoError' || v.isEmpty()) { ok = false; log('INVALID', k, v.status()); }
  const names = Object.keys(all), pairs = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const [a, b] = [names[i], names[j]];
    if ([a, b].includes('screws') && [a, b].includes('upper')) continue;   // thread engagement, intended
    if ([a, b].includes('switch') && [a, b].includes('socket')) continue;  // pins inside socket contacts
    if ([a, b].includes('stem') && [a, b].includes('keycap')) continue;
    if ([a, b].includes('stem') && [a, b].includes('switch')) continue;
    const v = all[a].intersect(all[b]).volume();
    pairs.push([a, b, v]);
    if (v > 0.01) { ok = false; log(`COLLISION ${a} ∩ ${b}: ${v.toFixed(3)} mm³`); }
  }
  const pressedHit = mp.reference.keycap.intersect(mp.printed.upper).volume();
  if (pressedHit > 0.01) { ok = false; log('COLLISION pressed keycap ∩ upper', pressedHit); }
  const keycapGap = m.reference.keycap.minGap(m.printed.upper, 3);
  const keycapGapPressed = mp.reference.keycap.minGap(mp.printed.upper, 3);
  const screwBite = m.reference.screws.intersect(m.printed.upper).volume();
  return { ok, pairs: pairs.length + 1, keycapGap, keycapGapPressed, screwBite, L: m.L, model: m };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const w = await Module(); w.setup();
  const r = runChecks(w);
  for (const [k, v] of Object.entries({ ...r.model.printed, ...r.model.reference })) {
    const b = v.boundingBox();
    console.log(k.padEnd(11), 'genus', String(v.genus()).padStart(3), 'tris', String(v.numTri()).padStart(5), 'vol', v.volume().toFixed(1).padStart(8),
      ' bbox', b.min.map(x => x.toFixed(1)).join(','), '→', b.max.map(x => x.toFixed(1)).join(','));
  }
  console.log({ ok: r.ok, pairs: r.pairs, keycapGap: r.keycapGap.toFixed(2), keycapGapPressed: r.keycapGapPressed.toFixed(2), screwBite: r.screwBite.toFixed(1) });
  console.log(Object.fromEntries(Object.entries(r.L).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(2)])));
  process.exit(r.ok ? 0 : 1);
}
