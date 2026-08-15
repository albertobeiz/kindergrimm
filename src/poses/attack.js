// ATTACK — the one-shot: anticipation, lunge, recover. A cartoon hit
// is three unequal beats — a slow coil, a fast strike, and a springy
// settle with overshoot — and then the pose hands back to whatever
// was underneath (the animator does that; this file just plays out
// its .9 seconds).
const ease = k => k * k * (3 - 2 * k);

export const Attack = {
  id: 'attack', label: 'atacar',
  oneShot: true, dur: .9,
  auto: { sway: 0, gaze: 0, breath: 0, arms: 0 },
  update(ctx) {
    const { B, S, base } = ctx;
    const u = Math.min(1, ctx.time / this.dur);
    // which way the strike goes: a quad lunges away from its tail,
    // a biped toward wherever its head is turned
    const dir = base === 'quad' ? -B.dir : (ctx.F.ts || 1);

    let dx, dy, rot, squash, arm;
    if (u < .38) {              // anticipation: coil back and down
      const k = ease(u / .38);
      dx = -dir * S * .07 * k; dy = -S * .05 * k; rot = -dir * .06 * k;
      squash = .1 * k; arm = -.3 * k;
    } else if (u < .58) {       // the lunge
      const k = ease((u - .38) / .2);
      dx = -dir * S * .07 + dir * S * .24 * k;
      dy = -S * .05 + S * .1 * k;
      rot = -dir * .06 + dir * .2 * k;
      squash = .1 - .24 * k; arm = -.3 + 1.4 * k;
    } else {                    // recover: spring home, overshoot, settle
      const k = (u - .58) / .42;
      const spring = Math.exp(-4.5 * k) * Math.cos(k * Math.PI * 2.2);
      dx = dir * S * .17 * spring; dy = S * .05 * spring; rot = dir * .14 * spring;
      squash = -.14 * spring; arm = 1.1 * spring;
    }

    ctx.root(dx, dy, rot);
    ctx.body(squash, -squash);
    ctx.head(dir * S * .02 * (u < .58 ? u / .58 : 1), 0, dir * .05);
    if (base === 'biped') ctx.each('arms', e => ctx.bone(e, { rot: e.side * arm }));
    if (u > .34 && u < .7) ctx.state('mouth', 'open');   // the roar
  },
};
