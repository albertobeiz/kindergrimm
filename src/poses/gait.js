// WALK & RUN — one factory, two tempos, three skeletons.
//
// The bounce is the gait: two footfalls per stride, the body highest
// mid-swing. What the legs do depends on the base —
//   biped: the drawn legs scissor-lift in counterphase, arms against
//   quad:  a flip-book trot — the legs part swaps its stepA/stepB
//          textures in rhythm (diagonal pairs, like a real trot)
//   sit:   no legs to speak of, so the blob travels in squashy hops
// Both poses read the SAME shared gait phase; crossfading walk→run
// changes tempo and amplitude without ever teleporting a foot.
function gaitPose(id, label, o) {
  return {
    id, label,
    gaitHz: o.hz,
    auto: { sway: 0, gaze: o.gaze, breath: .5, arms: 0, tail: o.tail },
    update(ctx) {
      const { B, S, base } = ctx;
      const ph = ctx.gait;
      const bounce = Math.abs(Math.sin(ph)) * S * o.bounce;
      ctx.root(0, bounce, Math.sin(ph) * o.rock);
      ctx.head(0, Math.sin(ph * 2 - .9) * S * .01 * o.amp, 0);   // the head lags a beat

      if (base === 'quad') {
        ctx.state('quadlegs', Math.sin(ph) > 0 ? 'stepA' : 'stepB');
        ctx.body(0, Math.sin(ph * 2) * .015 * o.amp);
      } else if (base === 'sit') {
        const sq = Math.max(0, -Math.sin(ph)) * .07 * o.amp;
        ctx.body(sq, -sq);
      } else {
        ctx.each('legs', e => {
          const swing = Math.sin(ph + (e.side > 0 ? 0 : Math.PI));
          ctx.bone(e, { dy: Math.max(0, swing) * S * o.step, rot: swing * o.legRot });
        });
        ctx.each('arms', e =>
          ctx.bone(e, { rot: Math.sin(ph + (e.side > 0 ? Math.PI : 0)) * o.armRot }));
      }
    },
  };
}

export const Walk = gaitPose('walk', 'walk', {
  hz: 1.6, bounce: .03, rock: .018, step: .06, legRot: .28, armRot: .3,
  gaze: .5, tail: 1.4, amp: 1,
});
export const Run = gaitPose('run', 'run', {
  hz: 2.7, bounce: .06, rock: .03, step: .11, legRot: .5, armRot: .6,
  gaze: .15, tail: 2, amp: 1.7,
});
