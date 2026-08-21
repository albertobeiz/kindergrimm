// ---------------------------------------------------------------
// THE BOOSTERS — what a level-up gives you.
//
// The rule they all obey: a booster changes a NUMBER THAT WAS ALREADY
// VISIBLE. More slide means every marble visibly runs further; more
// weight means the carom you have been failing to make starts landing.
// Nothing here grants a new verb, because the game has exactly two
// (throw, and hit your own marble) and a run that ends with more verbs
// than it started with is a different game by the end of it.
//
// AND THERE IS NO EXCEPTION ANY MORE. The three unlocks used to sit in
// this table; they are `RECRUITS` at the bottom of the file now and a
// BOSS deals them. A level-up is an improvement and nothing else.
//
// A card is offered at most once when `once`, otherwise for ever with
// falling odds — a stack of the same card is a legitimate build, but a
// draft that keeps offering it when you have five is a draft that has
// stopped making a choice.
// ---------------------------------------------------------------

// TWO KINDS OF MODS NOW. A card is aimed at ONE marble type — "+22%
// damage" is a card about your Embers, not about your army — so every
// kind carries its own mods object and an ability reads its owner's
// (`m.mods`), never a global. What stays global is what has no owner:
// the hand, the recharge, the throw arm, the chain, the line.
export function newMods() {
  return {
    refill: 1,       // hand recharge speed
    hand: 3,         // how many marbles you hold
    chain: 0,        // extra burst multiplier per chain step
    power: 1,        // throw speed
    deathBurst: 0,   // a melting marble fires its burst on the way out
  };
}

export function newKindMods() {
  return {
    dmg: 1,          // this kind's ability damage
    burst: 1,        // its burst damage
    impact: 1,       // what its body blows do to brutes and bosses
    chill: 1,        // how hard its slows bite
    hops: 0,         // extra lightning hops (Bolt)
    slide: 0,        // friction reduction, 0..1
    mass: 0,         // extra weight, as a fraction
    plow: 0,         // speed KEPT per body ploughed, as a fraction
    time: 0,         // extra seconds on the ice, as a fraction
    timeFlat: 0,     // …and as flat seconds
  };
}

const R = { plain: '#8A8172', fine: '#3D77A6', gilded: '#D8A33C' };

// THE NUMBERS ARE SMALL ON PURPOSE — five percent, not twenty-five. A
// run takes a dozen drafts, and a card that moves a stat by a quarter
// makes the third copy of itself the whole build: at five percent a
// build is an ACCUMULATION of choices instead of two lucky ones, and a
// repeat is always still worth taking (the step-down below is gentle
// for the same reason).
//
// `scope: 'kind'` cards are dealt WITH a target kind attached (see
// `dealBoosters`); their `apply` receives that kind's mods. Global
// cards receive the global mods.
export const BOOSTERS = [
  // --- plain: the bread of a run ---------------------------------------
  { id: 'dmg', rank: 'plain', w: 22, scope: 'kind', label: 'sharper',
    text: '+5% damage',
    apply: m => { m.dmg *= 1.05; } },
  { id: 'plow', rank: 'plain', w: 16, scope: 'kind', label: 'heavier roll',
    text: 'keeps 5% more speed per body ploughed',
    apply: m => { m.plow = Math.min(.6, m.plow + .05); } },
  { id: 'slide', rank: 'plain', w: 16, scope: 'kind', label: 'polished',
    text: '−5% friction — runs further',
    apply: m => { m.slide = Math.min(.5, m.slide + .05); } },
  { id: 'time', rank: 'plain', w: 16, scope: 'kind', label: 'slow to melt',
    text: '+5% time on the ice',
    apply: m => { m.time += .05; } },
  { id: 'refill', rank: 'plain', w: 14, label: 'quick hands',
    text: '+5% faster recharge',
    apply: m => { m.refill *= 1.05; } },
  { id: 'mass', rank: 'plain', w: 13, scope: 'kind', label: 'denser',
    text: '+5% weight — hits harder, moved less',
    apply: m => { m.mass += .05; } },

  // --- fine: the shape of a build --------------------------------------
  { id: 'burst', rank: 'fine', w: 13, scope: 'kind', label: 'hair trigger',
    text: '+8% burst damage',
    apply: m => { m.burst *= 1.08; } },
  { id: 'impact', rank: 'fine', w: 11, scope: 'kind', label: 'breaker',
    text: '+10% smash damage to the big ones',
    apply: m => { m.impact *= 1.1; } },
  { id: 'timeFlat', rank: 'fine', w: 11, scope: 'kind', label: 'thick ice',
    text: '+2 seconds on the ice, flat',
    apply: m => { m.timeFlat += 2; } },
  { id: 'chill', rank: 'fine', w: 9, scope: 'kind', label: 'deep cold',
    text: 'slows bite 8% harder',
    apply: m => { m.chill *= 1.08; } },
  { id: 'power', rank: 'fine', w: 8, label: 'strong arm',
    text: '+4% throw speed',
    apply: m => { m.power *= 1.04; } },
  { id: 'hops', rank: 'fine', w: 9, scope: 'kind', kind: 'bolt',
    label: 'forked', text: 'lightning hops one more time',
    needs: 'unlock:bolt',
    apply: m => { m.hops += 1; } },

  // --- gilded: the run-defining ones ------------------------------------
  { id: 'hand', rank: 'gilded', w: 6, once: true, label: 'a bigger pocket',
    text: 'hold FOUR marbles instead of three',
    apply: m => { m.hand = 4; } },
  { id: 'chain', rank: 'gilded', w: 6, label: 'cascade',
    text: 'every chain step adds +8% more',
    apply: m => { m.chain += .08; } },
  { id: 'deathBurst', rank: 'gilded', w: 6, once: true, label: 'last word',
    text: 'every melting marble fires its burst as it goes',
    apply: m => { m.deathBurst = 1; } },
  { id: 'life', rank: 'gilded', w: 5, label: 'one more chance',
    text: '+4 to the line you are holding',
    apply: () => {} },
];

// ---------------------------------------------------------------
// THE RECRUITS — the roster, and it is paid out by BOSSES, not levels.
//
// EVERY CARD IN `BOOSTERS` IS NOW AN IMPROVEMENT: it makes a number
// you already have bigger. A new marble is not that — it changes what
// is IN your hand rather than what your hand does — and dealt into the
// same three-card draft it had to compete with "+5% damage" on a
// level-up that had nothing to do with it. Worse, it was a gamble: a
// run could reach its end without ever being offered Boulder.
//
// A boss pays in marbles now. Three bosses, three marbles, and the
// roster is complete by the fourth wave whatever the dice say — so
// the unlock stops being luck and starts being the reward for the one
// fight the game builds up to.
//
// They keep their `unlock:` ids because `needs:` above still reads
// them out of `taken`, and `takeBooster` still applies them: this is a
// different DEAL, not a different kind of card.
// ---------------------------------------------------------------
// The `label` is the card's small second line and the NAME comes from
// the kind (see `showDraft`), so it must not repeat it: "BOLT · BOLT
// joins" is what naming them "BOLT joins" produced. One word about the
// hand it wants to be thrown by is the useful thing to say there.
export const RECRUITS = [
  { id: 'unlock:bolt', rank: 'gilded', once: true, label: 'the fast one',
    text: 'chains lightning · slides for ever · hooks right, hard',
    unlock: 'bolt', apply: () => {} },
  { id: 'unlock:boulder', rank: 'gilded', once: true, label: 'the heavy one',
    text: 'stops where you put it · nothing moves it · breaks brutes',
    unlock: 'boulder', apply: () => {} },
  { id: 'unlock:goo', rank: 'gilded', once: true, label: 'the slow one',
    text: 'lays tar · the tide crawls through it · hooks left, hard',
    unlock: 'goo', apply: () => {} },
];

/** every kind still out of the bag, as cards. All of them are offered:
 *  this is a ROSTER being handed over, not another gamble, and the
 *  choice is which marble you want NEXT rather than whether you get
 *  one at all. */
export function dealRecruits(bag) {
  return RECRUITS.filter(r => !(bag[r.unlock] > 0)).map(r => ({ ...r, takenKey: r.id }));
}

export const RANK_COLOR = R;

/**
 * deal three. Weighted by rank, no repeats within one draft, and a
 * `once` card that has already been taken is out of the deck for good.
 *
 * The odds tilt toward gilded as the run goes on — not because a
 * player deserves it, but because the plain cards stop being able to
 * change anything once the tide is deep enough, and a draft that
 * cannot change anything is a pause with buttons on it.
 */
/**
 * deal three. A `scope: 'kind'` card arrives with a target attached —
 * one of the kinds currently in the bag — and its `takenKey` tracks
 * that pair, so "+25% damage / EMBER" and "+25% damage / FROST" are
 * different cards to the step-back weighting and to `once`.
 *
 * The odds tilt toward gilded as the run goes on — not because a
 * player deserves it, but because the plain cards stop being able to
 * change anything once the tide is deep enough.
 */
export function dealBoosters(taken, level, rnd = Math.random, n = 3, kinds = []) {
  const gild = Math.min(2.6, 1 + level * .13);
  const pool = BOOSTERS.filter(b =>
    !(b.once && taken[b.id]) && (!b.needs || taken[b.needs])
    && !(b.scope === 'kind' && !b.kind && kinds.length === 0));
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    let total = 0;
    const wOf = b => {
      let w = b.w;
      if (b.rank === 'gilded') w *= gild;
      if (b.rank === 'fine') w *= Math.min(1.6, .7 + level * .09);
      const have = taken[b.id] || 0;
      if (have) w *= Math.pow(.8, have);
      return w;
    };
    for (const b of pool) total += wOf(b);
    let x = rnd() * total, pick = pool[0];
    for (const b of pool) if ((x -= wOf(b)) < 0) { pick = b; break; }
    pool.splice(pool.indexOf(pick), 1);
    if (pick.scope === 'kind') {
      const kind = pick.kind ?? kinds[(rnd() * kinds.length) | 0];
      out.push({ ...pick, kind, takenKey: `${pick.id}:${kind}` });
    } else {
      out.push({ ...pick, takenKey: pick.id });
    }
  }
  return out;
}
