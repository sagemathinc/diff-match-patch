import { DiffMatchPatch } from "../../src/core";
import { randomBytes } from "node:crypto";

describe("diff large strings", () => {
  it("a long string compared to its shift works", () => {
    const n = 2e6;
    const shift = 1;
    const one = "x".repeat(n);
    const two = "a".repeat(shift) + "x".repeat(n - shift);
    const dmp = new DiffMatchPatch();
    const p = dmp.patch_make(one, two);
    expect(p[0].diffs).toEqual([
      [-1, "x".repeat(shift)],
      [1, "a".repeat(shift)],
      [0, "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
    ]);
  });

  it("two long random strings", () => {
    const n = 1e6;
    const one = randomBytes(n).toString("hex");
    const two = randomBytes(n).toString("hex");
    const dmp = new DiffMatchPatch({ diffTimeout: 0.5 });
    const t = Date.now();
    const p = dmp.patch_make(one, two);
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it("string with over 65K distinct lines", () => {
    const n = 2e5;
    let one = "";
    for (let i = 0; i < n; i++) {
      one += `${i}\n`;
    }
    let two = "";
    for (let i = 0; i < n; i++) {
      two += `${Math.random()}\n`;
    }
    const dmp = new DiffMatchPatch({ diffTimeout: 0.5 });
    const t = Date.now();
    const p = dmp.patch_make(one, two);
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it("moving the word 'hello' from the near the end to the front of a long string -- this hangs without using diffTimeout", () => {
    const n = 2e5;
    const one = "x\n".repeat(n) + "hello" + "xxxx";
    const two = "hello" + "x\n".repeat(n);
    const dmp = new DiffMatchPatch({ diffTimeout: 0.5 });
    const t = Date.now();
    const p = dmp.diff_main(one, two);
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it("bigger example moving the word 'hello' from the near the end to the front of a much longer string", () => {
    const n = 1e6;
    const one = "x\n".repeat(n) + "hello" + "xxxx";
    const two = "hello" + "x\n".repeat(n);
    const dmp = new DiffMatchPatch({ diffTimeout: 0.5 });
    const t = Date.now();
    const p = dmp.patch_make(one, two);
    // timeout can be exceeded somewhat
    expect(Date.now() - t).toBeLessThan(2000);
  });
});
