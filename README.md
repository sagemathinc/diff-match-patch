<h1 align="center">Diff-Match-Patch in Typescript with full budget and surrogate pairs support</h1>

Javascript diff-match-patch, made **suitable for use in production**:

- **Modern typescript** with unit tests, thanks to [diff-match-patch-typescript](https://github.com/nonoroazoro/diff-match-patch-typescript).
- Full **unicode support**, thanks to [PR 80](https://github.com/google/diff-match-patch/pull/80/files)
- I added **full diffTimeout support**, which is only partially implemented elsewhere, and is critical for production use (since otherwise your server or browser can be easily stuck at 100% for minutes). See [big.test.ts](./tests/big/big.test.ts).
- **Modern api** for creating dmp object (still backward compatible).

## Installation

```sh
pnpm i @cocalc/diff-match-patch
```

```ts
import { DiffMatchPatch } from "@cocalc/diff-match-patch";
const dmp = new DiffMatchPatch({ diffTimeout:0.5 });
const patch = dmp.patch_make("ello", "hello world");
console.log(JSON.stringify(patch));
// [{"diffs":[[1,"h"],[0,"ello"],[1," world"]],"start1":0,"start2":0,"length1":4,"length2":11}]
dmp.patch_apply(patch, "ello");
// [ 'hello world', [ true ] ]

```

## Documentation

[Official Repository](https://github.com/sagemathinc/diff-match-patch).

