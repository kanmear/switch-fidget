# MX Switch Fidget

A standard Cherry MX switch and keycap in a low-profile, 3D-printable housing. The upper housing is opaque, the lower housing is a frosted light diffuser, and a small custom PCB handles the lights, the battery and USB-C.

- **Hot-swap:** the switch clips into a 1.5 mm plate and plugs into a Kailh MX socket on the PCB.
- **Raised collar:** hides about 1 mm of the keycap skirt at rest, with 4 mm of travel left unobstructed.
- **Lighting:** 4 down-facing LEDs light the diffuser, 4 halo LEDs feed light pipes into the well around the keycap, and an SK6812MINI-E sits in the switch window.
- **Battery:** a 301020 LiPo on a JST-SH plug by default, or a coin cell (see [Coin cells](#coin-cells)). Either is reached by removing the diffuser (2 × M2 screws).
- **USB-C:** exits the diffuser on one side, for charging and configuring the light effects.
- **Input:** the switch is a momentary closure that the MCU reads. The battery always powers the electronics.

**Envelope:** 27 × 27 mm footprint, tapering to 22 mm at the collar. 21.3 mm to the collar rim, about 28 mm with a Cherry-profile keycap.

## Files

| Path | What |
|---|---|
| `src/params.mjs` | Every dimension (switch, collar, PCB, fasteners) and the battery presets |
| `src/model.mjs` | Parametric CSG model ([manifold-3d](https://github.com/elalish/manifold)) |
| `src/checks.mjs` | Validity, interference (also at full key travel), keycap clearance and wall checks |
| `src/export.mjs` | STL writer and mesh helpers, shared by Node and the browser |
| `scripts/check.mjs` | Runs the checks for every battery preset (`node scripts/check.mjs cr1632` for one) |
| `scripts/build.mjs` | Writes `stl/*.stl` (print orientation) and `index.html` from `preview/template.html`, and inlines `preview/worker.mjs` + `src/` for the configurator |
| `index.html` | Self-contained three.js viewer and configurator. Open it locally or via GitHub Pages |

```bash
npm install
npm run build     # checks fit, then regenerates STLs + preview
npm run check     # fit checks for every battery preset
```

## Preview and configurator

`index.html` is the interactive preview:

- **Play:** click and hold the keycap, hold <kbd>Space</kbd>, or use **Press key**. Choose a linear, tactile, clicky or silent switch: it changes the stem colour and a synthesised switch sound (no audio files). Phones also vibrate. A press counter keeps count.
- **Light:** Off, Static, Breathe, Rainbow, Spin (a chase around the halo) and Reactive, with any colour, brightness and speed.
- **Finish:** preset or custom colours for the shell, keycap and diffuser tint, a matte, satin, gloss or silk shell, and a PBT or ABS keycap.
- **Floor:** toggle a floor (Slate desk, Walnut, Felt mat or Glossy black, all dark so the light shows) with a soft shadow. It is hidden while the model is exploded. The diffuser's glow spills onto it, glossy floors reflect it, and shiny finishes pick up the coloured light.
- **Configure & export:** change the battery, keycap skirt height, collar height and opening, plate cutout, footprint and curve quality. The model rebuilds in a Web Worker in about half a second, runs the same fit checks as CI, and offers the resulting STLs for download. **Copy share link** encodes the build and look in the URL. **Copy params** gives the lines to paste into `src/params.mjs`.
- **Shortcuts:** <kbd>E</kbd> explode, <kbd>C</kbd> cut away, <kbd>F</kbd> floor, <kbd>R</kbd> auto-rotate, <kbd>1</kbd>–<kbd>4</kbd> camera views, <kbd>0</kbd> reset.

Settings and the press count are remembered in your browser.

Performance: the viewer only renders while something moves (orbiting, a tween, auto-rotate or an animated light effect), and stops when the page is hidden or scrolled off-screen. It lowers the pixel ratio if sustained animation runs slowly, and throttles hover hit-tests to one per frame against the keycap only. The geometry engine (~0.6 MB WASM) loads only when you first use the configurator. The fit checks skip pairs whose bounding boxes don't overlap, and they move the keycap through its travel instead of rebuilding the model, so a build plus checks now takes about 0.36 s instead of about 0.87 s (three model builds before, one now).

## Live preview (GitHub Pages)

`.github/workflows/pages.yml` rebuilds the model on every push to `main`. It fails if any parts collide, and otherwise publishes the preview with STL download links. To turn it on once, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Then re-run the **Pages** workflow from the Actions tab. ("Deploy from a branch" also works, because `index.html` is committed at the root, but that skips the fit checks.)

## Printing

| Part | Material | Orientation |
|---|---|---|
| `upper_housing.stl` | Opaque PLA/PETG | Upright, no supports |
| `diffuser.stl` | Natural PETG or "transparent" PLA, 100% infill, sanded or bead-blasted for frost | Upright, no supports |

Print a test first and tune `plateCut` (13.9–14.1) until the switch clips in firmly. The configurator can produce STLs for each tolerance step.

## PCB (22.4 × 22.4 × 1.6 mm)

Underside: Kailh hot-swap socket (standard MX hot-swap footprint), USB-C receptacle overhanging the south edge by 1.2 mm, 4 × 2020 addressable LEDs at `ledsBottom`, a USB-capable MCU (e.g. CH32X035 or CH552), a LiPo charger and LDO (or a boost converter for a primary coin cell, see below), and a JST-SH 2-pin connector. Keep underside parts ≤ 3.4 mm tall.

Top side: 4 × 2020 LEDs under the halo light pipes (±8.5, ±8.5) and an SK6812MINI-E reverse-mount in the MX LED window. Nothing else goes on top outside the switch footprint, because the upper housing clamps the board there.

Holes: 4.0 mm centre, 3.0 mm switch pins, 1.9 mm pegs, and 2.2 mm screw holes at (±9.6, −3.0).

Circuit: LiPo → charger/LDO → MCU and LEDs, always powered. Switch pins → GPIO (pull-up) and GND. USB-C handles charging and config.

## Coin cells

Set `battery` in `src/params.mjs` (or pick one in the configurator). The coin cradle is round and moves north just far enough to clear the screw posts. Every preset passes the fit checks.

| Preset | Cell | Size | Capacity | Height change |
|---|---|---|---|---|
| `lipo301020` (default) | 301020 LiPo pouch, 3.7 V, rechargeable | 3 × 10 × 20 mm | ≈40 mAh | none |
| `cp1254` | Varta CP1254 / LIR1254 Li-ion coin, 3.7 V, rechargeable | Ø12.1 × 5.4 mm | ≈50–60 mAh | +2.8 mm |
| `cr1632` | CR1632 lithium, 3 V, primary, tabbed | Ø16 × 3.2 mm | ≈130 mAh | +0.6 mm |
| `cr1620` | CR1620 lithium, 3 V, primary, tabbed | Ø16 × 2.0 mm | ≈75 mAh | −0.6 mm |

Coin heights include 0.4 mm for the welded solder tabs. The tabs carry leads to the same JST-SH plug, so swapping cells works the same way as with the pouch.

**Does it realistically work?** It depends on the chemistry.

- **Rechargeable Li-ion coin (CP1254 / LIR1254): yes, as a drop-in.** It has the same voltage as the LiPo and uses the same charger. Set the charge current to about 25–30 mA (0.5 C). Capacity and runtime are about the same as the pouch, roughly an hour or two of continuous light. It's mainly worth it for availability or a sturdier can, and it makes the fidget 2.8 mm taller.
- **Primary lithium coin (CR1632 / CR1620): only with circuit changes, and only for flash-on-press use.**
  - *Voltage:* a CR cell is 3.0 V nominal and lower under load. The SK6812/WS2812 LEDs want about 3.5–3.7 V, so you need a small boost converter (a TPS61099-class part with µA quiescent current).
  - *Current:* these cells are rated for a few mA continuous. At the 20–40 mA a few lit LEDs draw, the internal resistance (tens of ohms) collapses the voltage and the usable capacity drops sharply. Add a 100–220 µF reservoir capacitor and keep brightness low.
  - *Idle drain:* each addressable LED draws about 0.5–1 mA even when dark. That's 9 LEDs × ~1 mA, which would empty a CR1632 in under a day. Put the LED rail behind a load switch and let the MCU sleep (wake on the key's GPIO).
  - *Charging:* never charge a primary cell. Leave the charger off the board. USB-C can still power the board for configuration through a diode or power-path switch.
  - *What you get:* in Reactive mode (a short, dim flash per press) a CR1632 lasts on the order of 10⁴ presses. Continuous effects run for hours at best.
- **CR2032 / LIR2032 (20 mm): doesn't fit this enclosure.** A 20 mm cell needs about 12.6 mm of clearance from the centre to clear an M2 screw post. The posts sit 10.1 mm from the centre, and the 27 mm body has no room to move the cell north far enough. It would need the screws moved to the corners, which is where the halo light pipes are, or a footprint of about 32 mm. A LIR2032 holds about 40 mAh anyway, no more than the pouch.

## Assumptions to verify

- Keycap skirt sits ~6 mm above the plate at rest (`keycapBottomAbovePlate`). Measure your keycap and set `collarAbovePlate` about 1 mm higher.
- The hot-swap socket footprint is approximated from the Kailh datasheet outline.
