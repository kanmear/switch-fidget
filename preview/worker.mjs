// In-browser configurator worker: rebuilds the model for a parameter set, runs the fit checks,
// and returns viewer meshes plus print-ready STLs. scripts/build.mjs inlines this file and the
// src/ modules it imports into index.html, and points the manifold-3d imports at the CDN.
import Module from 'manifold-3d/manifold.js';
import { garbageCollectManifold, cleanup } from 'manifold-3d/lib/garbage-collector.js';
import { P } from '../src/params.mjs';
import { runChecks, summarizeChecks } from '../src/checks.mjs';
import { PRINTS, printOriented, toStl, meshArrays, numericLevels } from '../src/export.mjs';

let wasmReady;
const engine = () => wasmReady ??= Module().then((w) => { w.setup(); garbageCollectManifold(w); return w; });

self.onmessage = async ({ data: { id, params, stl } }) => {
  try {
    const wasm = await engine();
    const t0 = performance.now();
    const p = { ...P, ...params };
    const r = runChecks(wasm, p);
    const parts = {}, transfer = [];
    for (const [k, m] of Object.entries({ ...r.model.printed, ...r.model.reference })) {
      const { pos, idx } = meshArrays(m);
      parts[k] = { pos, idx };
      transfer.push(pos.buffer, idx.buffer);
    }
    const stls = {};
    if (stl) for (const [name, s] of Object.entries(PRINTS)) {
      stls[name] = toStl(printOriented(r.model.printed[s.part], s.flip));
      transfer.push(stls[name]);
    }
    const out = {
      id, parts, stls, levels: numericLevels(r.L), cell: r.model.cell,
      checks: summarizeChecks(r),
      ms: Math.round(performance.now() - t0),
    };
    cleanup();
    self.postMessage(out, transfer);
  } catch (err) {
    try { cleanup(); } catch { /* the wasm heap may already be unusable; report the original error */ }
    self.postMessage({ id, error: err?.message ?? String(err) });
  }
};
self.postMessage({ ready: true });
