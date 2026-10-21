// patch_make gives exactly what the published 1.0.1 gives, in all four call
// forms and with a text1 the diffs don't start from, with fresh diffs for
// every call. Usage: node assembly-identical.js <1.0.1 lib> <new lib>
const Old = require(process.argv[2]).DiffMatchPatch;
const New = require(process.argv[3]).DiffMatchPatch;
const { rng, text, edit } = require("./lib");

const random = rng(77);
const alphabets = [
  [..."ab"],
  [..."abcd \n"],
  [..."abcdefghijklmnopqrstuvwxyz ,.\n"],
  ["a", "😀", "😃", "b"],
  ["x"],
];
const copy = (diffs) => diffs.map(([op, s]) => [op, s]);
const o = new Old({ diffTimeout: 0 });
const w = new New({ diffTimeout: 0 });
let calls = 0;
for (let i = 0; i < 3000; i++) {
  const al = alphabets[i % alphabets.length];
  const a = text(random, Math.floor(random() * 2000), al);
  const b =
    i % 9 === 0
      ? text(random, Math.floor(random() * 1000), al)
      : edit(random, a, al, 40);
  const other = edit(random, a, al, 40);
  const diffs = o.diff_main(a, b, true);
  if (diffs.length > 2) {
    o.diff_cleanupSemantic(diffs);
    o.diff_cleanupEfficiency(diffs);
  }
  const forms = [
    (m) => m.patch_make(a, b),
    (m) => m.patch_make(copy(diffs)),
    (m) => m.patch_make(a, copy(diffs)),
    (m) => m.patch_make(a, b, copy(diffs)),
    (m) => m.patch_make(other, copy(diffs)),
  ];
  forms.forEach((form, k) => {
    calls++;
    if (JSON.stringify(form(o)) !== JSON.stringify(form(w))) {
      console.log(`DIFFERENT: case ${i}, form ${k}`);
      process.exit(1);
    }
  });
}
console.log(`identical on ${calls} calls`);
