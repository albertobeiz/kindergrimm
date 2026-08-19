// --------------------------------------------------------------
// THE LAYOUT — everything two parts must agree on, measured once.
//
// Coordinates: world units, y up, +z toward the viewer, origin at
// the FLOOR where the plant stands. Same as the voxel and gloss
// labs: a solid wants measuring from the ground it grows from.
//
// The whole plant is ONE hierarchy of anchors, and the trick is
// the same as the muzzle: parts never reach into each other's
// params, they read the anchor. The mound owns the SOIL; the stem
// owns the TRUNK; everything else sits on what those two publish.
//
//   M — the mound: { r, top } how wide the soil is and how high
//       its crown sits above the floor.
//   rootY  — the soil surface. Blades, rosettes, stems root here.
//   crownY — the top of the stem, where a bloom perches and a
//        tree's crown starts. If the species carries no stem
//        (grass), the crown sits ON the soil.
//   L — the ONE leaf size the whole plant shares, so the canopy
//        and the sprig agree how big a leaf is without meeting.
// --------------------------------------------------------------

export function buildPlantLayout(P, C) {
  // the mound owns the soil
  const m = P.mound ?? {};
  const M = { r: m.r ?? .8, top: m.tall ?? .7 };
  // the stem owns the trunk
  const st = P.stem ?? {};
  const noStem = st.style === 'none';
  const s = {
    h: noStem ? 0 : (st.h ?? 1),
    r: st.r ?? .4,
  };
  const lf = P.leaves ?? {};
  return {
    M,
    rootY: M.top * .92,                  // blades/stems sink in a hair
    crownY: M.top + s.h,                  // crown sits on the stem (or soil)
    stem: s,
    leaf: { size: lf.size ?? 1, wide: (lf.size ?? 1) * .5 },
    C,                                     // resolved palette roles
  };
}