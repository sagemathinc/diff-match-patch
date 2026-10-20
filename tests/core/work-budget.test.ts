/**
 * A diff bounded by work (diffWorkLimit, or a DiffWorkBudget passed in)
 * instead of time: the same inputs give the same diff whatever the clock
 * says (the clock is never read), one budget is shared by everything a
 * public call does, the work done is at most the limit plus one step
 * (BUDGET_STEP_UNITS per character of the call's texts), the diff is exact
 * when the budget runs out, and with enough budget it is the diff a generous
 * time limit gives.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUDGET_STEP_UNITS,
  DiffMatchPatch,
  DiffOperation,
  DiffWorkBudget,
} from "../../src";
import type { Diff } from "../../src";

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

const exact = (x: unknown) => JSON.stringify(x);
const copy = (diffs: Diff[]): Diff[] => diffs.map(([op, s]) => [op, s]);

// Run f under a clock: frozen, jumping a minute on every reading, or set an
// hour ahead.
function withClock<T>(clock: "frozen" | "racing" | "ahead", f: () => T): T {
  let now = Date.now();
  const spy = jest
    .spyOn(Date, "now")
    .mockImplementation(() =>
      clock === "frozen"
        ? now
        : clock === "racing"
          ? (now += 60_000)
          : now + 3.6e6,
    );
  try {
    return f();
  } finally {
    spy.mockRestore();
  }
}

// Run f with a clock that throws if it is read.
function withoutClock<T>(f: () => T): T {
  const spy = jest.spyOn(Date, "now").mockImplementation(() => {
    throw Error("the clock was read");
  });
  try {
    return f();
  } finally {
    spy.mockRestore();
  }
}

// An operation counter independent of the budget's own accounting: the
// characters the string primitives touch and the array elements the array
// primitives move, while f runs.
function metered<T>(f: () => T): { result: T; ops: number } {
  let ops = 0;
  const S = String.prototype as any;
  const A = Array.prototype as any;
  const saved = {
    substring: S.substring,
    slice: S.slice,
    substr: S.substr,
    indexOf: S.indexOf,
    lastIndexOf: S.lastIndexOf,
    charAt: S.charAt,
    charCodeAt: S.charCodeAt,
    splice: A.splice,
    concat: A.concat,
    unshift: A.unshift,
    join: A.join,
  };
  S.substring = function (...args: any[]) {
    const r = saved.substring.apply(this, args);
    ops += r.length + 1;
    return r;
  };
  S.slice = function (...args: any[]) {
    const r = saved.slice.apply(this, args);
    ops += r.length + 1;
    return r;
  };
  S.substr = function (...args: any[]) {
    const r = saved.substr.apply(this, args);
    ops += r.length + 1;
    return r;
  };
  S.indexOf = function (pattern: string, from?: number) {
    ops += Math.max(0, this.length - (from ?? 0)) + `${pattern}`.length + 1;
    return saved.indexOf.call(this, pattern, from);
  };
  S.lastIndexOf = function (pattern: string, from?: number) {
    ops +=
      Math.min(this.length, (from ?? this.length) + 1) +
      `${pattern}`.length +
      1;
    return saved.lastIndexOf.call(this, pattern, from);
  };
  S.charAt = function (i: number) {
    ops += 1;
    return saved.charAt.call(this, i);
  };
  S.charCodeAt = function (i: number) {
    ops += 1;
    return saved.charCodeAt.call(this, i);
  };
  A.splice = function (...args: any[]) {
    ops += this.length + Math.max(0, args.length - 2) + 1;
    return saved.splice.apply(this, args);
  };
  A.concat = function (...args: any[]) {
    const r = saved.concat.apply(this, args);
    ops += r.length + 1;
    return r;
  };
  A.unshift = function (...args: any[]) {
    ops += this.length + args.length + 1;
    return saved.unshift.apply(this, args);
  };
  A.join = function (...args: any[]) {
    const r = saved.join.apply(this, args);
    ops += r.length + this.length + 1;
    return r;
  };
  try {
    return { result: f(), ops };
  } finally {
    Object.assign(S, {
      substring: saved.substring,
      slice: saved.slice,
      substr: saved.substr,
      indexOf: saved.indexOf,
      lastIndexOf: saved.lastIndexOf,
      charAt: saved.charAt,
      charCodeAt: saved.charCodeAt,
    });
    Object.assign(A, {
      splice: saved.splice,
      concat: saved.concat,
      unshift: saved.unshift,
      join: saved.join,
    });
  }
}

// The stated bound on one step, for texts of n characters in all.
const step = (n: number) => BUDGET_STEP_UNITS * (n + 2);

describe("a diff bounded by work", () => {
  test("is the same whatever the clock says (a time limit is not)", () => {
    const pairs = corpus(60);
    const byWork = new DiffMatchPatch({ diffWorkLimit: 2_000_000 });
    const run = (dmp: DiffMatchPatch) =>
      pairs.map(([a, b]) => exact(dmp.patch_make(a, b)));
    const calm = withClock("frozen", () => run(byWork));
    expect(withClock("racing", () => run(byWork))).toEqual(calm);
    expect(withClock("ahead", () => run(byWork))).toEqual(calm);

    // By time, a slow machine (here, a racing clock) gets other patches.
    const byTime = new DiffMatchPatch({ diffTimeout: 1 });
    expect(withClock("racing", () => run(byTime))).not.toEqual(
      withClock("frozen", () => run(byTime)),
    );
  }, 120_000);

  test("with enough work, it is the diff a generous time limit gives", () => {
    const byWork = new DiffMatchPatch({ diffWorkLimit: 1e12 });
    const byTime = new DiffMatchPatch({ diffTimeout: 1e6 });
    for (const [a, b] of corpus(60, 7)) {
      expect(byWork.diff_main(a, b)).toEqual(byTime.diff_main(a, b));
      expect(exact(byWork.patch_make(a, b))).toEqual(
        exact(byTime.patch_make(a, b)),
      );
    }
  }, 120_000);

  test("when the work runs out, the diff and the patch are still exact", () => {
    for (const limit of [0.5, 100, 2_000, 20_000, 200_000]) {
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
  }, 120_000);

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

describe("one budget, and never the clock (astra CORR-P3-1)", () => {
  test("astra's minimal case: cleanupMerge's recursion keeps the budget; frozen, racing and fast-forwarded clocks agree", () => {
    const input: Diff[] = [
      [DiffOperation.DIFF_EQUAL, "a"],
      [DiffOperation.DIFF_DELETE, "b"],
      [DiffOperation.DIFF_EQUAL, "c"],
      [DiffOperation.DIFF_DELETE, "ac"],
      [DiffOperation.DIFF_EQUAL, "x"],
    ];
    const run = () => {
      const diffs = copy(input);
      new DiffMatchPatch().diff_cleanupMerge(
        diffs,
        new DiffWorkBudget(1_000_000),
      );
      return diffs;
    };
    const frozen = withClock("frozen", run);
    expect(frozen).toEqual([
      [DiffOperation.DIFF_DELETE, "abc"],
      [DiffOperation.DIFF_EQUAL, "acx"],
    ]);
    expect(withClock("racing", run)).toEqual(frozen);
    expect(withClock("ahead", run)).toEqual(frozen);
    expect(withoutClock(run)).toEqual(frozen);
  });

  test("an explicit budget on a default instance never reads the clock: diff_main, every cleanup, patch_make and patch_apply", () => {
    const dmp = new DiffMatchPatch(); // diffTimeout 1, no diffWorkLimit
    for (const [a, b] of corpus(30, 11)) {
      withoutClock(() => {
        const diffs = dmp.diff_main(a, b, true, new DiffWorkBudget(5e6));
        dmp.diff_cleanupSemantic(copy(diffs), new DiffWorkBudget(5e6));
        dmp.diff_cleanupSemanticLossless(copy(diffs), new DiffWorkBudget(5e6));
        dmp.diff_cleanupEfficiency(copy(diffs), new DiffWorkBudget(5e6));
        dmp.diff_cleanupMerge(copy(diffs), new DiffWorkBudget(5e6));
        const patches = dmp.patch_make(
          a,
          b,
          undefined,
          new DiffWorkBudget(5e6),
        );
        // Applied to a changed text, so patch_apply runs its fuzzy diffs.
        dmp.patch_apply(
          patches,
          edit(rng(a.length), a, "abc"),
          new DiffWorkBudget(5e6),
        );
      });
    }
  }, 120_000);

  test("patch_make and patch_apply under diffWorkLimit: the same output with the clock frozen, racing or ahead", () => {
    const dmp = new DiffMatchPatch({ diffWorkLimit: 300_000 });
    const pairs = corpus(30, 13);
    const run = () =>
      pairs.map(([a, b]) => {
        const patches = dmp.patch_make(a, b);
        return exact([
          patches,
          dmp.patch_apply(patches, edit(rng(b.length), a, "abc")),
        ]);
      });
    const frozen = withClock("frozen", run);
    expect(withClock("racing", run)).toEqual(frozen);
    expect(withClock("ahead", run)).toEqual(frozen);
    expect(withoutClock(run)).toEqual(frozen);
  }, 120_000);

  test("one budget per public call: nothing below a public entry starts its own", () => {
    const dmp: any = new DiffMatchPatch({ diffWorkLimit: 1e9 });
    const getDeadline = dmp.getDeadline.bind(dmp);
    let created = 0;
    dmp.getDeadline = (opt?: unknown) => {
      const d = getDeadline(opt);
      if (opt == null) created++;
      return d;
    };
    for (const [a, b] of corpus(20, 17)) {
      created = 0;
      const patches = dmp.patch_make(a, b);
      expect(created).toBe(1);
      created = 0;
      dmp.patch_apply(patches, edit(rng(a.length), a, "abc"));
      expect(created).toBe(1);
      created = 0;
      dmp.diff_cleanupMerge(dmp.diff_main(a, b, true, new DiffWorkBudget(1e9)));
      expect(created).toBe(1);
    }
  }, 120_000);

  test("every internal call that takes a deadline is passed one (a source scan)", () => {
    const source = readFileSync(
      join(__dirname, "../../src/core/DiffMatchPatch.ts"),
      "utf8",
    );
    const takes = [
      "diff_main",
      "diff_compute_",
      "diff_lineMode_",
      "diff_bisect_",
      "diff_bisectSplit_",
      "diff_halfMatch_",
      "diff_halfMatchI_",
      "diff_commonOverlap_",
      "diff_cleanupSemantic",
      "diff_cleanupSemanticLossless",
      "diff_cleanupEfficiency",
      "diff_cleanupMerge",
    ];
    const missing: string[] = [];
    let calls = 0;
    for (const name of takes) {
      const re = new RegExp(`this\\.${name}\\(`, "g");
      for (const m of source.matchAll(re)) {
        // The call's arguments, to its closing parenthesis.
        let depth = 0;
        let end = m.index! + m[0].length - 1;
        for (; end < source.length; end++) {
          if (source[end] === "(") depth++;
          else if (source[end] === ")" && --depth === 0) break;
        }
        const args = source.slice(m.index! + m[0].length, end);
        calls++;
        if (!/\bdeadline\b/.test(args)) {
          missing.push(`${name}(${args.replace(/\s+/g, " ").trim()})`);
        }
      }
    }
    expect(calls).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});

describe("the bound: at most the limit plus one step (daybreak2)", () => {
  // The work a diff does under a budget of `limit`: what the budget was
  // charged, and the independent operation count.
  function bounded(a: string, b: string, limit: number, f = "patch_make") {
    const dmp = new DiffMatchPatch();
    const budget = new DiffWorkBudget(limit);
    const { result, ops } = metered(() =>
      f === "patch_make"
        ? dmp.patch_make(a, b, undefined, budget)
        : dmp.diff_main(a, b, true, budget),
    );
    return { result, ops, charged: limit - budget.left, dmp };
  }

  const random = rng(31);
  const adversarial: [string, string, string][] = [
    // The bisection's worst case: unrelated texts.
    [
      "unrelated",
      text(random, 6000, "abcdefghij"),
      text(random, 6000, "abcdefghij"),
    ],
    // Half-matching on repetitive text: the seed occurs everywhere.
    ["half-match", "ab".repeat(3000) + "x", "y" + "ab".repeat(3000)],
    // Cleanups: dense edits make many short equalities.
    [
      "cleanup",
      text(random, 6000, "abcdefghij "),
      (() => {
        const s = text(rng(32), 6000, "abcdefghij ");
        let t = "";
        for (let i = 0; i < s.length; i++) t += i % 3 === 0 ? "#" : s[i];
        return t;
      })(),
    ],
    // A long common prefix and suffix.
    [
      "prefix/suffix",
      "p".repeat(20000) + "x" + "s".repeat(20000),
      "p".repeat(20000) + "y" + "s".repeat(20000),
    ],
    // Lines, re-diffed character by character.
    [
      "lines",
      Array.from(
        { length: 400 },
        (_, i) => `line ${i % 37} ${"q".repeat(i % 13)}`,
      ).join("\n"),
      Array.from(
        { length: 400 },
        (_, i) => `line ${(i * 7) % 37} ${"r".repeat(i % 11)}`,
      ).join("\n"),
    ],
  ];

  for (const [name, a, b] of adversarial) {
    test(`${name}: charged and done within the limit plus one step, at every limit, down to nearly exhausted`, () => {
      const n = a.length + b.length;
      // What the whole diff costs, then limits from tiny to just below it.
      const full = bounded(a, b, 1e15).charged;
      const limits = [
        1,
        100,
        10_000,
        n,
        10 * n,
        full / 4,
        full / 2,
        full - 1,
        full - n,
        full,
      ];
      for (const limit of limits.filter((l) => l > 0)) {
        for (const f of ["diff_main", "patch_make"]) {
          const { result, ops, charged, dmp } = bounded(a, b, limit, f);
          // Exact.
          if (f === "diff_main") {
            expect(dmp.diff_text1(result as Diff[])).toBe(a);
            expect(dmp.diff_text2(result as Diff[])).toBe(b);
          }
          // Charged: the limit, plus at most one step.
          expect(charged).toBeLessThanOrEqual(limit + step(n));
          // Done (counted independently): the same bound, for diff_main;
          // patch_make adds its assembly and context search, outside the
          // budget (P2/P2b): at most its patches' text, twice, per patch.
          const outside =
            f === "diff_main"
              ? 0
              : (result as any[]).length * 2 * (n + 2) + 4 * (n + 2);
          expect({ limit, f, ops }).toEqual({
            limit,
            f,
            ops: expect.any(Number),
          });
          if (process.env.DMP_DEBUG) {
            console.log(
              JSON.stringify({ name, f, limit, charged, ops, n, outside }),
            );
          }
          expect(ops).toBeLessThanOrEqual(limit + step(n) + outside);
        }
      }
    }, 120_000);
  }

  test("a budget nearly spent: one unit short of what a diff needs gives the trivial diff's cost, not more", () => {
    const [a, b] = adversarial[0].slice(1) as [string, string];
    const n = a.length + b.length;
    for (const limit of [16 * n + 15, 16 * n + 16, 16 * n + 17]) {
      const { charged, ops } = bounded(a, b, limit, "diff_main");
      expect(charged).toBeLessThanOrEqual(limit + step(n));
      expect(ops).toBeLessThanOrEqual(limit + step(n));
    }
  });
});
