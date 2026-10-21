// Where patch_make's time goes on dense edits, 1.0.1 against this branch:
// the assembly, and the context search (patch_addContext_, or
// patch_addContextParts_ here), timed separately and stubbed out.
// Usage: node assembly-profile.js <1.0.1 lib> <new lib>
const Old = require(process.argv[2]).DiffMatchPatch;
const New = require(process.argv[3]).DiffMatchPatch;
const { rng, text } = require("./lib");

const random = rng(9);
for (const [n, every] of [
  [64 * 1024, 10],
  [250000, 10],
  [250000, 400],
]) {
  const a = text(random, n, "abcdefghijklmnopqrstuvwxyz ");
  let b = "";
  for (let i = 0; i < n; i++) b += i % every === 0 ? "#" : a[i];
  const diffs = new Old({ diffTimeout: 0 }).diff_main(a, b, false);
  for (const [name, C, key] of [
    ["1.0.1", Old, "patch_addContext_"],
    ["new", New, "patch_addContextParts_"],
  ]) {
    const time = (stub) => {
      const dmp = new C({ diffTimeout: 0 });
      const real = dmp[key].bind(dmp);
      let contextMs = 0;
      dmp[key] = stub
        ? () => {}
        : (...args) => {
            const t0 = performance.now();
            real(...args);
            contextMs += performance.now() - t0;
          };
      const t0 = performance.now();
      const patches = dmp.patch_make(
        a,
        diffs.map(([op, s]) => [op, s]),
      );
      return {
        total: performance.now() - t0,
        contextMs,
        patches: patches.length,
      };
    };
    const real = time(false);
    const stubbed = time(true);
    console.log(
      `${n} chars, every ${every}th changed (${diffs.length} diffs, ${real.patches} patches), ${name}: ` +
        `assembly ${stubbed.total.toFixed(0)} ms, context ${real.contextMs.toFixed(0)} ms, total ${real.total.toFixed(0)} ms`,
    );
  }
}
