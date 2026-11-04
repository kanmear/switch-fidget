// Parametric model of the MX switch fidget, built with manifold-3d (robust mesh CSG).
// Returns the two printed parts plus reference components (switch, keycap, PCB, LEDs,
// battery, screws) used by the preview and by the interference checks. The keycap and stem are
// modelled at rest; press travel is a pure translation by P.travel along −Z.

import { P as DEFAULT_P, levels, cell } from './params.mjs';

const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]]; // sign pairs for the four corners

/**
 * Build every part for a parameter set.
 * @param {object} wasm  initialised manifold-3d module (after `setup()`)
 * @param {object} [P]   parameter set (defaults to params.mjs `P`)
 * @returns {{ L: object, cell: object, printed: Record<string, object>, reference: Record<string, object> }}
 */
export function buildModel(wasm, P = DEFAULT_P) {
  const { Manifold: M, CrossSection: CS } = wasm;
  const L = levels(P);
  const C = cell(P);
  const seg = P.seg;

  const rrect = (w, h, r = 0, s = seg) =>
    r <= 0.001 ? CS.square([w, h], true)
               : CS.square([w - 2 * r, h - 2 * r], true).offset(r, 'Round', 2, s);
  const prism = (cs, z0, z1) => cs.extrude(z1 - z0).translate([0, 0, z0]);
  const box = (x0, x1, y0, y1, z0, z1) => M.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);
  const cyl = (x, y, z0, z1, r, s = seg) => M.cylinder(z1 - z0, r, r, s).translate([x, y, z0]);
  const U = (arr) => M.union(arr.filter(Boolean));
  const at = (m, [x, y]) => m.translate([x, y, 0]);
  const slab = (half, r, z) => prism(rrect(2 * half, 2 * half, r), z - 0.005, z + 0.005);
  // tapered rounded-square solid between z0 and z1, inset by `inset` from the outer skin
  const taper = (z0, z1, inset = 0) =>
    M.hull([slab(L.halfAt(z0) - inset, Math.max(0.4, L.rAt(z0) - inset), z0 + 0.005),
            slab(L.halfAt(z1) - inset, Math.max(0.4, L.rAt(z1) - inset), z1 - 0.005)]);

  const { Zb, Zpcb, Zpt, Ztop } = L;

  // =====================================================================
  // UPPER HOUSING (opaque): collar, switch plate, PCB pocket
  // =====================================================================
  const tc = P.topChamfer;
  let upper = U([
    taper(Zb, Ztop - tc),
    M.hull([slab(L.halfAt(Ztop - tc), L.rAt(Ztop - tc), Ztop - tc),
            slab(L.halfAt(Ztop) - tc, L.rAt(Ztop) - tc, Ztop - 0.005)]),
  ]);
  const ci = P.collarInner, wc = P.wellChamfer;
  const haloXY = CORNERS.map(([sx, sy]) => [sx * P.haloPos, sy * P.haloPos]);
  upper = upper.subtract(U([
    prism(rrect(ci, ci, P.collarR), Zpt, Ztop + 1),
    M.hull([prism(rrect(ci, ci, P.collarR), Ztop - wc - 0.01, Ztop - wc),
            prism(rrect(ci + 2 * wc + 1, ci + 2 * wc + 1, P.collarR + wc + 0.5), Ztop + 0.5, Ztop + 0.51)]),
    box(-P.plateCut / 2, P.plateCut / 2, -P.plateCut / 2, P.plateCut / 2, Zpt - P.plateThk - 0.01, Zpt + 0.01),
    box(-P.clipCavity / 2, P.clipCavity / 2, -P.clipCavity / 2, P.clipCavity / 2, Zpcb - 0.01, Zpt - P.plateThk),
    prism(rrect(P.pcbSize + 2 * P.pcbFit, P.pcbSize + 2 * P.pcbFit, P.pcbR + P.pcbFit), Zb - 1, Zpcb),
    ...haloXY.map(p => at(U([
      cyl(0, 0, Zpcb - 0.01, Zpt + 0.01, P.haloD / 2, 24),
      box(-P.haloLedPocket[0] / 2, P.haloLedPocket[0] / 2, -P.haloLedPocket[0] / 2, P.haloLedPocket[0] / 2, Zpcb - 0.01, Zpcb + P.haloLedPocket[1]),
    ]), p)),
    ...P.screwPos.map(p => at(cyl(0, 0, Zb - 1, Zpcb + P.screwPilotDepth, P.screwPilotD / 2, 24), p)),
  ]));

  // =====================================================================
  // DIFFUSER (frosted translucent): light cup, battery cradle, USB-C exit
  // =====================================================================
  const bc = P.bottomChamfer, w = P.diffWall;
  let diff = U([
    M.hull([slab(L.halfAt(0) - bc, L.rAt(0) - bc, 0.005), slab(L.halfAt(bc), L.rAt(bc), bc)]),
    taper(bc, Zb),
  ]);
  // cavity: tapered inner wall, then a 45° ledge that carries the PCB perimeter
  const ledgeZ = Zb - 0.8;
  const cavity = U([
    taper(P.diffFloor, ledgeZ - 0.6, w),
    M.hull([slab(L.halfAt(ledgeZ - 0.6) - w, L.rAt(ledgeZ - 0.6) - w, ledgeZ - 0.6),
            slab(P.ledLedge, 1.6, ledgeZ)]),
    prism(rrect(2 * P.ledLedge, 2 * P.ledLedge, 1.6), ledgeZ, Zb + 1),
  ]);
  diff = diff.subtract(cavity);
  // screw posts
  diff = diff.add(U(P.screwPos.map(p => at(cyl(0, 0, P.diffFloor - 0.01, Zb, P.postD / 2), p)))
    .intersect(taper(0, Zb)));
  // battery cradle: a low rim around the cell, open toward the JST plug for the leads
  const cw = P.cradleW, cH = P.diffFloor + P.cradleH;
  let cradle;
  if (C.kind === 'pouch') {
    const [bw, bl] = C.size, bcx = bw / 2 + P.battClear, bcy = bl / 2 + P.battClear;
    cradle = box(-bcx - cw, bcx + cw, -bcy - cw, bcy + cw, P.diffFloor - 0.01, cH)
      .subtract(box(-bcx, bcx, -bcy, bcy, 0, 10));
  } else {
    const r = C.d / 2 + P.battClear;
    cradle = cyl(C.cx, C.cy, P.diffFloor - 0.01, cH, r + cw).subtract(cyl(C.cx, C.cy, 0, 10, r));
  }
  cradle = cradle.subtract(box(-2.5, 2.5, C.cy, 30, 0, 10)); // lead exit toward the JST plug
  diff = diff.add(cradle.intersect(taper(0, Zb)));
  // USB-C: pocket for the receptacle body + rounded mouth through the wall
  const [mw, mh, mr] = P.usbMouth;
  const usbZc = L.usbZ0 + P.usbH / 2;
  diff = diff.subtract(U([
    box(-P.usbW / 2 - 0.25, P.usbW / 2 + 0.25, L.usbY0 - 0.05, -4, L.usbZ0 - 0.25, Zb + 0.01),
    prism(rrect(mw, mh, mr), 0, 10).rotate([90, 0, 0]).translate([0, L.usbY0 + 0.5, usbZc]),
    ...P.screwPos.map(p => at(U([cyl(0, 0, -1, Zb + 1, P.screwClearD / 2, 24),
                                 cyl(0, 0, -1, P.headDepth, P.headD / 2, 32)]), p)),
  ]));

  // =====================================================================
  // REFERENCE COMPONENTS (not printed)
  // =====================================================================
  const sw = U([
    box(-6.95, 6.95, -6.95, 6.95, Zpcb, Zpt),
    M.hull([prism(rrect(15.6, 15.6, 0.6), Zpt, Zpt + 0.8),
            prism(rrect(11.0, 12.6, 1.2), Zpt + P.housingAbovePlate - 0.1, Zpt + P.housingAbovePlate)]),
    cyl(0, 0, Zpcb - 3.0, Zpcb + 0.01, 1.95),
    ...P.pegs.map(p => at(cyl(0, 0, Zpcb - 2.75, Zpcb + 0.01, 0.85, 16), p)),
    ...P.pins.map(p => at(cyl(0, 0, Zpcb - 3.3, Zpcb + 0.01, 0.6, 16), p)),
  ]).subtract(at(box(-2.6, 2.6, -1.6, 1.6, Zpcb - 0.1, Zpcb + 4.5), P.ledPos));
  const stemTop = Zpt + P.housingAbovePlate + P.stemAboveHousing;
  const stem = U([box(-2.05, 2.05, -0.6, 0.6, stemTop - 4.6, stemTop),
                  box(-0.65, 0.65, -2.05, 2.05, stemTop - 4.6, stemTop)]);

  const kH = P.keycapH, kz = Zpt + P.keycapBottomAbovePlate;
  let keycap = M.hull([prism(rrect(18.0, 18.0, 1.0), 0, 0.01), prism(rrect(12.8, 14.6, 2.2), kH - 0.01, kH)]);
  keycap = keycap.subtract(U([
    M.cylinder(40, 40, 40, 160, true).rotate([90, 0, 0]).translate([0, 0, kH - 0.9 + 40]),
    M.hull([prism(rrect(15.8, 15.8, 0.6), -0.01, 0), prism(rrect(10.6, 12.4, 1.2), kH - 2.2, kH - 2.19)]),
  ])).add(cyl(0, 0, 0.8, kH - 1.5, 2.75).subtract(U([
    box(-2.1, 2.1, -0.66, 0.66, 0.7, 4.6), box(-0.7, 0.7, -2.1, 2.1, 0.7, 4.6)])));
  keycap = keycap.translate([0, 0, kz]);

  // PCB with hot-swap footprint holes
  const pcb = prism(rrect(P.pcbSize, P.pcbSize, P.pcbR), Zb, Zpcb).subtract(U([
    cyl(0, 0, Zb - 1, Zpcb + 1, 2.0),
    ...P.pins.map(p => at(cyl(0, 0, Zb - 1, Zpcb + 1, 1.5, 24), p)),
    ...P.pegs.map(p => at(cyl(0, 0, Zb - 1, Zpcb + 1, 0.95, 16), p)),
    ...P.screwPos.map(p => at(cyl(0, 0, Zb - 1, Zpcb + 1, 1.1, 16), p)),
    at(box(-1.7, 1.7, -1.45, 1.45, Zb - 1, Zpcb + 1), P.ledPos),
  ]));
  // Kailh socket: moulded body with the two metal solder terminals at its ends.
  const socket = U(P.socketPads.slice(0, 2).map(([x0, x1, y0, y1]) => box(x0, x1, y0, y1, Zb - P.socketH, Zb)))
    .subtract(U(P.pins.map(p => at(cyl(0, 0, Zb - 3, Zb + 1, 0.95, 24), p))))
    .subtract(cyl(0, 0, Zb - 3, Zb + 1, 2.1));
  const leadParts = P.socketPads.slice(2).map(([x0, x1, y0, y1]) => box(x0, x1, y0, y1, Zb - 0.25, Zb));

  // USB-C receptacle: a hollow stadium shell open at the mouth, with the contact tongue inside.
  const tube = (cs, y0, y1, zc) => cs.extrude(y1 - y0).rotate([90, 0, 0]).translate([0, y1, zc]);
  const uy0 = L.usbY0, uy1 = L.usbY0 + P.usbL, uzc = L.usbZ0 + P.usbH / 2, ut = 0.22;
  const usb = U([
    tube(rrect(P.usbW, P.usbH, 1.45), uy0 + 0.25, uy1, uzc),
    tube(rrect(P.usbW, P.usbH, 1.45).offset(-0.08, 'Round', 0, seg), uy0, uy0 + 0.25, uzc), // rolled mouth lip
  ]).subtract(U([
    tube(rrect(P.usbW - 2 * ut, P.usbH - 2 * ut, 1.45 - ut), uy0 - 1, uy1 - 0.5, uzc),
    tube(rrect(P.usbW - 2 * ut, P.usbH - 2 * ut, 1.45 - ut).offset(0.1, 'Round', 0, seg), uy0 - 1, uy0 + 0.12, uzc), // mouth chamfer
  ]));
  const tw = 6.6, tt = 0.66, ty0 = uy0 + 1.3;
  const usbTongue = M.hull([box(-tw / 2 + 0.3, tw / 2 - 0.3, ty0, ty0 + 0.3, uzc - tt / 2 + 0.08, uzc + tt / 2 - 0.08),
                            box(-tw / 2, tw / 2, ty0 + 0.3, uy1 - 0.5, uzc - tt / 2, uzc + tt / 2)]);
  for (let i = 0; i < 12; i++) {           // 12 contacts per side, 0.5 mm pitch
    const x = (i - 5.5) * 0.5;
    for (const sz of [1, -1]) {
      const z0 = sz > 0 ? uzc + tt / 2 : uzc - tt / 2 - 0.04;
      leadParts.push(box(x - 0.125, x + 0.125, ty0 + 0.45 + (i % 2 ? 0.25 : 0), uy1 - 0.7, z0, z0 + 0.04));
    }
  }

  // Bottom-side parts: QFN MCU with edge pads, SOT-23-5 charger with gull-wing leads, side-entry JST-SH.
  const mcu = [1.9, 4.7, -4.8, -2.0];       // x0, x1, y0, y1 (pads stick out to the old 1.8..4.8 envelope)
  const qfnH = 0.85;
  for (let i = 0; i < 5; i++) {
    const f = mcu[0] + 0.5 + i * 0.45, g = mcu[2] + 0.5 + i * 0.45;
    leadParts.push(box(f - 0.12, f + 0.12, mcu[2] - 0.1, mcu[2], Zb - 0.2, Zb), box(f - 0.12, f + 0.12, mcu[3], mcu[3] + 0.1, Zb - 0.2, Zb),
                   box(mcu[0] - 0.1, mcu[0], g - 0.12, g + 0.12, Zb - 0.2, Zb), box(mcu[1], mcu[1] + 0.1, g - 0.12, g + 0.12, Zb - 0.2, Zb));
  }
  const sot = [-4.95, -2.05, -4.2, -2.6], sotZ = Zb - 1.1;
  const gull = (x, side) => {                // one lead leaving the body at mid-height and stepping up to its pad
    const y0 = side < 0 ? sot[2] : sot[3], s = side;
    return U([box(x - 0.2, x + 0.2, Math.min(y0, y0 + s * 0.3), Math.max(y0, y0 + s * 0.3), Zb - 0.62, Zb - 0.48),
              box(x - 0.2, x + 0.2, Math.min(y0 + s * 0.3, y0 + s * 0.45), Math.max(y0 + s * 0.3, y0 + s * 0.45), Zb - 0.62, Zb),
              box(x - 0.2, x + 0.2, Math.min(y0 + s * 0.45, y0 + s * 0.6), Math.max(y0 + s * 0.45, y0 + s * 0.6), Zb - 0.14, Zb)]);
  };
  leadParts.push(gull(-4.45, -1), gull(-3.5, -1), gull(-2.55, -1), gull(-4.45, 1), gull(-2.55, 1));
  const jst = [-3.0, 3.0, 7.2, 10.2];
  const jstBody = box(jst[0], jst[1], jst[2], jst[3], Zb - 2.9, Zb)
    .subtract(box(-1.6, 1.6, jst[2] - 0.01, jst[3] - 0.9, Zb - 2.45, Zb - 0.75))          // plug opening, faces the cell
    .subtract(box(-2.6, 2.6, jst[3] - 0.5, jst[3] + 0.01, Zb - 2.9 - 0.01, Zb - 2.2));      // stepped back
  leadParts.push(...[-0.5, 0.5].map(x => box(x - 0.15, x + 0.15, jst[2] + 0.6, jst[3] - 0.9, Zb - 1.7, Zb - 1.45)),
                 ...[-1, 1].map(sx => box(sx > 0 ? jst[1] : jst[0] - 0.3, sx > 0 ? jst[1] + 0.3 : jst[0], 8.0, 9.6, Zb - 1.4, Zb))); // side hold-down tabs
  const chips = U([
    M.hull([box(mcu[0] + 0.05, mcu[1] - 0.05, mcu[2] + 0.05, mcu[3] - 0.05, Zb - qfnH, Zb - qfnH + 0.1),
            box(mcu[0], mcu[1], mcu[2], mcu[3], Zb - qfnH + 0.1, Zb)]),                // MCU (QFN, USB-capable, e.g. CH32X035 / CH552)
    box(sot[0], sot[1], sot[2], sot[3], sotZ, Zb - 0.05),                               // LiPo charger (SOT-23-5)
    jstBody,                                                                            // JST-SH 2-pin battery plug
  ]).subtract(cyl(mcu[0] + 0.45, mcu[2] + 0.45, Zb - qfnH - 0.1, Zb - qfnH + 0.04, 0.18, 16)); // pin-1 dimple
  const leads = U(leadParts);

  // LEDs: a white package with a recessed, glowing lens on the emitting face.
  const ledPkg = (x, y, z0, z1, w, h, up) => {
    const win = (za, zb) => at(prism(rrect(w - 0.5, h - 0.5, 0.25, 16), za, zb), [x, y]); // tiny radius: few segments
    return { body: at(box(-w / 2, w / 2, -h / 2, h / 2, z0, z1), [x, y]).subtract(up ? win(z1 - 0.3, z1 + 0.01) : win(z0 - 0.01, z0 + 0.3)),
             lens: up ? win(z1 - 0.3, z1 - 0.06) : win(z0 + 0.06, z0 + 0.3) };
  };
  const bot = P.ledsBottom.map(([x, y]) => ledPkg(x, y, Zb - 0.9, Zb, 2, 2, false));
  const halo = CORNERS.map(([sx, sy]) => ledPkg(sx * P.haloPos, sy * P.haloPos, Zpcb, Zpcb + 0.9, 2, 2, true));
  const mini = ledPkg(P.ledPos[0], P.ledPos[1], Zpcb - 0.6, Zpcb + 1.2, 3.2, 2.8, true); // SK6812MINI-E in the switch window
  const ledsBottom = U(bot.map(l => l.lens));
  const ledsHalo = U([...halo.map(l => l.lens), mini.lens]);
  const ledBodies = U([...bot, ...halo, mini].map(l => l.body));
  let battery, battTab;
  if (C.kind === 'pouch') {
    const [bx, by] = C.size;
    battery = M.hull([prism(rrect(bx, by - 1.0, 1.2), L.battZ0, L.battZ1),
                      prism(rrect(bx - 0.6, by, 1.0), L.battZ0 + 0.4, L.battZ1 - 0.4)]);
    battTab = box(-2.0, 2.0, by / 2, by / 2 + 1.2, L.battZ0 + 1.2, L.battZ0 + 1.8);
  } else {
    // tabbed coin cell: the can sits between two welded tabs; the top tab bends out toward the plug
    const t = P.coinTabs / 2, r = C.d / 2;
    battery = M.hull([cyl(C.cx, C.cy, L.battZ0 + t, L.battZ1 - t - 0.3, r),
                      cyl(C.cx, C.cy, L.battZ1 - t - 0.01, L.battZ1 - t, r - 0.6)]);
    battTab = U([box(-1.5, 1.5, C.cy - r + 1.5, C.cy + r + 1.0, L.battZ1 - t + 0.01, L.battZ1 - 0.01),
                 box(-1.5, 1.5, C.cy - r + 1.5, C.cy + r - 1.5, L.battZ0 + 0.01, L.battZ0 + t - 0.01)]);
  }
  // M2 pan-head screws with a Phillips recess, driven from below.
  const h0 = P.headDepth - 1.3;
  const screws = U(P.screwPos.map(p => at(U([
    M.hull([cyl(0, 0, h0, h0 + 0.01, 1.55, 32), cyl(0, 0, h0 + 0.45, P.headDepth, 1.9, 32)]),
    cyl(0, 0, P.headDepth, P.headDepth + 10, 1.0, 24),
  ]).subtract(U([
    box(-1.05, 1.05, -0.22, 0.22, h0 - 0.01, h0 + 0.75), box(-0.22, 0.22, -1.05, 1.05, h0 - 0.01, h0 + 0.75),
    M.cylinder(0.9, 0.75, 0.05, 16).translate([0, 0, h0 - 0.01]),
  ])), p)));

  return {
    L, cell: C,
    printed: { upper, diffuser: diff },
    reference: { switch: sw, stem, keycap, pcb, socket, usb, usbTongue, chips, leads, ledsBottom, ledsHalo, ledBodies, battery, battTab, screws },
  };
}
