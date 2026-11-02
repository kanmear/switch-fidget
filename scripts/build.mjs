// Builds print-ready STLs (stl/) and the self-contained 3D preview (index.html at the repo root, so GitHub Pages serves it in either source mode).
//   node scripts/build.mjs
import Module from 'manifold-3d';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, BATTERIES } from '../src/params.mjs';
import { runChecks } from '../src/checks.mjs';
import { PRINTS, printOriented, toStl, meshArrays, numericLevels } from '../src/export.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = (name) => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
const CDN = {
  three: `https://cdn.jsdelivr.net/npm/three@${pkg('three')}`,
  manifold: `https://cdn.jsdelivr.net/npm/manifold-3d@${pkg('manifold-3d')}`,
};

const wasm = await Module();
wasm.setup();
const t0 = performance.now();
const checks = runChecks(wasm, P, undefined, console.error);
if (!checks.ok) { console.error('Fit checks failed — see above.'); process.exit(1); }
const { model } = checks;
console.log(`fit checks: ${checks.pairs} part pairs, no interference; keycap side clearance ${checks.keycapGap.toFixed(2)} mm (${(performance.now() - t0).toFixed(0)} ms)`);

// ---------- STL export (binary, print orientation) ----------
mkdirSync(join(root, 'stl'), { recursive: true });
for (const [name, s] of Object.entries(PRINTS)) {
  const m = printOriented(model.printed[s.part], s.flip);
  writeFileSync(join(root, 'stl', `${name}.stl`), Buffer.from(toStl(m)));
  const bb = m.boundingBox();
  console.log(`stl/${name}.stl  ${m.numTri()} tris  ${bb.max.map((x, i) => (x - bb.min[i]).toFixed(1)).join(' x ')} mm  ${(m.volume() / 1000).toFixed(2)} cm³`);
}

// ---------- worker bundle for the in-browser configurator ----------
// A deliberately tiny bundler: inlines relative ES-module imports (single-line `import { a, b as c } from './x.mjs'`)
// into one scope and points bare manifold-3d imports at the CDN. Keeps src/ the single source of truth.
function bundle(entry) {
  const seen = new Set(), out = [], head = [];
  (function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const lines = readFileSync(file, 'utf8').split('\n');
    const body = [];
    for (const line of lines) {
      const m = line.match(/^import\s+(.+?)\s+from\s+'([^']+)';\s*$/);
      if (!m) { body.push(line.replace(/^export\s+(?=(const|function|let|class|async)\b)/, '')); continue; }
      const [, what, from] = m;
      if (from.startsWith('.')) {
        visit(resolve(dirname(file), from));
        const named = what.match(/^\{(.+)\}$/);
        if (!named) throw new Error(`bundle: only named imports are supported (${file}: ${line})`);
        for (const part of named[1].split(',').map(s => s.trim()).filter(Boolean)) {
          const [orig, alias] = part.split(/\s+as\s+/);
          if (alias) body.unshift(`const ${alias} = ${orig};`);
        }
      } else if (from.startsWith('manifold-3d/')) {
        head.push(`import ${what} from '${CDN.manifold}/${from.slice('manifold-3d/'.length)}';`);
      } else throw new Error(`bundle: unexpected import '${from}' in ${file}`);
    }
    out.push(`// ---- ${file.slice(root.length + 1)} ----`, ...body);
  })(entry);
  return [...head, ...out].join('\n');
}
const workerSrc = bundle(join(root, 'preview', 'worker.mjs'));

// ---------- preview data ----------
const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
const parts = {};
for (const [k, m] of Object.entries({ ...model.printed, ...model.reference })) {
  const { pos, idx } = meshArrays(m);
  parts[k] = { p: b64(pos), i: b64(idx), i32: idx instanceof Uint32Array };
}
const data = {
  parts,
  levels: numericLevels(model.L),
  cell: model.cell,
  params: P,
  batteries: BATTERIES,
  prints: PRINTS,
  checks: { clean: checks.ok, problems: checks.problems, pairs: checks.pairs, keycapGap: +checks.keycapGap.toFixed(2), pcbWall: +checks.pcbWall.toFixed(2) },
};
const tpl = readFileSync(join(root, 'preview', 'template.html'), 'utf8');
const html = tpl
  .replaceAll('__THREE_CDN__', CDN.three)
  .replace('/*__MODEL_DATA__*/', () => `window.MODEL = ${JSON.stringify(data)};`)
  .replace('/*__WORKER_SRC__*/', () => `window.WORKER_SRC = ${JSON.stringify(workerSrc).replace(/<\/script/gi, '<\\/script')};`);
writeFileSync(join(root, 'index.html'), html);
console.log(`index.html  ${(html.length / 1024).toFixed(0)} KB (worker ${(workerSrc.length / 1024).toFixed(0)} KB)`);
