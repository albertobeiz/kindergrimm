// SIT — three skeletons, three ways down.
//   biped: drops onto the floor, legs splayed out in front, the
//          classic big-headed doodle flop
//   quad:  onto the haunches — the whole animal tips back over its
//          hind paws and the head stays level, looking up a little
//   sit:   was born sitting; it just settles a touch lower
export const Sit = {
  id: 'sit', label: 'sitting',
  auto: { sway: .6, tail: .6, arms: .4 },
  update(ctx) {
    const { B, S, base } = ctx;
    if (base === 'quad') {
      ctx.root(0, -B.legLen * .55, -B.dir * .16);
      ctx.head(0, S * .03, B.dir * .1);
    } else if (base === 'sit') {
      ctx.root(0, -S * .025, 0);
      ctx.body(.03, -.03);
    } else {
      ctx.root(0, -(B.floorY - B.hipY) * .72, 0);
      ctx.each('legs', e => ctx.bone(e, { rot: e.side * 1.15, dy: S * .02 }));
      ctx.each('arms', e => ctx.bone(e, { rot: e.side * .18 }));
      ctx.head(0, -S * .025, .04);
    }
  },
};
