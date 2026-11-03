// All dimensions in millimetres. X right, Y back ("north"), Z up. Centred on the switch axis.
// Edit and run `npm run build` to regenerate the STLs and the preview.

// Fixed clearances that are not meant to be tuned per build.
const POST_CLEARANCE = 0.2; // extra gap between a coin cell's keep-out circle and the screw posts
const BATT_HEADROOM = 0.3;  // air between the top of the cell and the PCB underside

/** Default parameter set. Pass a modified copy (`{ ...P, battery: 'cr1632' }`) to the model builders. */
export const P = {
  seg: 64,

  // ---------- enclosure shape (one continuous taper, split into two parts) ----------
  baseSize: 27.0,      // footprint at the bottom (≈1.4U)
  baseR: 3.6,          // corner radius at the bottom
  topR: 2.6,           // corner radius at the collar rim
  bottomChamfer: 0.6,
  topChamfer: 0.5,     // outer edge of the collar rim
  diffWall: 1.6,       // frosted diffuser wall
  diffFloor: 1.0,

  // ---------- Cherry MX switch ----------
  plateCut: 14.0,      // 14.0 nominal; 13.9-14.1 depending on printer
  plateThk: 1.5,
  switchBelowPlate: 5.0,
  clipCavity: 15.0,
  housingAbovePlate: 6.6,
  stemAboveHousing: 3.6,
  travel: 4.0,
  pins: [[-3.81, 2.54], [2.54, 5.08]],
  pegs: [[-5.08, 0], [5.08, 0]],
  ledPos: [0, -5.08],  // MX LED window (SK6812MINI-E reverse-mount on the PCB)

  // ---------- collar (keycap well) ----------
  collarInner: 19.2,   // Cherry 1u skirt is ~18.0-18.3
  collarWall: 1.4,
  collarR: 1.6,
  collarAbovePlate: 7.0, // keycap skirt rests ~6 mm above the plate: ~1 mm of skirt hidden at rest
  wellChamfer: 0.5,
  haloPos: 8.5,        // 4 light pipes at the well corners (top-side LEDs on the PCB)
  haloD: 1.2,
  haloLedPocket: [2.6, 1.0],

  // ---------- custom PCB ----------
  pcbSize: 22.4, pcbR: 2.0, pcbThk: 1.6, pcbFit: 0.2,
  underPcb: 3.4,       // tallest bottom-side part (USB-C 3.26, hot-swap socket 1.8)
  socketPads: [        // Kailh CPG151101S11 footprint, bottom side [x0,x1,y0,y1]
    [-6.0, 0.0, 0.8, 4.75], [-4.0, 4.8, 2.8, 6.8], [-8.4, -6.0, 1.45, 3.65], [4.8, 7.2, 4.0, 6.2],
  ],
  socketH: 1.8,
  usbW: 8.94, usbH: 3.26, usbL: 7.35, usbOverhang: 1.2, // receptacle on the PCB underside, south edge
  usbMouth: [9.3, 3.6, 1.6],
  ledsBottom: [[-8.6, -8.6], [8.6, -8.6], [-9.0, 7.6], [9.0, 8.4]], // 2020 addressable LEDs facing down
  ledLedge: 10.4,      // diffuser ledge supports the PCB from this half-width outward

  // ---------- fasteners ----------
  screwPos: [[-9.6, -3.0], [9.6, -3.0]], // 2 x M2x10 from below
  screwClearD: 2.4, screwPilotD: 1.7, screwPilotDepth: 4.3,
  headD: 4.0, headDepth: 2.8, postD: 4.4,

  // ---------- battery (key into BATTERIES below; always on a JST-SH plug) ----------
  battery: 'lipo301020',
  battClear: 0.4, cradleH: 1.2, cradleW: 1.0,
  coinTabs: 0.4,       // solder tabs on a tabbed coin cell (top + bottom)

  // ---------- keycap mock ----------
  keycapBottomAbovePlate: 6.0,
  keycapH: 8.0,
};

// Cells the diffuser can hold. A pouch sits in a rectangular cradle and a coin cell sits in a round one.
// The coin cradle moves north just far enough to clear the M2 screw posts.
// 20 mm cells (CR2032/LIR2032) are not listed because they can't clear the posts in a 27 mm body (see README).
export const BATTERIES = {
  lipo301020: { kind: 'pouch', label: '301020 LiPo pouch', size: [10.0, 20.0, 3.0], volts: 3.7, mAh: 40, rechargeable: true },
  cp1254:     { kind: 'coin',  label: 'CP1254 / LIR1254 Li-ion coin', d: 12.1, h: 5.4, volts: 3.7, mAh: 55, rechargeable: true },
  cr1632:     { kind: 'coin',  label: 'CR1632 lithium coin (tabbed)', d: 16.0, h: 3.2, volts: 3.0, mAh: 130, rechargeable: false },
  cr1620:     { kind: 'coin',  label: 'CR1620 lithium coin (tabbed)', d: 16.0, h: 2.0, volts: 3.0, mAh: 75, rechargeable: false },
};

// Resolved cell geometry: footprint centre (cx, cy), stack height h (including tabs) and the cradle cut-out.
export function cell(p = P) {
  const b = BATTERIES[p.battery];
  if (!b) throw new Error(`unknown battery '${p.battery}' (one of ${Object.keys(BATTERIES).join(', ')})`);
  if (b.kind === 'pouch') return { ...b, key: p.battery, cx: 0, cy: 0, h: b.size[2] };
  const R = b.d / 2 + p.battClear + p.postD / 2 + POST_CLEARANCE; // keep-out radius around each screw post
  let cy = 0;
  for (const [sx, sy] of p.screwPos) if (R * R > sx * sx) cy = Math.max(cy, sy + Math.sqrt(R * R - sx * sx));
  return { ...b, key: p.battery, cx: 0, cy: +cy.toFixed(2), h: b.h + p.coinTabs };
}

/**
 * Z levels and tapered-body helpers for a parameter set: Zb (PCB bottom / split plane), Zpcb, Zpt (plate top),
 * Ztop (collar rim), plus `halfAt(z)` / `rAt(z)` for the half-width and corner radius of the outer skin.
 */
export function levels(p = P) {
  const Zb = p.diffFloor + cell(p).h + BATT_HEADROOM + p.underPcb; // PCB bottom = diffuser top = upper housing bottom
  const Zpcb = Zb + p.pcbThk;                            // PCB top = switch housing bottom
  const Zpt = Zpcb + p.switchBelowPlate;                 // plate top
  const Ztop = Zpt + p.collarAbovePlate;                 // collar rim
  const topHalf = p.collarInner / 2 + p.collarWall;
  const baseHalf = p.baseSize / 2;
  const halfAt = (z) => baseHalf + (topHalf - baseHalf) * (z / Ztop);
  const rAt = (z) => p.baseR + (p.topR - p.baseR) * (z / Ztop);
  return { Zb, Zpcb, Zpt, Ztop, topHalf, baseHalf, halfAt, rAt,
           battZ0: p.diffFloor, battZ1: p.diffFloor + cell(p).h,
           usbZ0: Zb - p.usbH, usbY0: -(p.pcbSize / 2 + p.usbOverhang) };
}
