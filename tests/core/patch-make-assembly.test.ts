/**
 * patch_make's patches are byte for byte what they were when the post-patch
 * text was rebuilt after every diff: the reference below is that loop, as it
 * was, run on the same diffs.
 */

import { DiffMatchPatch, DiffOperation, PatchObject } from "../../src";
import type { Diff } from "../../src";
import { cleanupSplitSurrogates } from "../../src/core/surrogate-pairs";

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

// patch_make (methods 3 and 4: text1 and diffs) as it was.
function referencePatchMake(
  dmp: DiffMatchPatch,
  text1: string,
  diffs: Diff[],
): PatchObject[] {
  if (diffs.length === 0) return [];
  diffs = cleanupSplitSurrogates(diffs);
  const addContext = (dmp as any).patch_addContext_.bind(dmp);
  const patches: PatchObject[] = [];
  let patch = new PatchObject();
  let patchDiffLength = 0;
  let charCount1 = 0;
  let charCount2 = 0;
  let prepatchText = text1;
  let postpatchText = text1;
  for (let x = 0; x < diffs.length; x++) {
    const diffType = diffs[x][0];
    const diffText = diffs[x][1];
    if (!patchDiffLength && diffType !== DiffOperation.DIFF_EQUAL) {
      patch.start1 = charCount1;
      patch.start2 = charCount2;
    }
    switch (diffType) {
      case DiffOperation.DIFF_INSERT:
        patch.diffs[patchDiffLength++] = diffs[x];
        patch.length2 += diffText.length;
        postpatchText =
          postpatchText.substring(0, charCount2) +
          diffText +
          postpatchText.substring(charCount2);
        break;
      case DiffOperation.DIFF_DELETE:
        patch.length1 += diffText.length;
        patch.diffs[patchDiffLength++] = diffs[x];
        postpatchText =
          postpatchText.substring(0, charCount2) +
          postpatchText.substring(charCount2 + diffText.length);
        break;
      case DiffOperation.DIFF_EQUAL:
        if (
          diffText.length <= 2 * dmp.patchMargin &&
          patchDiffLength &&
          diffs.length !== x + 1
        ) {
          patch.diffs[patchDiffLength++] = diffs[x];
          patch.length1 += diffText.length;
          patch.length2 += diffText.length;
        } else if (diffText.length >= 2 * dmp.patchMargin) {
          if (patchDiffLength) {
            addContext(patch, prepatchText);
            patches.push(patch);
            patch = new PatchObject();
            patchDiffLength = 0;
            prepatchText = postpatchText;
            charCount1 = charCount2;
          }
        }
        break;
    }
    if (diffType !== DiffOperation.DIFF_INSERT) {
      charCount1 += diffText.length;
    }
    if (diffType !== DiffOperation.DIFF_DELETE) {
      charCount2 += diffText.length;
    }
  }
  if (patchDiffLength) {
    addContext(patch, prepatchText);
    patches.push(patch);
  }
  return patches;
}

// A patch list exactly (patch_toText would refuse a lone surrogate).
const exact = (patches: PatchObject[]) => JSON.stringify(patches);

// A fresh copy of diffs for each call: patch_make changes the diffs it is
// given (cleanupSplitSurrogates), as it always has.
const copy = (diffs: Diff[]): Diff[] => diffs.map(([op, text]) => [op, text]);

function text(random: () => number, n: number, alphabet: string[]): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s += alphabet[Math.floor(random() * alphabet.length)];
  }
  return s;
}

function edit(random: () => number, s: string, alphabet: string[]): string {
  for (let e = Math.floor(random() * 40); e >= 0; e--) {
    const at = Math.floor(random() * (s.length + 1));
    s =
      s.slice(0, at) +
      text(random, Math.floor(random() * 12), alphabet) +
      s.slice(at + Math.floor(random() * 12));
  }
  return s;
}

const ALPHABETS = [
  [..."ab"],
  [..."abcd \n"],
  [..."abcdefghijklmnopqrstuvwxyz ,.\n"],
  // Surrogate pairs, which patch_make's diffs may split.
  ["a", "😀", "😃", "😀", "b"],
];

describe("patch_make's assembly", () => {
  test("is byte-identical to rebuilding the text after every diff (2,000 random edits)", () => {
    const random = rng(26);
    const dmp = new DiffMatchPatch({ diffTimeout: 0 });
    for (let i = 0; i < 2000; i++) {
      const alphabet = ALPHABETS[i % ALPHABETS.length];
      const a = text(random, Math.floor(random() * 1500), alphabet);
      const b =
        i % 9 === 0 ? text(random, 800, alphabet) : edit(random, a, alphabet);
      const diffs = dmp.diff_main(a, b, true);
      if (diffs.length > 2) {
        dmp.diff_cleanupSemantic(diffs);
        dmp.diff_cleanupEfficiency(diffs);
      }
      const expected = exact(referencePatchMake(dmp, a, copy(diffs)));
      // Method 1 (texts), 2 (diffs), 3 (text1 and diffs), 4.
      expect(exact(dmp.patch_make(a, b))).toBe(expected);
      expect(exact(dmp.patch_make(copy(diffs)))).toBe(expected);
      expect(exact(dmp.patch_make(a, copy(diffs)))).toBe(expected);
      expect(exact(dmp.patch_make(a, b, copy(diffs)))).toBe(expected);
    }
  });

  test("with a text1 the diffs don't start from, it is the old splicing, as before", () => {
    const random = rng(4);
    const dmp = new DiffMatchPatch({ diffTimeout: 0 });
    for (let i = 0; i < 300; i++) {
      const alphabet = ALPHABETS[i % ALPHABETS.length];
      const a = text(random, Math.floor(random() * 400), alphabet);
      const diffs = dmp.diff_main(a, edit(random, a, alphabet), true);
      const other = edit(random, a, alphabet);
      expect(exact(dmp.patch_make(other, copy(diffs)))).toBe(
        exact(referencePatchMake(dmp, other, copy(diffs))),
      );
    }
  });

  test("dense edits in a long text: linear in the patches, not in diffs times length", () => {
    const random = rng(9);
    const alphabet = [..."abcdefghijklmnopqrstuvwxyz "];
    const a = text(random, 250_000, alphabet);
    let b = "";
    for (let i = 0; i < a.length; i++) b += i % 10 === 0 ? "#" : a[i];
    const dmp = new DiffMatchPatch({ diffTimeout: 0 });
    const diffs = dmp.diff_main(a, b, false);
    const t0 = performance.now();
    const fast = exact(dmp.patch_make(a, copy(diffs)));
    const ours = performance.now() - t0;
    const t1 = performance.now();
    const slow = exact(referencePatchMake(dmp, a, copy(diffs)));
    const reference = performance.now() - t1;
    expect(fast).toBe(slow);
    // Measured, not a timing assertion: printed for the record.
    console.log(
      `patch_make of ${diffs.length} diffs over 250 KB: ${ours.toFixed(0)} ms (reference ${reference.toFixed(0)} ms)`,
    );
  });
});
