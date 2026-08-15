// ---------------------------------------------------------------
// EXPRESSIONS — what the FACE is doing, independent of the pose.
// An angry walker and a scared sitter are both one line of code.
//
// An expression is two things:
//   states:  which pre-drawn texture each face part swaps to. A
//            texture swap is binary, so the animator lands it while
//            a blink has the eyes shut — the face changes between
//            two frames of a blink and reads as intentional.
//   update:  the continuous body language (brows pressed down, the
//            shiver, the sob) — written through the same offset API
//            as poses and riding a crossfade weight, which is where
//            the smoothness comes from: the body leads, the blink
//            lands, the texture snaps underneath it.
// `auto` multipliers scale the autonomic life exactly like a pose's.
//
// TO ADD AN EXPRESSION: add an entry here. If it needs a face nobody
// can draw yet, add that as a STATE of the eye/brow/mouth part first
// (one branch in its draw()), then point at it from `states`.
// ---------------------------------------------------------------
export const EXPRESSIONS = {
  idle: { label: 'normal', states: {} },

  angry: {
    label: 'enfadado',
    states: { eyes: 'angry', brows: 'angry', mouth: 'angry' },
    auto: { gaze: .3 },
    update(ctx) {
      const S = ctx.S;
      ctx.head(0, -S * .015, 0);                       // chin down, glowering
      ctx.each('brows', e => ctx.bone(e, { dy: -S * .045 }));
      ctx.body(.02, 0);                                // shoulders squared
    },
  },

  scared: {
    label: 'asustado',
    states: { eyes: 'scared', brows: 'raised', mouth: 'scared' },
    auto: { gaze: 0, sway: 0 },
    update(ctx) {
      const S = ctx.S;
      const sh = Math.sin(ctx.t * 26) * S * .008;      // the shiver
      ctx.head(sh, S * .012, Math.sin(ctx.t * 23) * .012);
      ctx.each('brows', e => ctx.bone(e, { dy: S * .05 }));
      ctx.root(0, S * .012, 0);                        // up on its toes
    },
  },

  crying: {
    label: 'llorando',
    states: { eyes: 'cry', brows: 'sad', mouth: 'cry', tearsWet: 'flow' },
    auto: { gaze: 0 },
    update(ctx) {
      const S = ctx.S;
      const sob = Math.abs(Math.sin(ctx.t * 3.6));     // the heaving chest
      ctx.head(0, -S * .04 - sob * S * .02, .06);
      ctx.body(0, sob * .02);
      ctx.each('brows', e => ctx.bone(e, { dy: S * .03 }));
    },
  },

  sleeping: {
    label: 'dormido',
    states: { eyes: 'closed', mouth: 'sleep', brows: 'sad' },
    auto: { gaze: 0, blink: 0, sway: .3, breath: 1.6 },
    update(ctx) { ctx.head(0, -ctx.S * .05, .05); },
  },
};
