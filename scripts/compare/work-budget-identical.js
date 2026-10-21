// Without diffWorkLimit, diff_main, patch_make and patch_apply give exactly
// what the published 1.0.1 gives (diffTimeout 0 and 1e6, so the clock never
// cuts either off). Usage: node work-budget-identical.js <1.0.1 lib> <new lib>
const Old = require(process.argv[2]).DiffMatchPatch;
const New = require(process.argv[3]).DiffMatchPatch;
const { rng, text, edit } = require("./lib");

const random = rng(42);
const alphabets = ["ab", "abcd \n", "abcdefghijklmnopqrstuvwxyz ,.\n", "x"];
let n = 0;
for (const diffTimeout of [0, 1e6]) {
  const o = new Old({ diffTimeout });
  const w = new New({ diffTimeout });
  for (let i = 0; i < 1500; i++) {
    const a = alphabets[i % 4];
    const s = text(random, Math.floor(random() * 2500), a);
    const t =
      i % 7 === 0
        ? text(random, Math.floor(random() * 2500), a)
        : edit(random, s, a);
    const patch = o.patch_toText(o.patch_make(s, t));
    const u = edit(random, s, a);
    const same =
      JSON.stringify(o.diff_main(s, t)) === JSON.stringify(w.diff_main(s, t)) &&
      patch === w.patch_toText(w.patch_make(s, t)) &&
      JSON.stringify(o.patch_apply(o.patch_fromText(patch), u)) ===
        JSON.stringify(w.patch_apply(w.patch_fromText(patch), u));
    if (!same) {
      console.log(`DIFFERENT: diffTimeout ${diffTimeout}, case ${i}`);
      process.exit(1);
    }
    n++;
  }
}
console.log(`identical on ${n} cases (diff_main, patch_make, patch_apply)`);
