/**
 * A diff bounded by work (diffWorkLimit) instead of time: the same inputs
 * give the same diff whatever the clock says, it is a valid diff when the
 * budget runs out, and with enough budget it is the diff a generous time
 * limit gives.
 */

import { DiffMatchPatch, DiffWorkBudget } from "../../src";

// A small deterministic random generator (mulberry32).
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function text(random: () => number, n: number, alphabet: string): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s += alphabet[Math.floor(random() * alphabet.length)];
  }
  return s;
}

function edit(random: () => number, s: string, alphabet: string): string {
  for (let e = Math.floor(random() * 30); e >= 0; e--) {
    const at = Math.floor(random() * (s.length + 1));
    s =
      s.slice(0, at) +
      text(random, Math.floor(random() * 12), alphabet) +
      s.slice(at + Math.floor(random() * 12));
  }
  return s;
}

// Pairs of texts: edited copies, and unrelated texts (the bisection's worst
// case), in a small and a large alphabet, with and without lines.
function corpus(count: number, seed = 20_10_2026): [string, string][] {
  const random = rng(seed);
  const alphabets = ["ab", "abcd \n", "abcdefghijklmnopqrstuvwxyz ,.\n"];
  const pairs: [string, string][] = [];
  for (let i = 0; i < count; i++) {
    const alphabet = alphabets[i % alphabets.length];
    const a = text(random, Math.floor(random() * 3000), alphabet);
    pairs.push([
      a,
      i % 5 === 0
        ? text(random, Math.floor(random() * 3000), alphabet)
        : edit(random, a, alphabet),
    ]);
  }
  return pairs;
}

function patchText(dmp: DiffMatchPatch, a: string, b: string): string {
  return dmp.patch_toText(dmp.patch_make(a, b));
}

// Run f with a clock that jumps a minute on every reading.
function withRacingClock<T>(f: () => T): T {
  let now = Date.now();
  const spy = jest.spyOn(Date, "now").mockImplementation(() => (now += 60_000));
  try {
    return f();
  } finally {
    spy.mockRestore();
  }
}

describe("a diff bounded by work", () => {
  test("is the same whatever the clock says (a time limit is not)", () => {
    const pairs = corpus(60);
    const byWork = new DiffMatchPatch({ diffWorkLimit: 200_000 });
    const calm = pairs.map(([a, b]) => patchText(byWork, a, b));
    const racing = withRacingClock(() =>
      pairs.map(([a, b]) => patchText(byWork, a, b)),
    );
    expect(racing).toEqual(calm);

    // By time, a slow machine (here, a racing clock) gets other patches.
    const byTime = new DiffMatchPatch({ diffTimeout: 1 });
    const fast = pairs.map(([a, b]) => patchText(byTime, a, b));
    const slow = withRacingClock(() =>
      pairs.map(([a, b]) => patchText(byTime, a, b)),
    );
    expect(slow).not.toEqual(fast);
  });

  test("with enough work, it is the diff a generous time limit gives", () => {
    const byWork = new DiffMatchPatch({ diffWorkLimit: 1e12 });
    const byTime = new DiffMatchPatch({ diffTimeout: 1e6 });
    for (const [a, b] of corpus(60, 7)) {
      expect(byWork.diff_main(a, b)).toEqual(byTime.diff_main(a, b));
      expect(patchText(byWork, a, b)).toEqual(patchText(byTime, a, b));
    }
  });

  test("when the work runs out, the diff and the patch are still exact", () => {
    for (const limit of [0.5, 100, 2_000, 20_000]) {
      const dmp = new DiffMatchPatch({ diffWorkLimit: limit });
      for (const [a, b] of corpus(45, limit)) {
        const diffs = dmp.diff_main(a, b);
        expect(dmp.diff_text1(diffs)).toBe(a);
        expect(dmp.diff_text2(diffs)).toBe(b);
        const [patched, applied] = new DiffMatchPatch().patch_apply(
          dmp.patch_make(a, b),
          a,
        );
        expect(applied.every(Boolean)).toBe(true);
        expect(patched).toBe(b);
      }
    }
  });

  test("the work done is bounded by the limit, plus at most one step", () => {
    const random = rng(1);
    // Unrelated texts: the bisection would visit about n^2/4 diagonals.
    const a = text(random, 20_000, "abcdefghijklmnopqrstuvwxyz");
    const b = text(random, 20_000, "abcdefghijklmnopqrstuvwxyz");
    const dmp = new DiffMatchPatch({ diffTimeout: 0 });
    for (const limit of [1_000, 100_000, 1_000_000]) {
      const budget = new DiffWorkBudget(limit);
      const diffs = dmp.diff_main(a, b, false, budget);
      expect(dmp.diff_text2(diffs)).toBe(b);
      expect(budget.left).toBeLessThan(0);
      // One bisection step visits at most every diagonal once and follows
      // each character once.
      expect(-budget.left).toBeLessThanOrEqual(2 * (a.length + b.length) + 2);
    }
  });

  test("a budget passed in is shared by the whole diff and spent once", () => {
    const [a, b] = corpus(1, 3)[0];
    const dmp = new DiffMatchPatch();
    const budget = new DiffWorkBudget(1e12);
    const diffs = dmp.diff_main(a, b, true, budget);
    const spent = 1e12 - budget.left;
    expect(spent).toBeGreaterThan(0);
    // The same diff from a fresh budget costs the same.
    const again = new DiffWorkBudget(1e12);
    expect(dmp.diff_main(a, b, true, again)).toEqual(diffs);
    expect(1e12 - again.left).toBe(spent);
  });
});
