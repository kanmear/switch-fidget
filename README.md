# MX Switch Fidget

A standard Cherry MX switch and keycap in a low-profile, 3D-printable housing. The upper housing is opaque, the lower housing is a frosted light diffuser, and a small custom PCB handles the lights, the battery and USB-C.

- **Hot-swap:** the switch clips into a 1.5 mm plate and plugs into a Kailh MX socket on the PCB.
- **Raised collar:** hides about 1 mm of the keycap skirt at rest, with 4 mm of travel left unobstructed.
- **Lighting:** 4 down-facing LEDs light the diffuser, 4 halo LEDs feed light pipes into the well around the keycap, and an SK6812MINI-E sits in the switch window.
- **Battery:** a 301020 LiPo on a JST-SH plug, reached by removing the diffuser (2 × M2 screws).
- **USB-C:** exits the diffuser on one side, for charging and configuring the light effects.
- **Input:** the switch is a momentary closure that the MCU reads. The battery always powers the electronics.

**Envelope:** 27 × 27 mm footprint, tapering to 22 mm at the collar. 21.3 mm to the collar rim, about 28 mm with a Cherry-profile keycap.

## Files

| Path | What |
|---|---|
| `src/params.mjs` | Every dimension (switch, collar, PCB, battery, fasteners) |
| `src/model.mjs` | Parametric CSG model ([manifold-3d](https://github.com/elalish/manifold)) |
| `scripts/check.mjs` | Validity and interference checks across all parts and components (also run at full key travel) |
| `scripts/build.mjs` | Writes `stl/*.stl` (print orientation) and `index.html` from `preview/template.html` |
| `index.html` | Self-contained three.js viewer (explode, cut-away, key press, light modes). Open it locally or via GitHub Pages |

```bash
npm install
npm run build     # checks fit, then regenerates STLs + preview
npm run check     # fit checks only
```

## Live preview (GitHub Pages)

`.github/workflows/pages.yml` rebuilds the model on every push to `main`. It fails if any parts collide, and otherwise publishes the preview with STL download links. To turn it on once, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Then re-run the **Pages** workflow from the Actions tab. ("Deploy from a branch" also works, because `index.html` is committed at the root, but that skips the fit checks.)

## Printing

| Part | Material | Orientation |
|---|---|---|
| `upper_housing.stl` | Opaque PLA/PETG | Upright, no supports |
| `diffuser.stl` | Natural PETG or "transparent" PLA, 100% infill, sanded or bead-blasted for frost | Upright, no supports |

Print a test first and tune `plateCut` (13.9–14.1) until the switch clips in firmly.

## PCB (22.4 × 22.4 × 1.6 mm)

Underside: Kailh hot-swap socket (standard MX hot-swap footprint), USB-C receptacle overhanging the south edge by 1.2 mm, 4 × 2020 addressable LEDs at `ledsBottom`, a USB-capable MCU (e.g. CH32X035 or CH552), a LiPo charger and LDO, and a JST-SH 2-pin connector. Keep underside parts ≤ 3.4 mm tall.

Top side: 4 × 2020 LEDs under the halo light pipes (±8.5, ±8.5) and an SK6812MINI-E reverse-mount in the MX LED window. Nothing else goes on top outside the switch footprint, because the upper housing clamps the board there.

Holes: 4.0 mm centre, 3.0 mm switch pins, 1.9 mm pegs, and 2.2 mm screw holes at (±9.6, −3.0).

Circuit: LiPo → charger/LDO → MCU and LEDs, always powered. Switch pins → GPIO (pull-up) and GND. USB-C handles charging and config.

## Assumptions to verify

- Keycap skirt sits ~6 mm above the plate at rest (`keycapBottomAbovePlate`). Measure your keycap and set `collarAbovePlate` about 1 mm higher.
- The hot-swap socket footprint is approximated from the Kailh datasheet outline.
