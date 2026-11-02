// Validity + fit checks. Exits non-zero if anything collides.
//   node scripts/check.mjs [battery]     e.g. `node scripts/check.mjs cr1632`
import Module from 'manifold-3d';
import { P, BATTERIES } from '../src/params.mjs';
import { runChecks } from '../src/checks.mjs';
import { numericLevels } from '../src/export.mjs';

if (import.meta.url === `file://${process.argv[1]}`) {
  const w = await Module(); w.setup();
  const arg = process.argv[2];
  const variants = arg === 'all' ? Object.keys(BATTERIES) : [arg || P.battery];
  let ok = true;
  for (const battery of variants) {
    const p = { ...P, battery };
    const t0 = performance.now();
    const r = runChecks(w, p, undefined, console.log);
    const ms = performance.now() - t0;
    if (variants.length === 1) {
      for (const [k, v] of Object.entries({ ...r.model.printed, ...r.model.reference })) {
        const b = v.boundingBox();
        console.log(k.padEnd(11), 'genus', String(v.genus()).padStart(3), 'tris', String(v.numTri()).padStart(5), 'vol', v.volume().toFixed(1).padStart(8),
          ' bbox', b.min.map(x => x.toFixed(1)).join(','), '→', b.max.map(x => x.toFixed(1)).join(','));
      }
      console.log(numericLevels(r.L));
    }
    console.log(`${battery.padEnd(11)} ${r.ok ? 'ok  ' : 'FAIL'} ${r.pairs} pairs (${r.tested} overlapping boxes) · keycap gap ${r.keycapGap.toFixed(2)} mm · ` +
      `PCB wall ${r.pcbWall.toFixed(2)} mm · height ${r.L.Ztop.toFixed(1)} mm · cell at y=${r.model.cell.cy} · ${ms.toFixed(0)} ms`);
    ok &&= r.ok;
  }
  process.exit(ok ? 0 : 1);
}
