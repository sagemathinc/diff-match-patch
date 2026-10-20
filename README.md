<h1 align="center">Diff-Match-Patch in Typescript with full budget and surrogate pairs support</h1>

Javascript diff-match-patch, made **suitable for use in production**:

- **Modern typescript** with unit tests, thanks to [diff-match-patch-typescript](https://github.com/nonoroazoro/diff-match-patch-typescript).
- Full **unicode support**, thanks to [PR 80](https://github.com/google/diff-match-patch/pull/80/files)
- I added **full diffTimeout support**, which is only partially implemented elsewhere, and is critical for production use (since otherwise your server or browser can be easily stuck at 100% for minutes). See [big.test.ts](./tests/big/big.test.ts).
- A **deterministic work budget** (`diffWorkLimit`, or a `DiffWorkBudget` passed in) in place of the clock. Off by default; without it, results are byte-identical to 1.0.1. See [work-budget.test.ts](./tests/core/work-budget.test.ts). With it:
  - **The contract:** `diff_main` and the cleanups (and so `patch_make`'s diff and `patch_apply`'s fuzzy diffs) do at most `diffWorkLimit + BUDGET_STEP_UNITS × (n + 2)` units of work, where a unit is a character compared or copied, or an array element moved, and `n` is the length of the call's texts (for a cleanup, of its diffs); `BUDGET_STEP_UNITS` is 24.
  - **How:** every step is either paid for ahead with a bound on its work (and skipped, leaving the trivial diff, if the budget can't cover it), or runs only while the budget isn't spent and is charged as it runs. So the work is the limit plus at most one step. One budget is shared by everything a call does, and the clock is never read.
  - **Not covered:** `patch_make`'s assembly and its context search (`patch_addContext_`, O(N) per patch) are outside the budget, and so is `patch_apply`'s matching (`match_main`). The budget bounds the diff, not all of `patch_make`.
  - **Speed:** roughly 135,000 to 180,000 units take a millisecond on an AMD EPYC 7B13 core, so `diffWorkLimit: 25_000_000` is about `diffTimeout: 0.2` there. That figure is measured, not part of the contract.
- **Modern api** for creating dmp object (still backward compatible).

## Installation

```sh
pnpm i @cocalc/diff-match-patch
```

```ts
import { DiffMatchPatch } from "@cocalc/diff-match-patch";
const dmp = new DiffMatchPatch({ diffTimeout: 0.5 });
const patch = dmp.patch_make("ello", "hello world");
console.log(JSON.stringify(patch));
// [{"diffs":[[1,"h"],[0,"ello"],[1," world"]],"start1":0,"start2":0,"length1":4,"length2":11}]
dmp.patch_apply(patch, "ello");
// [ 'hello world', [ true ] ]
```

## Documentation

[Official Repository](https://github.com/sagemathinc/diff-match-patch).
