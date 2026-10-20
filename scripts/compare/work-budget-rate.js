// patch_make's time with a work budget: it follows the limit, not the text
// size. Usage: node work-budget-rate.js <new lib>
const { DiffMatchPatch } = require(process.argv[2]);
const { rng, text } = require("./lib");

const random = rng(5);
const az = "abcdefghijklmnopqrstuvwxyz";
const shapes = {
  "unrelated a-z": (n) => [text(random, n, az), text(random, n, az)],
  "unrelated ab": (n) => [text(random, n, "ab"), text(random, n, "ab")],
  "a^n -> b^n": (n) => ["a".repeat(n), "b".repeat(n)],
  "dense edits": (n) => {
    const s = text(random, n, "abcdefghij ");
    let t = "";
    for (let i = 0; i < n; i++) t += i % 9 === 0 ? "#" : s[i];
    return [s, t];
  },
};
for (const limit of [1e6, 4e6, 1.6e7]) {
  for (const [name, make] of Object.entries(shapes)) {
    const row = [];
    for (const n of [2000, 20000, 100000]) {
      const [a, b] = make(n);
      const dmp = new DiffMatchPatch({ diffWorkLimit: limit });
      dmp.patch_make(a, b); // warm up
      const times = [];
      for (let r = 0; r < 3; r++) {
        const t0 = performance.now();
        dmp.patch_make(a, b);
        times.push(performance.now() - t0);
      }
      times.sort((x, y) => x - y);
      row.push(`n=${n}: ${times[1].toFixed(1)} ms`);
    }
    console.log(`limit ${limit / 1e6}M, ${name}: ${row.join(", ")}`);
  }
}
