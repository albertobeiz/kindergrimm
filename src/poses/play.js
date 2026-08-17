// PLAY — the whole body having a nice time.
//
// Louder than idle on purpose: playing is the thing that earns you
// the game, so it has to be legible from across a dark room at a
// small size. A fast two-beat hop, arms pumping out of phase, and a
// head that lags behind the bounce — the reason it reads as playing
// rather than jogging on the spot is that nothing is symmetrical and
// nothing lands on the beat.
export const Play = {
  id: 'play', label: 'play',
  auto: { sway: .3, breath: .5, gaze: .5, arms: 0 },
  update(ctx) {
    const { S, base } = ctx;
    const t = ctx.t * 6.2;
    const hop = Math.abs(Math.sin(t));            // two bounces a cycle
    const lean = Math.sin(t * .5) * .06;

    ctx.root(Math.sin(t * .5) * S * .012, hop * S * .055, lean);
    ctx.head(0, Math.sin(t + 2.1) * S * .018, Math.sin(t * .33) * .1);

    if (base === 'quad') {
      ctx.state('quadlegs', Math.sin(t) > 0 ? 'stepA' : 'stepB');
      ctx.body(hop * .05, -hop * .05);
      return;
    }
    if (base === 'sit') {
      ctx.body(hop * .07, -hop * .07);
      return;
    }
    // biped: arms up and out of phase, feet skipping under it
    ctx.each('arms', e => {
      const ph = e.side > 0 ? 0 : 2.3;            // never the same on both sides
      ctx.bone(e, { rot: -e.side * (.55 + Math.sin(t + ph) * .5), dy: -S * .01 });
    });
    ctx.each('legs', e => {
      const ph = e.side > 0 ? 0 : Math.PI;
      ctx.bone(e, { dy: Math.max(0, Math.sin(t + ph)) * S * .045, rot: Math.sin(t + ph) * .18 });
    });
  },
};
