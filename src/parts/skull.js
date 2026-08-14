// The skull: paper cutout of the face polygon, colored in by hand if
// the casting says so, contour drawn broken with ghosts, then shaded.
// Construction scaffold sometimes left visible behind it.
import { circlePts, chaikin } from '../sketch.js';
import { U } from '../part.js';

export const Skull = {
  id: 'skull', label: 'cráneo', order: 1, depth: 0,
  gen: rng => {
    // a doodle head is drawn front-on in one go — it barely turns
    const facing = rng.pick(['straight', 'straight', 'straight', 'straight', 'mild']);
    const turn = facing === 'straight' ? rng.r(-.1, .1)
      : rng.r(.28, .5) * (rng.chance(.5) ? 1 : -1);
    return {
      s: .5 * rng.r(1.08, 1.34),                 // all head, no face
      wf: rng.r(.74, .98),
      turn,
      // non-round shapes need a near-full slide onto the target or the
      // brick just reads as another ball
      round: rng.r(.82, .97),
      // the shape family is the doodle's identity
      shape: rng.pick(['round', 'round', 'square', 'square', 'tall', 'tall',
                       'drop', 'drop', 'pear', 'pear', 'lump', 'wide']),
      fur: rng.chance(.22),
      jaw: rng.r(.9, 1.15),
      chinW: rng.r(.9, 1.3),
      skullY: rng.r(.88, 1.02),
      chinY: rng.r(.7, .84),
      press: rng.r(1.0, 1.6),
      shade: rng.pick(['none', 'none', 'none', 'scrib', 'hatch']),
      hollows: rng.chance(.05),
      construction: rng.chance(.1),
      darkSkin: rng.chance(.2),
      plain: rng.chance(.12),
      skinOn: rng.chance(.6), skinIdx: rng.ri(0, 7), skinScrib: rng.chance(.4),
    };
  },
  meta: () => ({
    s: { label: 'escala', range: [.32, .66] },
    wf: { label: 'ancho', range: [.48, 1.0] },
    turn: { label: 'giro ¾', range: [-.9, .9] },
    round: { label: 'redondez', range: [0, 1] },
    shape: { label: 'forma', pick: ['round', 'square', 'tall', 'drop', 'pear', 'lump', 'wide'] },
    fur: { label: 'peludo', bool: true },
    jaw: { label: 'mandíbula', range: [.55, 1.2] },
    chinW: { label: 'mentón', range: [.3, 1.3] },
    skullY: { label: 'frente', range: [.7, 1.0] },
    chinY: { label: 'barbilla', range: [.65, .95] },
    press: { label: 'presión', range: [.7, 1.6] },
    shade: { label: 'sombra', pick: ['none', 'hatch', 'scrib', 'cross', 'stipple', 'smudge'] },
    hollows: { label: 'demacrado', bool: true },
    construction: { label: 'construcción', bool: true },
    darkSkin: { label: 'piel oscura', bool: true },
    plain: { label: 'solo grafito', bool: true },
    skinOn: { label: 'piel color', bool: true },
    skinIdx: { label: 'tono piel', range: [0, 7], step: 1 },
    skinScrib: { label: 'piel garabato', bool: true },
  }),
  bones: () => [{ name: 'skull', x: 0, y: 0 }],
  size: (P, F) => [(F.w * 2.9) / U, (F.s * 3.0) / U],
  draw(s, P, st, F) {
    const S = F.s, w = F.w, turn = F.turn;
    const { facePoly, outlineOpen, shadowSide } = F.L;

    // construction scaffold, sometimes left in
    if (P.construction) {
      s.sline(circlePts(0, -S * .1, w * 1.04, S * .9, 26), 1, .09);
      s.sline([[turn * w * .2, -S * 1.02], [turn * w * .14, S * .95]], 1, .07);
      s.sline([[-w * 1.1, 0], [w * 1.1, 0]], 1, .07);
    }

    s.paperFill(facePoly);
    if (F.colors.skin) {
      // colored in by hand — never quite on the drawing, whatever the medium
      const dx = s.jr(-.035, .035) * S, dy = s.jr(-.03, .03) * S, sc = s.jr(.95, 1.03);
      const skinPoly = facePoly.map(q => [q[0] * sc + dx, q[1] * sc + dy]);
      F.media.skin(s, skinPoly, F.colors.skin, { scrib: P.skinScrib, gap: S * s.jr(.035, .05) });
    }
    if (P.fur) {
      // a shaggy creature: light base line, then fur ticks flicking
      // outward all round the silhouette
      F.media.edge(s, outlineOpen, F.lwMain * .55, { over: S * .02, taper: .12 });
      for (let i = 2; i < facePoly.length - 1; i += 2) {
        const a = facePoly[i - 1], b = facePoly[i + 1], p = facePoly[i];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
        // normals of a clockwise poly point outward here; flip if not
        const len = S * s.jr(.035, .095) * (s.chance(.15) ? 1.8 : 1);
        const sway = s.jr(-.5, .5);
        s.stroke([[p[0], p[1]],
          [p[0] + (nx + sway * -ny) * len, p[1] + (ny + sway * nx) * len]],
          F.lwThin * s.jr(.7, 1.1), { taper: .45, alpha: s.jr(.55, .9) });
      }
    } else {
      F.media.edge(s, outlineOpen, F.lwMain, { over: S * .035, taper: .12 });
    }
    if (P.darkSkin && !F.colors.skin && F.media.underdraw) s.hatchFill(facePoly, S * .08, -1.05, .08, 1);

    // the shadow side of the face — pencil work, so oil paint skips it
    if (!F.media.underdraw) { /* the paint itself carries the value */ }
    else if (P.shade === 'hatch') {
      s.hatch(shadowSide * w * .6, S * .32, S * .3, S * .2, -1.05 * shadowSide, s.ri(4, 7), .19);
    } else if (P.shade === 'scrib') {
      // shadow scrubbed in with a fast tight scribble
      s.ctx.save(); s.poly(facePoly, true); s.ctx.clip();
      const patch = s.blobPts(shadowSide * w * s.jr(.35, .6), S * s.jr(.12, .42), w * s.jr(.2, .32), S * s.jr(.12, .2));
      s.scribbleFill(patch, S * s.jr(.026, .04), .42);
      if (s.chance(.5)) {
        const p2 = s.blobPts(shadowSide * w * s.jr(.4, .7), -S * s.jr(.05, .25), w * s.jr(.1, .2), S * s.jr(.06, .12));
        s.scribbleFill(p2, S * .03, .3);
      }
      s.ctx.restore();
    } else if (P.shade === 'cross') {
      s.hatch(shadowSide * w * .6, S * .32, S * .26, S * .18, -1.05 * shadowSide, s.ri(4, 6), .17);
      s.hatch(shadowSide * w * .6, S * .32, S * .26, S * .18, -1.05 * shadowSide + 1.2, s.ri(3, 5), .14);
    } else if (P.shade === 'stipple') {
      s.ctx.save(); s.poly(facePoly, true); s.ctx.clip();
      for (let i = 0; i < 46; i++) {
        const x = shadowSide * w * s.jr(.35, .85), y = S * s.jr(.0, .6);
        s.ctx.fillStyle = s.inkA(s.jr(.18, .45));
        s.ctx.fillRect(x, y, s.jr(.8, 1.6), s.jr(.8, 1.6));
      }
      s.ctx.restore();
    } else if (P.shade === 'smudge') {
      s.ctx.save(); s.poly(facePoly, true); s.ctx.clip();
      for (let k = 0; k < 3; k++) {
        s.poly(s.blobPts(shadowSide * w * s.jr(.4, .65), S * s.jr(.1, .45), w * s.jr(.2, .38), S * s.jr(.12, .3)), true);
        s.ctx.fillStyle = s.inkA(.07); s.ctx.fill();
      }
      s.ctx.restore();
    }

    // gaunt: the cheekbone throws a hollow under it, temples dent in
    if (P.hollows && F.media.underdraw) {
      s.ctx.save(); s.poly(facePoly, true); s.ctx.clip();
      for (const sd of [-1, 1]) {
        const near = sd === F.ts;
        const cheek = s.blobPts(sd * w * (near ? .58 : .44), S * .3, w * .2, S * .17);
        s.hatchFill(cheek, S * .034, -1.0 * sd, .3, 1.1);
        if (s.chance(.6)) s.hatchFill(cheek, S * .05, .8 * sd, .16, 1);
        // the bone above the hollow catches the light: a paper edge
        s.sline([[sd * w * .34, S * .16], [sd * w * .74, S * .1]], 1.3, 0, s.paperA(.5));
        s.sline([[sd * w * .36, S * .2], [sd * w * .72, S * .14]], 1.2, .28);
        // temple
        s.hatchFill(s.blobPts(sd * w * .72, -S * .3, w * .12, S * .14), S * .04, -.9 * sd, .2, 1);
      }
      s.ctx.restore();
    }

    // bangs cast a shadow on the forehead
    if (F.P.hair.bang && F.P.hair.bang !== 'none' && F.media.underdraw) {
      if (s.chance(.5)) s.hatch(turn * w * .15, -S * .32, w * 1.0, S * .08, .06, 3, .08);
      else {
        s.ctx.save(); s.poly(facePoly, true); s.ctx.clip();
        s.scribbleFill(s.blobPts(turn * w * .15, -S * .34, w * .55, S * .06), S * .03, .16);
        s.ctx.restore();
      }
    }

  },
};

export const Ears = {
  id: 'ears', label: 'orejas', order: 2, depth: .2,
  gen: rng => ({ rings: rng.chance(.3), nRings: rng.ri(1, 3) }),
  meta: () => ({ rings: { label: 'pendientes', bool: true } }),
  // ears show only with hair that leaves them uncovered
  skip: (P, F) => !['bald', 'buzz', 'slick', 'spiky', 'ponytail', 'buns', 'bowl',
                    'mohawk', 'cowlick', 'topknot'].includes(F.P.hair.style),
  bones: (P, F) => {
    const sides = F.at > .3 ? [-F.ts] : [-1, 1];   // turned heads show the far ear
    return sides.map(sd => ({ name: 'ear' + (sd < 0 ? 'L' : 'R'), x: sd * F.w * 1.02 / U, y: -F.s * .1 / U, side: sd }));
  },
  size: (P, F) => [(F.w * .6) / U, (F.s * .6) / U],
  draw(s, P, st, F, bone) {
    const sd = bone.side, S = F.s, w = F.w;
    const ep = chaikin([[sd * w * .95, -.02 * S], [sd * w * 1.12, .02 * S], [sd * w * 1.1, .16 * S], [sd * w * .93, .2 * S]], false, 1);
    s.paperFill([...ep, [sd * w * .93, .02 * S]]);
    if (F.colors.skin) {
      s.poly([...ep, [sd * w * .93, .02 * S]], true);
      s.ctx.fillStyle = s.colA(F.colors.skin, .45); s.ctx.fill();
    }
    s.sline(ep, F.lwThin * 1.1, .8);
    s.sline([[sd * w * 1.0, .06 * S], [sd * w * 1.04, .12 * S]], 1, .35);
    if (P.rings)
      for (let k = 0; k < P.nRings; k++)
        s.sline(circlePts(sd * w * 1.05, S * (.19 + .05 * k), S * .014, S * .016, 8), 1.1, .6);
  },
};
