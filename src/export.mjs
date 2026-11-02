// Mesh export helpers shared by the Node build and the in-browser configurator.

// Printed parts and how they sit on the bed.
export const PRINTS = {
  upper_housing: { part: 'upper',    flip: false, note: 'opaque · upright, no supports' },
  diffuser:      { part: 'diffuser', flip: false, note: 'frosted · upright, no supports' },
};

// Each part flat on the bed and centred.
export function printOriented(manifold, flip = false) {
  let m = flip ? manifold.rotate([180, 0, 0]) : manifold;
  const b = m.boundingBox();
  return m.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]]);
}

// Binary STL as an ArrayBuffer.
export function toStl(manifold, header = 'mx-fidget') {
  const { vertProperties: vp, triVerts: tv, numProp } = manifold.getMesh();
  const nTri = tv.length / 3;
  const buf = new ArrayBuffer(84 + nTri * 50), dv = new DataView(buf);
  for (let i = 0; i < Math.min(80, header.length); i++) dv.setUint8(i, header.charCodeAt(i) & 0x7f);
  dv.setUint32(80, nTri, true);
  let o = 84;
  const f = (x) => { dv.setFloat32(o, x, true); o += 4; };
  for (let t = 0; t < nTri; t++) {
    const a = tv[3 * t] * numProp, b = tv[3 * t + 1] * numProp, c = tv[3 * t + 2] * numProp;
    const ux = vp[b] - vp[a], uy = vp[b + 1] - vp[a + 1], uz = vp[b + 2] - vp[a + 2];
    const wx = vp[c] - vp[a], wy = vp[c + 1] - vp[a + 1], wz = vp[c + 2] - vp[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    f(nx / l); f(ny / l); f(nz / l);
    for (const i of [a, b, c]) { f(vp[i]); f(vp[i + 1]); f(vp[i + 2]); }
    o += 2; // attribute byte count = 0
  }
  return buf;
}

// Positions (xyz only, rounded to 1 µm) and indices for the viewer.
export function meshArrays(manifold) {
  const { vertProperties: vp, triVerts, numProp: n } = manifold.getMesh();
  const nv = vp.length / n;
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) pos[3 * i + k] = Math.round(vp[i * n + k] * 1000) / 1000;
  const idx = nv < 65536 ? Uint16Array.from(triVerts) : Uint32Array.from(triVerts);
  return { pos, idx };
}

// Numeric levels only (drops the helper functions) for serialising.
export function numericLevels(L) {
  return Object.fromEntries(Object.entries(L).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(3)]));
}
