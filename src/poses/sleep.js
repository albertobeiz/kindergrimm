// SLEEP — slumped where it sat, breath slow and deep, everything else
// off. The pose brings its own face ('sleeping': eyes shut, mouth
// slack); a quad folds its legs into the sphinx via the 'fold'
// texture state and sinks onto the floor.
export const Sleep = {
  id: 'sleep', label: 'dormir',
  auto: { sway: 0, gaze: 0, blink: 0, tail: 0, arms: 0, breath: 2.2 },
  face: 'sleeping',
  update(ctx) {
    const { B, S, base } = ctx;
    const rock = Math.sin(ctx.t * .8) * .012;      // the sleeper's slow sway
    if (base === 'quad') {
      ctx.state('quadlegs', 'fold');
      ctx.root(0, -B.legLen * .62, 0);
      ctx.head(0, -S * .1, -B.dir * .08 + rock);
    } else if (base === 'sit') {
      ctx.root(0, -S * .04, 0);
      ctx.body(.04, -.05);
      ctx.head(0, -S * .12, .1 + rock);
    } else {
      ctx.root(0, -(B.floorY - B.hipY) * .78, 0);
      ctx.each('legs', e => ctx.bone(e, { rot: e.side * 1.2, dy: S * .02 }));
      ctx.each('arms', e => ctx.bone(e, { rot: e.side * .35 }));
      ctx.body(.03, -.06);
      ctx.head(0, -S * .16, .14 + rock);
    }
  },
};
